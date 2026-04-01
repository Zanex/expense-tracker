import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// ─── Zod Schemas ─────────────────────────────────────────

const expenseCreateSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Inserisci un importo valido" })
    .positive("L'importo deve essere maggiore di zero")
    .multipleOf(0.01, "Massimo 2 decimali"),
  description: z
    .string()
    .min(1, "La descrizione è obbligatoria")
    .max(255, "Max 255 caratteri"),
  date: z.date({ required_error: "La data è obbligatoria" }),
  categoryId: z.string().cuid("Categoria non valida"),
});

const expenseUpdateSchema = z.object({
  id: z.string().cuid(),
  amount: z
    .number({ invalid_type_error: "Inserisci un importo valido" })
    .positive("L'importo deve essere maggiore di zero")
    .multipleOf(0.01, "Massimo 2 decimali")
    .optional(),
  description: z
    .string()
    .min(1, "La descrizione è obbligatoria")
    .max(255, "Max 255 caratteri")
    .optional(),
  date: z.date().optional(),
  categoryId: z.string().cuid("Categoria non valida").optional(),
});

const expenseFiltersSchema = z.object({
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2000).max(2100).optional(),
  categoryId: z.string().cuid().optional(),
  search: z.string().max(100).optional(),       // ricerca per descrizione
  amountMin: z.number().positive().optional(),  // importo minimo
  amountMax: z.number().positive().optional(),  // importo massimo
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// ─── Helpers ─────────────────────────────────────────────

function buildDateFilter(month?: number, year?: number) {
  if (!month || !year) return undefined;
  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}

// ─── Router ──────────────────────────────────────────────

export const expenseRouter = createTRPCRouter({
  // Lista paginata con filtri opzionali
  getAll: protectedProcedure
    .input(expenseFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { month, year, categoryId, search, amountMin, amountMax, page, limit } = input;
      const skip = (page - 1) * limit;

      const where = {
        userId: ctx.session.user.id,
        ...(buildDateFilter(month, year) && {
          date: buildDateFilter(month, year),
        }),
        ...(categoryId && { categoryId }),
        // Ricerca full-text sulla descrizione (case-insensitive)
        ...(search && {
          description: {
            contains: search,
            mode: "insensitive" as const,
          },
        }),
        // Filtro importo minimo e massimo
        ...((amountMin ?? amountMax) && {
          amount: {
            ...(amountMin && { gte: amountMin }),
            ...(amountMax && { lte: amountMax }),
          },
        }),
      };

      // Query parallele per dati e conteggio totale
      const [expenses, totalCount] = await Promise.all([
        ctx.db.expense.findMany({
          where,
          include: { category: true },
          orderBy: { date: "desc" },
          skip,
          take: limit,
        }),
        ctx.db.expense.count({ where }),
      ]);

      return {
        expenses,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      };
    }),

  // Singola spesa per id (usata nel form di edit)
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { category: true },
      });

      if (!expense) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Spesa non trovata",
        });
      }

      return expense;
    }),

  // Crea nuova spesa
  create: protectedProcedure
    .input(expenseCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verifica che la categoria appartenga all'utente
      const category = await ctx.db.category.findUnique({
        where: { id: input.categoryId, userId: ctx.session.user.id },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoria non trovata",
        });
      }

      return ctx.db.expense.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
        include: { category: true },
      });
    }),

  // Aggiorna spesa esistente
  update: protectedProcedure
    .input(expenseUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verifica che la spesa appartenga all'utente
      const expense = await ctx.db.expense.findUnique({
        where: { id, userId: ctx.session.user.id },
      });

      if (!expense) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Spesa non trovata",
        });
      }

      // Se si cambia categoria, verifica che la nuova appartenga all'utente
      if (data.categoryId) {
        const category = await ctx.db.category.findUnique({
          where: { id: data.categoryId, userId: ctx.session.user.id },
        });

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Categoria non trovata",
          });
        }
      }

      return ctx.db.expense.update({
        where: { id, userId: ctx.session.user.id },
        data,
        include: { category: true },
      });
    }),

  // Elimina spesa
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!expense) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Spesa non trovata",
        });
      }

      return ctx.db.expense.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
    }),

  // Import batch di spese (usato dall'import CSV/XLSX)
  importBatch: protectedProcedure
    .input(
      z.object({
        expenses: z
          .array(
            z.object({
              amount: z.number().positive(),
              description: z.string().min(1).max(255),
              date: z.date(),
              categoryId: z.string().cuid(),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verifica che tutte le categorie appartengano all'utente
      const categoryIds = [
        ...new Set(input.expenses.map((e) => e.categoryId)),
      ];
      const validCategories = await ctx.db.category.findMany({
        where: { id: { in: categoryIds }, userId },
        select: { id: true },
      });

      const validIds = new Set(validCategories.map((c) => c.id));
      const invalidIds = categoryIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Categorie non valide: ${invalidIds.join(", ")}`,
        });
      }

      // Inserimento in transazione — o tutte o nessuna
      const result = await ctx.db.$transaction(
        input.expenses.map((expense) =>
          ctx.db.expense.create({
            data: { ...expense, userId },
          })
        )
      );

      return { imported: result.length };
    }),

  // Totale spese per il mese corrente (usato dalla dashboard nella Fase 2)
  getMonthlyTotal: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.expense.aggregate({
        where: {
          userId: ctx.session.user.id,
          date: buildDateFilter(input.month, input.year),
        },
        _sum: { amount: true },
        _count: true,
      });

      return {
        total: result._sum.amount?.toNumber() ?? 0,
        count: result._count,
      };
    }),
});
