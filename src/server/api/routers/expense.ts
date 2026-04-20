import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getNextRecurringDate, buildDateRange } from "~/lib/recurring";


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
  tripId: z.string().cuid("ID viaggio non valido").optional().nullable(),
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
  tripId: z.string().cuid("ID viaggio non valido").optional().nullable(),
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
  tripId: z.string().cuid().optional(),
});

// ─── Helpers ─────────────────────────────────────────────


// ─── Router ──────────────────────────────────────────────

export const expenseRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(expenseFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { month, year, categoryId, search, amountMin, amountMax, page, limit, tripId } = input;
      const skip = (page - 1) * limit;

      const where = {
        userId: ctx.session.user.id,
        ...(month && year && { date: buildDateRange(month, year) }),
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
        ...(tripId && { tripId }),
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

      if (input.tripId) {
        const trip = await ctx.db.trip.findUnique({
          where: { id: input.tripId, userId: ctx.session.user.id },
          select: { id: true },
        });
        if (!trip) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
        }
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
      const result = await ctx.db.expense.createMany({
        data: input.expenses.map((expense) => ({ ...expense, userId }))
      });
      return { imported: result.count };
    }),

  getMonthlyTotal: protectedProcedure
    .input(z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.expense.aggregate({
        where: {
          userId: ctx.session.user.id,
          date: (input.month && input.year) ? buildDateRange(input.month, input.year) : undefined
        },
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
  processRecurring: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Prende tutti i template ricorrenti attivi
    const templates = await ctx.db.expense.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringParentId: null,
        OR: [{ recurringEndDate: null }, { recurringEndDate: { gte: today } }],
      },
    });

    if (templates.length === 0) return { created: 0 };

    // 2. Ottimizzazione: Trova l'ultima spesa creata per OGNI template in un'unica query
    const lastInstances = await ctx.db.expense.groupBy({
      by: ["recurringParentId"],
      where: {
        userId,
        recurringParentId: { in: templates.map((t) => t.id) },
      },
      _max: { date: true },
    });

    const lastInstanceMap = new Map(
      lastInstances.map((li) => [li.recurringParentId, li._max.date])
    );

    const toCreate = [];

    for (const template of templates) {
      if (!template.recurringFrequency) continue;
      const frequency = template.recurringFrequency as
        | "monthly"
        | "weekly"
        | "yearly";

      // Punto di partenza: ultima istanza o template stesso se mai generata
      const lastDate = lastInstanceMap.get(template.id) ?? template.date;
      let nextDate = getNextRecurringDate(lastDate, frequency);

      // Crea tutte le istanze mancanti fino a oggi
      while (nextDate <= today) {
        if (template.recurringEndDate && nextDate > template.recurringEndDate)
          break;

        toCreate.push({
          amount: template.amount,
          description: template.description,
          date: nextDate,
          categoryId: template.categoryId,
          userId,
          isRecurring: false,
          recurringParentId: template.id,
        });

        nextDate = getNextRecurringDate(nextDate, frequency);
      }
    }

    if (toCreate.length > 0) {
      await ctx.db.expense.createMany({ data: toCreate });
    }

    return { created: toCreate.length };
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

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      // 1. Recupero template attivi
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

      // 2. Ottimizzazione: Recupero ultime istanze e istanze già esistenti nel mese in un colpo solo
      const [lastInstances, allExistingInMonth] = await Promise.all([
        ctx.db.expense.groupBy({
          by: ["recurringParentId"],
          where: {
            userId,
            recurringParentId: { in: templates.map((t) => t.id) },
          },
          _max: { date: true },
        }),
        ctx.db.expense.findMany({
          where: {
            userId,
            recurringParentId: { in: templates.map((t) => t.id) },
            date: { gte: monthStart, lt: monthEnd },
          },
          select: { recurringParentId: true, date: true },
        }),
      ]);

      const lastInstanceMap = new Map(
        lastInstances.map((li) => [li.recurringParentId, li._max.date])
      );
      const existingDatesMap = new Map<string, Set<number>>();
      allExistingInMonth.forEach((e) => {
        if (!e.recurringParentId) return;
        if (!existingDatesMap.has(e.recurringParentId)) {
          existingDatesMap.set(e.recurringParentId, new Set());
        }
        existingDatesMap.get(e.recurringParentId)?.add(e.date.getTime());
      });

      const upcoming = [];

      for (const template of templates) {
        if (!template.recurringFrequency) continue;
        const freq = template.recurringFrequency as
          | "monthly"
          | "weekly"
          | "yearly";

        const lastDate = lastInstanceMap.get(template.id) ?? template.date;
        let nextDate = getNextRecurringDate(lastDate, freq);
        const createdDates = existingDatesMap.get(template.id) ?? new Set();

        while (nextDate < monthEnd) {
          if (template.recurringEndDate && nextDate > template.recurringEndDate)
            break;

          if (nextDate >= monthStart) {
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
              alreadyCreated: createdDates.has(nextDate.getTime()),
            });
          }
          nextDate = getNextRecurringDate(nextDate, freq);
        }
      }

      return upcoming.sort(
        (a, b) => a.expectedDate.getTime() - b.expectedDate.getTime()
      );
    }),
});