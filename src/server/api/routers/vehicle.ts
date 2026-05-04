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

// ─── Router ───────────────────────────────────────────────

export const vehicleRouter = createTRPCRouter({

  // Lista veicoli dell'utente
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.vehicle.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        _count: { select: { expenses: true } },
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
          _count: { select: { expenses: true } },
        },
      });

      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      }

      return vehicle;
    }),

  // KPI aggregati del veicolo
  getSummary: protectedProcedure
    .input(z.object({
      vehicleId: z.string().cuid(),
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { vehicleId, month, year } = input;

      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: vehicleId, userId },
        select: { id: true, initialKm: true },
      });

      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Veicolo non trovato" });
      }

      const dateFilter = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };

      const expenses = await ctx.db.expense.findMany({
        where: { userId, vehicleId, date: dateFilter },
        select: {
          amount: true,
          date: true,
          liters: true,
          kmAtRefuel: true,
          fullTank: true,
        },
        orderBy: { kmAtRefuel: "asc" },
      });

      const totalExpenses = expenses
        .filter((e) => e.liters === null)
        .reduce((sum, e) => sum + toNumber(e.amount), 0);

      const refuels = expenses.filter((e) => e.liters !== null);
      const totalFuel = refuels.reduce((sum, e) => sum + toNumber(e.amount), 0);
      const totalLiters = refuels.reduce((sum, e) => sum + toNumber(e.liters), 0);

      // Km percorsi nel mese — differenza tra primo e ultimo km registrato
      const refuelsWithKm = refuels.filter((e) => e.kmAtRefuel !== null);
      const firstKmInMonth = refuelsWithKm[0]?.kmAtRefuel ?? null;
      const lastKmInMonth = refuelsWithKm.at(-1)?.kmAtRefuel ?? null;
      const totalKm = firstKmInMonth && lastKmInMonth
        ? lastKmInMonth - firstKmInMonth
        : null;

      const totalCost = totalExpenses + totalFuel;
      const costPerKm = totalKm && totalKm > 0
        ? Math.round((totalCost / totalKm) * 100) / 100
        : null;

      // Consumo medio nel mese (solo full tank)
      const fullTankRefuels = refuelsWithKm.filter((e) => e.fullTank);
      let avgConsumption: number | null = null;
      if (fullTankRefuels.length >= 2) {
        const first = fullTankRefuels[0]!.kmAtRefuel!;
        const last = fullTankRefuels.at(-1)!.kmAtRefuel!;
        const kmDriven = last - first;
        const litersUsed = fullTankRefuels
          .slice(1)
          .reduce((sum, e) => sum + toNumber(e.liters), 0);
        if (kmDriven > 0 && litersUsed > 0) {
          avgConsumption = Math.round((litersUsed / kmDriven) * 10000) / 100;
        }
      }

      return {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalFuel: Math.round(totalFuel * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalKm,
        currentKm: lastKmInMonth,
        costPerKm,
        avgConsumption,
        totalLiters: Math.round(totalLiters * 100) / 100,
        refuelCount: refuels.length,
        expenseCount: expenses.filter((e) => e.liters === null).length,
        lastRefuelDate: refuelsWithKm.at(-1)?.date ?? null,
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

      const expenses = await ctx.db.expense.findMany({
        where: {
          userId,
          vehicleId: input.vehicleId,
          date: { gte: rangeStart, lt: rangeEnd },
        },
        select: { amount: true, date: true, liters: true },
      });

      return periods.map((p) => {
        const periodExpenses = expenses.filter((e) => e.date >= p.start && e.date < p.end);
        const fuel = periodExpenses
          .filter((e) => e.liters !== null)
          .reduce((sum, e) => sum + toNumber(e.amount), 0);
        const other = periodExpenses
          .filter((e) => e.liters === null)
          .reduce((sum, e) => sum + toNumber(e.amount), 0);

        return {
          month: p.month,
          year: p.year,
          label: p.label,
          fuel: Math.round(fuel * 100) / 100,
          expenses: Math.round(other * 100) / 100,
          total: Math.round((fuel + other) * 100) / 100,
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

});