import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { toNumber } from "~/lib/utils";

// ─── Schemas ──────────────────────────────────────────────

const vehicleCreateSchema = z.object({
  name: z.string().min(1).max(100),
  plate: z.string().max(20).optional(),
  brand: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]).default("gasoline"),
  initialKm: z.number().int().min(0).default(0),
});

const refuelCreateSchema = z.object({
  vehicleId: z.string().cuid(),
  date: z.date(),
  liters: z.number().positive(),
  pricePerLiter: z.number().positive(),
  totalCost: z.number().positive(),
  kmAtRefuel: z.number().int().positive(),
  fullTank: z.boolean().default(true),
  notes: z.string().max(255).optional(),
});

// ─── Router ───────────────────────────────────────────────

export const vehicleRouter = createTRPCRouter({

  // Lista veicoli dell'utente
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.vehicle.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        _count: { select: { expenses: true, refuels: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  // Dettaglio veicolo con KPI
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          _count: { select: { expenses: true, refuels: true } },
        },
      });

      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      }

      return vehicle;
    }),

  // KPI aggregati del veicolo
  getSummary: protectedProcedure
    .input(z.object({ vehicleId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verifica ownership
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.vehicleId, userId },
        select: { id: true, initialKm: true },
      });

      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      }

      // Aggregazioni in parallelo
      const [expenseAggregate, refuels, lastRefuel] = await Promise.all([
        // Totale spese collegate
        ctx.db.expense.aggregate({
          where: { userId, vehicleId: input.vehicleId },
          _sum: { amount: true },
          _count: true,
        }),
        // Tutti i rifornimenti (per calcoli consumi)
        ctx.db.vehicleRefuel.findMany({
          where: { userId, vehicleId: input.vehicleId },
          orderBy: { kmAtRefuel: "asc" },
        }),
        // Ultimo rifornimento (km attuali)
        ctx.db.vehicleRefuel.findFirst({
          where: { userId, vehicleId: input.vehicleId },
          orderBy: { kmAtRefuel: "desc" },
          select: { kmAtRefuel: true, date: true },
        }),
      ]);

      const totalExpenses = expenseAggregate._sum.amount?.toNumber() ?? 0;
      const totalKm = (lastRefuel?.kmAtRefuel ?? vehicle.initialKm) - vehicle.initialKm;

      // Totale carburante
      const totalFuel = refuels.reduce((sum, r) => sum + toNumber(r.totalCost), 0);
      const totalLiters = refuels.reduce((sum, r) => sum + toNumber(r.liters), 0);

      // Costo per km (solo se abbiamo km significativi)
      const costPerKm = totalKm > 0
        ? Math.round(((totalExpenses + totalFuel) / totalKm) * 100) / 100
        : null;

      // Consumo medio L/100km (solo rifornimenti full tank)
      const fullTankRefuels = refuels.filter((r) => r.fullTank);
      let avgConsumption: number | null = null;
      if (fullTankRefuels.length >= 2) {
        const firstKm = fullTankRefuels[0]!.kmAtRefuel;
        const lastKm = fullTankRefuels[fullTankRefuels.length - 1]!.kmAtRefuel;
        const kmDriven = lastKm - firstKm;
        // Litri usati: tutti tranne il primo rifornimento (quello di "reset")
        const litersUsed = fullTankRefuels
          .slice(1)
          .reduce((sum, r) => sum + toNumber(r.liters), 0);
        if (kmDriven > 0 && litersUsed > 0) {
          avgConsumption = Math.round((litersUsed / kmDriven) * 10000) / 100;
        }
      }

      return {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalFuel: Math.round(totalFuel * 100) / 100,
        totalCost: Math.round((totalExpenses + totalFuel) * 100) / 100,
        totalKm,
        currentKm: lastRefuel?.kmAtRefuel ?? vehicle.initialKm,
        costPerKm,
        avgConsumption,
        totalLiters: Math.round(totalLiters * 100) / 100,
        refuelCount: refuels.length,
        expenseCount: expenseAggregate._count,
        lastRefuelDate: lastRefuel?.date ?? null,
      };
    }),

  // Spese mensili veicolo (per grafico)
  getMonthlyTrend: protectedProcedure
    .input(z.object({
      vehicleId: z.string().cuid(),
      months: z.number().min(1).max(24).default(12),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();

      const periods = Array.from({ length: input.months }, (_, i) => {
        let m = now.getMonth() + 1 - i;
        let y = now.getFullYear();
        while (m <= 0) { m += 12; y -= 1; }
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        const label = start.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
        return { month: m, year: y, start, end, label };
      }).reverse();

      const rangeStart = periods[0]!.start;
      const rangeEnd = periods[periods.length - 1]!.end;

      const [expenses, refuels] = await Promise.all([
        ctx.db.expense.findMany({
          where: { userId, vehicleId: input.vehicleId, date: { gte: rangeStart, lt: rangeEnd } },
          select: { amount: true, date: true },
        }),
        ctx.db.vehicleRefuel.findMany({
          where: { userId, vehicleId: input.vehicleId, date: { gte: rangeStart, lt: rangeEnd } },
          select: { totalCost: true, date: true },
        }),
      ]);

      return periods.map((p) => {
        const periodExpenses = expenses
          .filter((e) => e.date >= p.start && e.date < p.end)
          .reduce((sum, e) => sum + toNumber(e.amount), 0);
        const periodFuel = refuels
          .filter((r) => r.date >= p.start && r.date < p.end)
          .reduce((sum, r) => sum + toNumber(r.totalCost), 0);

        return {
          month: p.month,
          year: p.year,
          label: p.label,
          expenses: Math.round(periodExpenses * 100) / 100,
          fuel: Math.round(periodFuel * 100) / 100,
          total: Math.round((periodExpenses + periodFuel) * 100) / 100,
        };
      });
    }),

  // CRUD veicolo
  create: protectedProcedure
    .input(vehicleCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vehicle.create({
        data: { ...input, userId: ctx.session.user.id },
      });
    }),

  update: protectedProcedure
    .input(vehicleCreateSchema.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id, userId: ctx.session.user.id },
      });
      if (!vehicle) throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      return ctx.db.vehicle.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!vehicle) throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      return ctx.db.vehicle.delete({ where: { id: input.id } });
    }),

  // CRUD rifornimenti
  addRefuel: protectedProcedure
    .input(refuelCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.vehicleId, userId: ctx.session.user.id },
      });
      if (!vehicle) throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });

      return ctx.db.vehicleRefuel.create({
        data: { ...input, userId: ctx.session.user.id },
      });
    }),

  getRefuels: protectedProcedure
    .input(z.object({
      vehicleId: z.string().cuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const skip = (input.page - 1) * input.limit;

      const [refuels, totalCount] = await Promise.all([
        ctx.db.vehicleRefuel.findMany({
          where: { userId, vehicleId: input.vehicleId },
          orderBy: { date: "desc" },
          skip,
          take: input.limit,
        }),
        ctx.db.vehicleRefuel.count({
          where: { userId, vehicleId: input.vehicleId },
        }),
      ]);

      return {
        refuels,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / input.limit),
          currentPage: input.page,
          limit: input.limit,
        },
      };
    }),

  deleteRefuel: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const refuel = await ctx.db.vehicleRefuel.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!refuel) throw new TRPCError({ code: "NOT_FOUND", message: "Rifornimento non trovato" });
      return ctx.db.vehicleRefuel.delete({ where: { id: input.id } });
    }),
});