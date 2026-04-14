import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { toNumber } from "~/lib/utils";

// ─── Zod Schemas ─────────────────────────────────────────

const categoryCreateSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(50, "Max 50 caratteri"),
  icon: z.string().emoji("Deve essere un emoji").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore HEX non valido (es. #FF5733)")
    .optional(),
  budget: z
    .number()
    .positive("Il budget deve essere maggiore di zero")
    .optional(),
});

const categoryUpdateSchema = z.object({
  id: z.string().cuid(),
  name: z
    .string()
    .min(1, "Il nome è obbligatorio")
    .max(50, "Max 50 caratteri")
    .optional(),
  icon: z.string().emoji("Deve essere un emoji").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore HEX non valido (es. #FF5733)")
    .optional(),
  budget: z
    .number()
    .positive("Il budget deve essere maggiore di zero")
    .optional()
    .nullable(), // nullable per poter rimuovere il budget
});

// ─── Router ──────────────────────────────────────────────

export const categoryRouter = createTRPCRouter({
  // Tutte le categorie dell'utente autenticato
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const categories = await ctx.db.category.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        _count: {
          select: { expenses: true },
        },
        expenses: {
          where: {
            date: { gte: monthStart, lt: monthEnd },
          },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calcola il totale speso nel mese corrente per ogni categoria
    return categories.map((cat) => ({
      ...cat,
      spentThisMonth: cat.expenses.reduce(
        (sum, e) => sum + toNumber(e.amount),
        0
      ),
      expenses: undefined, // non esporre le singole spese
    }));
  }),

  // Singola categoria per id (usata nel form di edit)
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.db.category.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoria non trovata",
        });
      }

      return category;
    }),

  // Crea nuova categoria
  create: protectedProcedure
    .input(categoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verifica nome duplicato per lo stesso utente
      const existing = await ctx.db.category.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
          userId: ctx.session.user.id,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esiste già una categoria con questo nome",
        });
      }

      return ctx.db.category.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
      });
    }),

  // Aggiorna categoria esistente
  update: protectedProcedure
    .input(categoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verifica che la categoria appartenga all'utente
      const category = await ctx.db.category.findUnique({
        where: { id, userId: ctx.session.user.id },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoria non trovata",
        });
      }

      // Verifica nome duplicato (escludendo la categoria corrente)
      if (data.name) {
        const existing = await ctx.db.category.findFirst({
          where: {
            name: { equals: data.name, mode: "insensitive" },
            userId: ctx.session.user.id,
            NOT: { id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esiste già una categoria con questo nome",
          });
        }
      }

      return ctx.db.category.update({
        where: { id, userId: ctx.session.user.id },
        data,
      });
    }),

  // Elimina categoria
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verifica che la categoria appartenga all'utente
      const category = await ctx.db.category.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { _count: { select: { expenses: true } } },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoria non trovata",
        });
      }

      // Blocca eliminazione se ci sono spese collegate
      if (category._count.expenses > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Impossibile eliminare: ${category._count.expenses} spese usano questa categoria`,
        });
      }

      return ctx.db.category.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
    }),

  // Crea più categorie in una volta — usato dall'onboarding
  createBatch: protectedProcedure
    .input(
      z.array(
        z.object({
          name: z.string().min(1).max(50),
          icon: z.string().emoji().optional(),
          color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/)
            .optional(),
        })
      ).min(1).max(10)
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Filtra nomi già esistenti per non bloccare su CONFLICT
      const existing = await ctx.db.category.findMany({
        where: { userId },
        select: { name: true },
      });
      const existingNames = new Set(
        existing.map((c) => c.name.toLowerCase())
      );

      const toCreate = input.filter(
        (c) => !existingNames.has(c.name.toLowerCase())
      );

      if (toCreate.length === 0) return { created: 0 };

      await ctx.db.category.createMany({
        data: toCreate.map((c) => ({ ...c, userId })),
      });

      return { created: toCreate.length };
    }),
});
