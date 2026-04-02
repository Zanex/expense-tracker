import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// ─── Helpers ─────────────────────────────────────────────

function buildDateRange(month: number, year: number) {
  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}

function getPrevMonth(month: number, year: number) {
  return month === 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year };
}

// ─── Input schemas ────────────────────────────────────────

const monthYearInput = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
});

// ─── Router ──────────────────────────────────────────────

export const reportRouter = createTRPCRouter({
  /**
   * getSummary
   * KPI cards della dashboard: totale mese, numero spese,
   * media per spesa, categoria top — tutti con delta vs mese precedente.
   */
  getSummary: protectedProcedure
    .input(monthYearInput)
    .query(async ({ ctx, input }) => {
      const { month, year } = input;
      const userId = ctx.session.user.id;
      const prev = getPrevMonth(month, year);

      // Query parallele: mese corrente + mese precedente
      const [current, previous, categoryTotals] = await Promise.all([
        // Aggregazione mese corrente
        ctx.db.expense.aggregate({
          where: { userId, date: buildDateRange(month, year) },
          _sum: { amount: true },
          _count: true,
        }),

        // Aggregazione mese precedente (per delta)
        ctx.db.expense.aggregate({
          where: { userId, date: buildDateRange(prev.month, prev.year) },
          _sum: { amount: true },
          _count: true,
        }),

        // Totale per categoria (per trovare la categoria top)
        ctx.db.expense.groupBy({
          by: ["categoryId"],
          where: { userId, date: buildDateRange(month, year) },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 1,
        }),
      ]);

      // Recupera i dettagli della categoria top se esiste
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

      // Calcolo delta percentuale
      function calcDelta(curr: number, prev: number): number | null {
        if (prev === 0) return null;
        return Math.round(((curr - prev) / prev) * 100);
      }

      return {
        // Totale mese
        totalAmount: currentTotal,
        totalAmountDelta: calcDelta(currentTotal, previousTotal),

        // Numero spese
        expenseCount: currentCount,
        expenseCountDelta: calcDelta(currentCount, previousCount),

        // Media per spesa
        averageAmount: currentCount > 0 ? currentTotal / currentCount : 0,

        // Categoria top
        topCategory: topCategory
          ? {
              ...topCategory,
              total: categoryTotals[0]?._sum.amount?.toNumber() ?? 0,
            }
          : null,

        // Riferimento mese precedente (per etichette UI)
        previousMonth: prev,
      };
    }),

  /**
   * getByCategory
   * Totale spese per categoria nel mese selezionato.
   * Usato dal Pie chart della dashboard.
   */
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

      // Recupera i dettagli di tutte le categorie coinvolte
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

  /**
   * getMonthlyTrend
   * Totale spese per ciascuno degli ultimi N mesi.
   * Usato dal Bar chart della dashboard e dal grafico annuale in /reports.
   */
  getMonthlyTrend: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2000).max(2100),
        months: z.number().min(1).max(24).default(6), // quanti mesi a ritroso
      })
    )
    .query(async ({ ctx, input }) => {
      const { month, year, months } = input;
      const userId = ctx.session.user.id;

      // Genera la lista dei mesi da coprire (dal più vecchio al più recente)
      const periods: { month: number; year: number; label: string }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        let m = month - i;
        let y = year;

        while (m <= 0) {
          m += 12;
          y -= 1;
        }

        const label = new Date(y, m - 1, 1).toLocaleDateString("it-IT", {
          month: "short",
          year: "2-digit",
        });

        periods.push({ month: m, year: y, label });
      }

      // Query parallele per tutti i periodi
      const totals = await Promise.all(
        periods.map((p) =>
          ctx.db.expense.aggregate({
            where: { userId, date: buildDateRange(p.month, p.year) },
            _sum: { amount: true },
            _count: true,
          })
        )
      );

      return periods.map((p, i) => ({
        month: p.month,
        year: p.year,
        label: p.label,
        total: totals[i]?._sum.amount?.toNumber() ?? 0,
        count: totals[i]?._count ?? 0,
      }));
    }),

  /**
   * getHistoricTable
   * Lista mesi aggregati con totale, conteggio spese e categoria top.
   * Usato dalla tabella storica in /reports.
   */
  getHistoricTable: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(24).default(12),
        // Parte dal mese corrente a ritroso
        fromMonth: z.number().min(1).max(12),
        fromYear: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { months, fromMonth, fromYear } = input;
      const userId = ctx.session.user.id;

      // Genera i periodi
      const periods: { month: number; year: number }[] = [];
      for (let i = 0; i < months; i++) {
        let m = fromMonth - i;
        let y = fromYear;
        while (m <= 0) {
          m += 12;
          y -= 1;
        }
        periods.push({ month: m, year: y });
      }

      // Per ogni periodo: totale + categoria top
      const rows = await Promise.all(
        periods.map(async (p) => {
          const dateRange = buildDateRange(p.month, p.year);

          const [aggregate, topCategoryGroup] = await Promise.all([
            ctx.db.expense.aggregate({
              where: { userId, date: dateRange },
              _sum: { amount: true },
              _count: true,
            }),
            ctx.db.expense.groupBy({
              by: ["categoryId"],
              where: { userId, date: dateRange },
              _sum: { amount: true },
              orderBy: { _sum: { amount: "desc" } },
              take: 1,
            }),
          ]);

          // Dettagli categoria top
          const topCategoryId = topCategoryGroup[0]?.categoryId;
          const topCategory = topCategoryId
            ? await ctx.db.category.findUnique({
                where: { id: topCategoryId },
                select: { id: true, name: true, icon: true, color: true },
              })
            : null;

          const label = new Date(p.year, p.month - 1, 1).toLocaleDateString(
            "it-IT",
            { month: "long", year: "numeric" }
          );

          return {
            month: p.month,
            year: p.year,
            label,
            total: aggregate._sum.amount?.toNumber() ?? 0,
            count: aggregate._count,
            topCategory: topCategory
              ? {
                  ...topCategory,
                  total: topCategoryGroup[0]?._sum.amount?.toNumber() ?? 0,
                }
              : null,
          };
        })
      );

      return rows;
    }),

  /**
   * getAnnualComparison
   * Confronta due anni mese per mese.
   * Usato dal grouped bar chart nella pagina /reports.
   */
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

      const MONTHS_IT = [
        "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
        "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
      ];

      // Query parallele per tutti i 12 mesi di entrambi gli anni
      const [totalsA, totalsB] = await Promise.all([
        Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            ctx.db.expense.aggregate({
              where: { userId, date: buildDateRange(i + 1, yearA) },
              _sum: { amount: true },
            })
          )
        ),
        Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            ctx.db.expense.aggregate({
              where: { userId, date: buildDateRange(i + 1, yearB) },
              _sum: { amount: true },
            })
          )
        ),
      ]);

      const months = MONTHS_IT.map((label, i) => {
        const a = totalsA[i]?._sum.amount?.toNumber() ?? 0;
        const b = totalsB[i]?._sum.amount?.toNumber() ?? 0;
        const delta =
          a === 0 ? null : Math.round(((b - a) / a) * 100);

        return { month: i + 1, label, [yearA]: a, [yearB]: b, delta };
      });

      const totalA = totalsA.reduce(
        (sum, t) => sum + (t._sum.amount?.toNumber() ?? 0),
        0
      );
      const totalB = totalsB.reduce(
        (sum, t) => sum + (t._sum.amount?.toNumber() ?? 0),
        0
      );

      const annualDelta =
        totalA === 0 ? null : Math.round(((totalB - totalA) / totalA) * 100);

      return {
        months,
        summary: { totalA, totalB, annualDelta },
      };
    }),
});
