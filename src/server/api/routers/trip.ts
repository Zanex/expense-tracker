import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { toNumber } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Stato del viaggio — derivato dalle date, mai persistito nel DB.
 * UNGA. Niente campo status. Si calcola. Dati sempre freschi.
 */
export function getTripStatus(
  startDate: Date,
  endDate: Date | null
): "upcoming" | "ongoing" | "completed" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (now < start) return "upcoming";
  if (!endDate) return "ongoing";
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return now > end ? "completed" : "ongoing";
}

/**
 * Durata viaggio in giorni (inclusi start e end).
 */
function getTripDuration(startDate: Date, endDate: Date | null): number | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const tripCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Il nome è obbligatorio")
    .max(100, "Max 100 caratteri"),
  destination: z.string().max(100, "Max 100 caratteri").optional(),
  startDate: z.date({ required_error: "La data di inizio è obbligatoria" }),
  endDate: z.date().optional(),
  budget: z
    .number()
    .positive("Il budget deve essere maggiore di zero")
    .optional(),
  coverColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore HEX non valido")
    .optional(),
  coverEmoji: z.string().max(8, "Emoji troppo lunga").optional(),
  notes: z.string().max(2000, "Max 2000 caratteri").optional(),
}).refine(
  (data) => !data.endDate || data.endDate >= data.startDate,
  {
    message: "La data di fine deve essere uguale o successiva alla data di inizio",
    path: ["endDate"],
  }
);

const tripUpdateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  destination: z.string().max(100).optional().nullable(),
  startDate: z.date().optional(),
  endDate: z.date().optional().nullable(),
  budget: z.number().positive().optional().nullable(),
  coverColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  coverEmoji: z.string().max(8).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(
  (data) =>
    !data.startDate || !data.endDate || data.endDate >= data.startDate,
  {
    message: "La data di fine deve essere uguale o successiva alla data di inizio",
    path: ["endDate"],
  }
);

// ─── Router ──────────────────────────────────────────────────────────────────

export const tripRouter = createTRPCRouter({
  /**
   * getAll — lista tutti i viaggi dell'utente.
   * Include totale speso (aggregato lato DB, non in JS).
   */
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.enum(["upcoming", "ongoing", "completed", "all"]).default("all"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trips = await ctx.db.trip.findMany({
        where: { userId },
        include: {
          _count: { select: { expenses: true } },
          expenses: {
            select: { amount: true },
          },
        },
        orderBy: { startDate: "desc" },
      });

      const mapped = trips.map((trip) => {
        const totalSpent = trip.expenses.reduce(
          (sum, e) => sum + toNumber(e.amount),
          0
        );
        const status = getTripStatus(trip.startDate, trip.endDate ?? null);
        const duration = getTripDuration(trip.startDate, trip.endDate ?? null);
        const budgetRemaining =
          trip.budget != null ? toNumber(trip.budget) - totalSpent : null;

        return {
          ...trip,
          expenses: undefined, // non esporre le singole spese nella lista
          totalSpent,
          budgetRemaining,
          status,
          duration,
          expenseCount: trip._count.expenses,
        };
      });

      // Filtro status lato JS — il calcolo è derivato, non si può fare in SQL
      if (!input?.status || input.status === "all") return mapped;
      return mapped.filter((t) => t.status === input.status);
    }),

  /**
   * getById — dettaglio viaggio con KPI completi.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trip = await ctx.db.trip.findUnique({
        where: { id: input.id, userId },
        include: {
          _count: { select: { expenses: true } },
          expenses: {
            select: { amount: true, categoryId: true },
          },
        },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      const totalSpent = trip.expenses.reduce(
        (sum, e) => sum + toNumber(e.amount),
        0
      );
      const budget = trip.budget != null ? toNumber(trip.budget) : null;
      const budgetRemaining = budget != null ? budget - totalSpent : null;
      const budgetPercentage =
        budget != null && budget > 0
          ? Math.round((totalSpent / budget) * 100)
          : null;

      return {
        ...trip,
        expenses: undefined,
        totalSpent,
        budget,
        budgetRemaining,
        budgetPercentage,
        status: getTripStatus(trip.startDate, trip.endDate ?? null),
        duration: getTripDuration(trip.startDate, trip.endDate ?? null),
        expenseCount: trip._count.expenses,
      };
    }),

  /**
   * getSummary — KPI aggregati per la dashboard del viaggio.
   * Query separata per non appesantire getById con groupBy.
   */
  getSummary: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verifica ownership
      const trip = await ctx.db.trip.findUnique({
        where: { id: input.id, userId },
        select: { id: true, budget: true, startDate: true, endDate: true },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      // Aggregazioni in parallelo — una query per i totali, una per il groupBy
      const [aggregate, byCategory] = await Promise.all([
        ctx.db.expense.aggregate({
          where: { userId, tripId: input.id },
          _sum: { amount: true },
          _count: true,
          _avg: { amount: true },
          _max: { amount: true },
        }),
        ctx.db.expense.groupBy({
          by: ["categoryId"],
          where: { userId, tripId: input.id },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
        }),
      ]);

      const totalSpent = aggregate._sum.amount?.toNumber() ?? 0;
      const expenseCount = aggregate._count;
      const avgAmount = aggregate._avg.amount?.toNumber() ?? 0;
      const maxAmount = aggregate._max.amount?.toNumber() ?? 0;
      const budget = trip.budget != null ? toNumber(trip.budget) : null;
      const budgetRemaining = budget != null ? budget - totalSpent : null;
      const budgetPercentage =
        budget != null && budget > 0
          ? Math.round((totalSpent / budget) * 100)
          : null;

      // Recupera le categorie per i nomi/colori del breakdown
      const categoryIds = byCategory.map((g) => g.categoryId);
      const categories =
        categoryIds.length > 0
          ? await ctx.db.category.findMany({
              where: { id: { in: categoryIds } },
              select: { id: true, name: true, icon: true, color: true },
            })
          : [];

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      const categoryBreakdown = byCategory
        .map((g) => {
          const cat = categoryMap.get(g.categoryId);
          if (!cat) return null;
          const catTotal = g._sum.amount?.toNumber() ?? 0;
          return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color ?? "#6366f1",
            total: catTotal,
            percentage:
              totalSpent > 0 ? Math.round((catTotal / totalSpent) * 100) : 0,
          };
        })
        .filter(Boolean);

      return {
        totalSpent,
        expenseCount,
        avgAmount,
        maxAmount,
        budget,
        budgetRemaining,
        budgetPercentage,
        categoryBreakdown,
        status: getTripStatus(trip.startDate, trip.endDate ?? null),
        duration: getTripDuration(trip.startDate, trip.endDate ?? null),
      };
    }),

  /**
   * create — crea un nuovo viaggio.
   */
  create: protectedProcedure
    .input(tripCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trip.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
      });
    }),

  /**
   * update — modifica un viaggio esistente.
   */
  update: protectedProcedure
    .input(tripUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const userId = ctx.session.user.id;

      const trip = await ctx.db.trip.findUnique({
        where: { id, userId },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      // Valida coerenza date se vengono aggiornate parzialmente
      const finalStart = data.startDate ?? trip.startDate;
      const finalEnd = data.endDate !== undefined ? data.endDate : trip.endDate;
      if (finalEnd && finalEnd < finalStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La data di fine non può essere prima della data di inizio",
        });
      }

      return ctx.db.trip.update({
        where: { id, userId },
        data,
      });
    }),

  /**
   * delete — elimina un viaggio.
   * Le spese collegate NON vengono eliminate: tripId → null (SET NULL in migration).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trip = await ctx.db.trip.findUnique({
        where: { id: input.id, userId },
        include: { _count: { select: { expenses: true } } },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      return ctx.db.trip.delete({
        where: { id: input.id, userId },
      });
    }),

  /**
   * duplicate: clona un viaggio (metadata only, senza spese).
   * Utile per viaggi ricorrenti (vacanza annuale, trasferta mensile).
   */
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        // Opzionali — se non passati usa i valori originali
        name: z.string().min(1).max(100).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const original = await ctx.db.trip.findUnique({
        where: { id: input.id, userId },
      });

      if (!original) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      // Nome di default: "Copia di <nome originale>"
      const newName = input.name ?? `Copia di ${original.name}`;

      // Date: se passate, usa quelle. Altrimenti sposta di +1 anno.
      let newStart: Date;
      let newEnd: Date | null;

      if (input.startDate) {
        newStart = input.startDate;
        newEnd = input.endDate !== undefined ? input.endDate : null;
      } else {
        newStart = new Date(original.startDate);
        newStart.setFullYear(newStart.getFullYear() + 1);
        newEnd = original.endDate
          ? new Date(new Date(original.endDate).setFullYear(original.endDate.getFullYear() + 1))
          : null;
      }

      return ctx.db.trip.create({
        data: {
          name: newName,
          destination: original.destination,
          startDate: newStart,
          endDate: newEnd,
          budget: original.budget,
          coverColor: original.coverColor,
          coverEmoji: original.coverEmoji,
          notes: original.notes,
          userId,
        },
      });
    }),

  /**
   * getExpenses — spese di un viaggio specifico, con paginazione.
   * Riusa la logica di expense.getAll ma filtrata per tripId.
   */
  getExpenses: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        categoryId: z.string().cuid().optional(),
        search: z.string().max(100).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { id, categoryId, search, page, limit } = input;
      const userId = ctx.session.user.id;
      const skip = (page - 1) * limit;

      // Verifica ownership del viaggio
      const trip = await ctx.db.trip.findUnique({
        where: { id, userId },
        select: { id: true },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      const where = {
        userId,
        tripId: id,
        ...(categoryId && { categoryId }),
        ...(search && {
          description: { contains: search, mode: "insensitive" as const },
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

  /**
   * getSpendingTimeline: raggruppa le spese del viaggio per giorno o settimana.
   * Usata dal grafico a barre nella dashboard viaggio.
   */
  getSpendingTimeline: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        // "daily" per viaggi brevi (< 14gg), "weekly" per lunghi
        granularity: z.enum(["daily", "weekly"]).default("daily"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { id, granularity } = input;
      const userId = ctx.session.user.id;

      // Verifica ownership
      const trip = await ctx.db.trip.findUnique({
        where: { id, userId },
        select: { id: true, startDate: true, endDate: true },
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Viaggio non trovato" });
      }

      // Tutte le spese del viaggio, ordinate per data
      const expenses = await ctx.db.expense.findMany({
        where: { userId, tripId: id },
        select: { date: true, amount: true },
        orderBy: { date: "asc" },
      });

      if (expenses.length === 0) return [];

      // Raggruppa per giorno o settimana
      const buckets = new Map<string, number>();

      for (const expense of expenses) {
        const d = new Date(expense.date);
        let key: string;

        if (granularity === "daily") {
          // Chiave = "gg/mm"
          key = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
        } else {
          // Chiave = inizio settimana "gg/mm"
          const dayOfWeek = d.getDay(); // 0 = dom, 1 = lun, ...
          const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
          const monday = new Date(d);
          monday.setDate(d.getDate() + diffToMonday);
          key = monday.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
        }

        buckets.set(key, (buckets.get(key) ?? 0) + expense.amount.toNumber());
      }

      return Array.from(buckets.entries()).map(([label, total]) => ({
        label,
        total: Math.round(total * 100) / 100,
      }));
    }),

});
