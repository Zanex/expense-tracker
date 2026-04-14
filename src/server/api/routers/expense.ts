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
  // Ricorrenza — opzionale
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(["monthly", "weekly", "yearly"]).optional(),
  recurringEndDate: z.date().optional(),
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
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.enum(["monthly", "weekly", "yearly"]).optional().nullable(),
  recurringEndDate: z.date().optional().nullable(),
});

const expenseFiltersSchema = z.object({
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2000).max(2100).optional(),
  categoryId: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  amountMin: z.number().positive().optional(),
  amountMax: z.number().positive().optional(),
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

/**
 * Calcola la prossima data di ricorrenza a partire da una data base.
 * Es: monthly "01/01/2026" → "01/02/2026"
 */
function getNextRecurringDate(
  baseDate: Date,
  frequency: "monthly" | "weekly" | "yearly"
): Date {
  const next = new Date(baseDate);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
}

// ─── Router ──────────────────────────────────────────────

export const expenseRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(expenseFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { month, year, categoryId, search, amountMin, amountMax, page, limit } = input;
      const skip = (page - 1) * limit;

      const where = {
        userId: ctx.session.user.id,
        ...(buildDateFilter(month, year) && { date: buildDateFilter(month, year) }),
        ...(categoryId && { categoryId }),
        ...(search && {
          description: { contains: search, mode: "insensitive" as const },
        }),
        ...((amountMin ?? amountMax) && {
          amount: {
            ...(amountMin && { gte: amountMin }),
            ...(amountMax && { lte: amountMax }),
          },
        }),
      };

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

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { category: true },
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Spesa non trovata" });
      return expense;
    }),

  create: protectedProcedure
    .input(expenseCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.category.findUnique({
        where: { id: input.categoryId, userId: ctx.session.user.id },
      });
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria non trovata" });

      // Validazione: se ricorrente deve avere la frequenza
      if (input.isRecurring && !input.recurringFrequency) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Specifica la frequenza di ricorrenza",
        });
      }

      return ctx.db.expense.create({
        data: { ...input, userId: ctx.session.user.id },
        include: { category: true },
      });
    }),

  update: protectedProcedure
    .input(expenseUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const expense = await ctx.db.expense.findUnique({
        where: { id, userId: ctx.session.user.id },
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Spesa non trovata" });

      if (data.categoryId) {
        const category = await ctx.db.category.findUnique({
          where: { id: data.categoryId, userId: ctx.session.user.id },
        });
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria non trovata" });
      }

      return ctx.db.expense.update({
        where: { id, userId: ctx.session.user.id },
        data,
        include: { category: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Spesa non trovata" });

      return ctx.db.expense.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
    }),

  importBatch: protectedProcedure
    .input(
      z.object({
        expenses: z
          .array(z.object({
            amount: z.number().positive(),
            description: z.string().min(1).max(255),
            date: z.date(),
            categoryId: z.string().cuid(),
          }))
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const categoryIds = [...new Set(input.expenses.map((e) => e.categoryId))];
      const validCategories = await ctx.db.category.findMany({
        where: { id: { in: categoryIds }, userId },
        select: { id: true },
      });
      const validIds = new Set(validCategories.map((c) => c.id));
      const invalidIds = categoryIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Categorie non valide: ${invalidIds.join(", ")}` });
      }
      const result = await ctx.db.$transaction(
        input.expenses.map((expense) => ctx.db.expense.create({ data: { ...expense, userId } }))
      );
      return { imported: result.length };
    }),

  getMonthlyTotal: protectedProcedure
    .input(z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.expense.aggregate({
        where: { userId: ctx.session.user.id, date: buildDateFilter(input.month, input.year) },
        _sum: { amount: true },
        _count: true,
      });
      return { total: result._sum.amount?.toNumber() ?? 0, count: result._count };
    }),

  // ─── NEW: Process Recurring ───────────────────────────────────────────────
  /**
   * processRecurring
   * Crea le istanze mancanti delle spese ricorrenti.
   * Da chiamare al caricamento della dashboard.
   *
   * Logica:
   * 1. Trova tutte le spese "template" (isRecurring=true, recurringParentId=null)
   * 2. Per ognuna, trova l'ultima istanza creata (o usa la data originale)
   * 3. Se la prossima data è ≤ oggi, crea la nuova istanza e aggiorna il ciclo
   */
  processRecurring: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Prende tutti i template ricorrenti attivi
      const templates = await ctx.db.expense.findMany({
        where: {
          userId,
          isRecurring: true,
          recurringParentId: null, // solo i template, non le copie
          // Non scaduti
          OR: [
            { recurringEndDate: null },
            { recurringEndDate: { gte: today } },
          ],
        },
      });

      if (templates.length === 0) return { created: 0 };

      const created: string[] = [];

      for (const template of templates) {
        if (!template.recurringFrequency) continue;
        const frequency = template.recurringFrequency as "monthly" | "weekly" | "yearly";

        // Trova l'ultima istanza creata da questo template
        const lastInstance = await ctx.db.expense.findFirst({
          where: { userId, recurringParentId: template.id },
          orderBy: { date: "desc" },
        });

        // Punto di partenza: ultima istanza o template stesso
        let nextDate = getNextRecurringDate(
          lastInstance?.date ?? template.date,
          frequency
        );

        // Crea tutte le istanze mancanti fino a oggi
        while (nextDate <= today) {
          // Controlla che non superi la data di fine
          if (template.recurringEndDate && nextDate > template.recurringEndDate) break;

          await ctx.db.expense.create({
            data: {
              amount: template.amount,
              description: template.description,
              date: nextDate,
              categoryId: template.categoryId,
              userId,
              isRecurring: false,            // le copie non sono template
              recurringParentId: template.id, // link al template originale
            },
          });

          created.push(template.id);
          nextDate = getNextRecurringDate(nextDate, frequency);
        }
      }

      return { created: created.length };
    }),

  // Lista spese ricorrenti attive (per la gestione)
  getRecurring: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      return ctx.db.expense.findMany({
        where: {
          userId: ctx.session.user.id,
          isRecurring: true,
          recurringParentId: null,
          OR: [
            { recurringEndDate: null },
            { recurringEndDate: { gte: today } },
          ],
        },
        include: { category: true },
        orderBy: { date: "desc" },
      });
    }),

  // ─── NEW: Upcoming Recurring ─────────────────────────────────────────────
  /**
   * getUpcomingRecurring
   * Calcola le spese ricorrenti attese nel mese corrente
   * che NON sono ancora state generate (utile per il widget dashboard).
   */
  getUpcomingRecurring: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { month, year } = input;
      const userId = ctx.session.user.id;

      // Inizio e fine mese richiesto
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      // Tutti i template attivi
      const templates = await ctx.db.expense.findMany({
        where: {
          userId,
          isRecurring: true,
          recurringParentId: null,
          OR: [
            { recurringEndDate: null },
            { recurringEndDate: { gte: monthStart } },
          ],
        },
        include: { category: true },
      });

      if (templates.length === 0) return [];

      const upcoming: {
        templateId: string;
        description: string;
        amount: number;
        expectedDate: Date;
        category: { id: string; name: string; icon: string | null; color: string | null };
        frequency: string;
        alreadyCreated: boolean;
      }[] = [];

      for (const template of templates) {
        if (!template.recurringFrequency) continue;
        const freq = template.recurringFrequency as "monthly" | "weekly" | "yearly";

        // Ultima istanza creata
        const lastInstance = await ctx.db.expense.findFirst({
          where: { userId, recurringParentId: template.id },
          orderBy: { date: "desc" },
        });

        const baseDate = lastInstance?.date ?? template.date;
        const nextDate = getNextRecurringDate(baseDate, freq);

        // La prossima occorrenza cade nel mese richiesto?
        if (nextDate >= monthStart && nextDate < monthEnd) {
          // È già stata creata in questo mese?
          const alreadyCreated = await ctx.db.expense.findFirst({
            where: {
              userId,
              recurringParentId: template.id,
              date: { gte: monthStart, lt: monthEnd },
            },
          });

          upcoming.push({
            templateId: template.id,
            description: template.description,
            amount: template.amount.toNumber(),
            expectedDate: nextDate,
            category: {
              id: template.category.id,
              name: template.category.name,
              icon: template.category.icon,
              color: template.category.color,
            },
            frequency: freq,
            alreadyCreated: !!alreadyCreated,
          });
        }
      }

      return upcoming.sort(
        (a, b) => a.expectedDate.getTime() - b.expectedDate.getTime()
      );
    }),
});