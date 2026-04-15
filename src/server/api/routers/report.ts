import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { buildDateRange, getPrevMonth } from "~/lib/recurring";


// ─── Input schemas ────────────────────────────────────────

const monthYearInput = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
});

// ─── Router ──────────────────────────────────────────────

export const reportRouter = createTRPCRouter({
  getSummary: protectedProcedure
    .input(z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2000).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      const { month, year } = input;
      const userId = ctx.session.user.id;
      const prev = getPrevMonth(month, year);

      const [current, previous, categoryTotals] = await Promise.all([
        ctx.db.expense.aggregate({
          where: { userId, date: buildDateRange(month, year) },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.aggregate({
          where: { userId, date: buildDateRange(prev.month, prev.year) },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.groupBy({
          by: ["categoryId"],
          where: { userId, date: buildDateRange(month, year) },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 1,
        }),
      ]);

      const topCategory =
        categoryTotals[0] && categoryTotals[0]._sum.amount
          ? await ctx.db.category.findUnique({
              where: { id: categoryTotals[0].categoryId },
              select: { id: true, name: true, icon: true, color: true },
            })
          : null;

      const currentTotal = current._sum.amount?.toNumber() ?? 0;
      const previousTotal = previous._sum.amount?.toNumber() ?? 0;
      const currentCount = current._count;
      const previousCount = previous._count;

      function calcDelta(curr: number, prev: number): number | null {
        if (prev === 0) return null;
        return Math.round(((curr - prev) / prev) * 100);
      }

      return {
        totalAmount: currentTotal,
        totalAmountDelta: calcDelta(currentTotal, previousTotal),
        expenseCount: currentCount,
        expenseCountDelta: calcDelta(currentCount, previousCount),
        averageAmount: currentCount > 0 ? currentTotal / currentCount : 0,
        topCategory: topCategory
          ? {
              ...topCategory,
              total: categoryTotals[0]?._sum.amount?.toNumber() ?? 0,
            }
          : null,
        previousMonth: prev,
      };
    }),

  getByCategory: protectedProcedure
    .input(monthYearInput)
    .query(async ({ ctx, input }) => {
      const { month, year } = input;
      const userId = ctx.session.user.id;

      const grouped = await ctx.db.expense.groupBy({
        by: ["categoryId"],
        where: { userId, date: buildDateRange(month, year) },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      });

      if (grouped.length === 0) return [];

      const categoryIds = grouped.map((g) => g.categoryId);
      const categories = await ctx.db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, color: true },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      return grouped
        .map((g) => {
          const category = categoryMap.get(g.categoryId);
          if (!category) return null;
          return {
            id: category.id,
            name: category.name,
            icon: category.icon,
            color: category.color ?? "#6366f1",
            total: g._sum.amount?.toNumber() ?? 0,
          };
        })
        .filter(Boolean);
    }),

  getMonthlyTrend: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2000).max(2100),
        months: z.number().min(1).max(24).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const { month, year, months } = input;
      const userId = ctx.session.user.id;

      const periods: { month: number; year: number; label: string; start: Date; end: Date }[] = [];
      for (let i = months - 1; i >= 0; i--) {
        let m = month - i;
        let y = year;
        while (m <= 0) { m += 12; y -= 1; }
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        const label = start.toLocaleDateString("it-IT", {
          month: "short", year: "2-digit",
        });
        periods.push({ month: m, year: y, label, start, end });
      }

      const totalRangeStart = periods[0]!.start;
      const totalRangeEnd = periods[periods.length - 1]!.end;

      // Unica query per tutto il periodo
      const expenses = await ctx.db.expense.findMany({
        where: { userId, date: { gte: totalRangeStart, lt: totalRangeEnd } },
        select: { amount: true, date: true },
      });

      return periods.map((p) => {
        const periodExpenses = expenses.filter(
          (e) => e.date >= p.start && e.date < p.end
        );
        const total = periodExpenses.reduce((sum, e) => sum + e.amount.toNumber(), 0);
        return {
          month: p.month,
          year: p.year,
          label: p.label,
          total,
          count: periodExpenses.length,
        };
      });
    }),

  getHistoricTable: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(24).default(12),
        fromMonth: z.number().min(1).max(12),
        fromYear: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { months, fromMonth, fromYear } = input;
      const userId = ctx.session.user.id;

      const periods: { month: number; year: number; start: Date; end: Date; label: string }[] = [];
      for (let i = 0; i < months; i++) {
        let m = fromMonth - i;
        let y = fromYear;
        while (m <= 0) { m += 12; y -= 1; }
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        const label = start.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
        periods.push({ month: m, year: y, start, end, label });
      }

      const totalRangeStart = periods[periods.length - 1]!.start;
      const totalRangeEnd = periods[0]!.end;

      const expenses = await ctx.db.expense.findMany({
        where: { userId, date: { gte: totalRangeStart, lt: totalRangeEnd } },
        select: { amount: true, date: true, categoryId: true },
      });

      const categoryIds = [...new Set(expenses.map(e => e.categoryId))];
      const categories = await ctx.db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, color: true },
      });
      const categoryMap = new Map(categories.map(c => [c.id, c]));

      return periods.map((p) => {
        const periodExpenses = expenses.filter(e => e.date >= p.start && e.date < p.end);
        const total = periodExpenses.reduce((sum, e) => sum + e.amount.toNumber(), 0);
        
        // Calcolo top category per il periodo
        const catTotals = periodExpenses.reduce((acc, e) => {
          acc[e.categoryId] = (acc[e.categoryId] ?? 0) + e.amount.toNumber();
          return acc;
        }, {} as Record<string, number>);

        let topCatId = null;
        let maxAmount = 0;
        for (const [id, amt] of Object.entries(catTotals)) {
          if (amt > maxAmount) {
            maxAmount = amt;
            topCatId = id;
          }
        }

        const topCategory = topCatId ? categoryMap.get(topCatId) : null;

        return {
          month: p.month,
          year: p.year,
          label: p.label,
          total,
          count: periodExpenses.length,
          topCategory: topCategory ? {
            ...topCategory,
            total: maxAmount
          } : null,
        };
      });
    }),

  getAnnualComparison: protectedProcedure
    .input(
      z.object({
        yearA: z.number().min(2000).max(2100),
        yearB: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { yearA, yearB } = input;
      const userId = ctx.session.user.id;
      const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

      const [expensesA, expensesB] = await Promise.all([
        ctx.db.expense.findMany({
          where: { userId, date: { gte: new Date(yearA, 0, 1), lt: new Date(yearA + 1, 0, 1) } },
          select: { amount: true, date: true },
        }),
        ctx.db.expense.findMany({
          where: { userId, date: { gte: new Date(yearB, 0, 1), lt: new Date(yearB + 1, 0, 1) } },
          select: { amount: true, date: true },
        }),
      ]);

      const getMonthlyTotals = (exps: { amount: { toNumber: () => number }; date: Date }[]) => {
        const totals = Array(12).fill(0);
        exps.forEach(e => {
          totals[e.date.getMonth()] += e.amount.toNumber();
        });
        return totals;
      };

      const totalsA = getMonthlyTotals(expensesA);
      const totalsB = getMonthlyTotals(expensesB);

      const months = MONTHS_IT.map((label, i) => {
        const a = totalsA[i];
        const b = totalsB[i];
        const delta = a === 0 ? null : Math.round(((b - a) / a) * 100);
        return { month: i + 1, label, [yearA]: a, [yearB]: b, delta };
      });

      const totalA = totalsA.reduce((sum, t) => sum + t, 0);
      const totalB = totalsB.reduce((sum, t) => sum + t, 0);
      const annualDelta = totalA === 0 ? null : Math.round(((totalB - totalA) / totalA) * 100);

      return { months, summary: { totalA, totalB, annualDelta } };
    }),

  // ─── NEW: Budget Alerts ───────────────────────────────────────────────────
  /**
   * getBudgetAlerts
   * Restituisce le categorie con budget impostato,
   * ordinate per percentuale di utilizzo (decrescente).
   * Usato dal banner della dashboard.
   */
  getBudgetAlerts: protectedProcedure
    .input(monthYearInput)
    .query(async ({ ctx, input }) => {
      const { month, year } = input;
      const userId = ctx.session.user.id;

      // Prende solo le categorie con budget impostato
      const categories = await ctx.db.category.findMany({
        where: { userId, budget: { not: null } },
        select: { id: true, name: true, icon: true, color: true, budget: true },
      });

      if (categories.length === 0) return [];

      // Calcola spesa del mese per ogni categoria con budget
      const categoryIds = categories.map((c) => c.id);
      const grouped = await ctx.db.expense.groupBy({
        by: ["categoryId"],
        where: {
          userId,
          categoryId: { in: categoryIds },
          date: buildDateRange(month, year),
        },
        _sum: { amount: true },
      });

      const spentMap = new Map(
        grouped.map((g) => [g.categoryId, g._sum.amount?.toNumber() ?? 0])
      );

      return categories
        .map((cat) => {
          const budget = cat.budget!.toNumber();
          const spent = spentMap.get(cat.id) ?? 0;
          const percentage = Math.round((spent / budget) * 100);
          const status =
            percentage >= 100 ? "over" :
            percentage >= 80 ? "warning" : "ok";

          return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            budget,
            spent,
            percentage,
            status,
          };
        })
        // Mostra solo warning e over budget — le "ok" non disturbano
        .filter((c) => c.status !== "ok")
        .sort((a, b) => b.percentage - a.percentage);
    }),
});