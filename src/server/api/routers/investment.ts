import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { toNumber } from "~/lib/utils";

// ─── Constants ────────────────────────────────────────────

const PRICE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora

// ─── P&L Calculation ─────────────────────────────────────
// Metodo average cost. Esportata per i test.

interface TxForCalc {
  type: string;
  quantity: { toNumber: () => number } | number;
  pricePerUnit: { toNumber: () => number } | number;
  fees: { toNumber: () => number } | number;
  date: Date;
}

export function calculatePositionMetrics(
  transactions: TxForCalc[],
  currentPrice: number | null
) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentQty = 0;
  let totalCostBasis = 0;
  let avgCostPerUnit = 0;
  let realizedPnL = 0;
  let totalDividends = 0;
  let totalFees = 0;

  for (const tx of sorted) {
    const qty = toNumber(tx.quantity);
    const price = toNumber(tx.pricePerUnit);
    const fee = toNumber(tx.fees);

    if (tx.type === "buy") {
      const txCost = qty * price + fee;
      totalCostBasis += txCost;
      currentQty += qty;
      avgCostPerUnit = currentQty > 0 ? totalCostBasis / currentQty : 0;
      totalFees += fee;
    } else if (tx.type === "sell") {
      const costOfSold = avgCostPerUnit * qty;
      realizedPnL += qty * price - fee - costOfSold;
      totalCostBasis -= costOfSold;
      currentQty -= qty;
      totalFees += fee;
    } else if (tx.type === "dividend") {
      // quantity = quote, pricePerUnit = dividendo per quota
      totalDividends += qty * price - fee;
      totalFees += fee;
    } else if (tx.type === "fee") {
      // Commissione standalone (es. custodia annuale)
      totalFees += qty * price;
    }
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  const r8 = (n: number) => Math.round(n * 1e8) / 1e8;

  const currentValue =
    currentPrice !== null && currentQty > 0 ? r(currentQty * currentPrice) : null;

  const unrealizedPnL =
    currentValue !== null ? r(currentValue - totalCostBasis) : null;

  const unrealizedPct =
    totalCostBasis > 0 && unrealizedPnL !== null
      ? Math.round((unrealizedPnL / totalCostBasis) * 10000) / 100
      : null;

  const totalReturn = r((unrealizedPnL ?? 0) + realizedPnL + totalDividends);

  const totalReturnPct =
    totalCostBasis > 0
      ? Math.round((totalReturn / totalCostBasis) * 10000) / 100
      : null;

  return {
    currentQty: r8(currentQty),
    costBasis: r(totalCostBasis),
    currentValue,
    unrealizedPnL,
    unrealizedPct,
    realizedPnL: r(realizedPnL),
    totalDividends: r(totalDividends),
    totalFees: r(totalFees),
    totalReturn,
    totalReturnPct,
  };
}

// ─── Yahoo Finance helper ─────────────────────────────────

export function isPriceStale(updatedAt: Date | null): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > PRICE_CACHE_TTL_MS;
}

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const yahooFinance = (await import("yahoo-finance2")).default;
    const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
    return (quote as { regularMarketPrice?: number }).regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

// ─── Zod Schemas ─────────────────────────────────────────

const INVESTMENT_TYPES = ["etf", "stock", "crypto", "fund", "bond", "gold", "cash"] as const;
const TRANSACTION_TYPES = ["buy", "sell", "dividend", "fee"] as const;

const investmentCreateSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio").max(100),
  ticker: z.string().max(20).optional(),
  platform: z.string().min(1, "Piattaforma obbligatoria").max(100),
  type: z.enum(INVESTMENT_TYPES),
  currency: z.string().length(3).default("EUR"),
  manualPrice: z.number().positive().optional(),
});

const investmentUpdateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  ticker: z.string().max(20).optional().nullable(),
  platform: z.string().min(1).max(100).optional(),
  type: z.enum(INVESTMENT_TYPES).optional(),
  currency: z.string().length(3).optional(),
  manualPrice: z.number().positive().optional().nullable(),
});

const transactionCreateSchema = z.object({
  investmentId: z.string().cuid(),
  type: z.enum(TRANSACTION_TYPES),
  quantity: z.number().positive("Quantità deve essere positiva"),
  pricePerUnit: z.number().positive("Prezzo deve essere positivo"),
  fees: z.number().min(0).default(0),
  date: z.date(),
  notes: z.string().max(500).optional(),
});

// ─── Router ──────────────────────────────────────────────

export const investmentRouter = createTRPCRouter({

  // Lista tutti gli investimenti con P&L calcolato
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const investments = await ctx.db.investment.findMany({
      where: { userId },
      include: {
        transactions: { orderBy: { date: "asc" } },
      },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
    });

    return investments.map((inv) => {
      const currentPrice =
        inv.currentPrice != null ? toNumber(inv.currentPrice)
        : inv.manualPrice != null ? toNumber(inv.manualPrice)
        : null;

      const metrics = calculatePositionMetrics(inv.transactions, currentPrice);

      return {
        id: inv.id,
        name: inv.name,
        ticker: inv.ticker,
        platform: inv.platform,
        type: inv.type,
        currency: inv.currency,
        currentPrice,
        currentPriceUpdatedAt: inv.currentPriceUpdatedAt,
        manualPrice: inv.manualPrice != null ? toNumber(inv.manualPrice) : null,
        isPriceStale: isPriceStale(inv.currentPriceUpdatedAt),
        hasTicker: !!inv.ticker,
        transactionCount: inv.transactions.length,
        ...metrics,
      };
    });
  }),

  // Dettaglio singola posizione + tutte le transazioni
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const inv = await ctx.db.investment.findUnique({
        where: { id: input.id, userId },
        include: {
          transactions: { orderBy: { date: "asc" } },
        },
      });

      if (!inv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Investimento non trovato" });
      }

      const currentPrice =
        inv.currentPrice != null ? toNumber(inv.currentPrice)
        : inv.manualPrice != null ? toNumber(inv.manualPrice)
        : null;

      const metrics = calculatePositionMetrics(inv.transactions, currentPrice);

      return {
        ...inv,
        currentPrice,
        manualPrice: inv.manualPrice != null ? toNumber(inv.manualPrice) : null,
        isPriceStale: isPriceStale(inv.currentPriceUpdatedAt),
        hasTicker: !!inv.ticker,
        ...metrics,
      };
    }),

  // Crea nuova posizione
  create: protectedProcedure
    .input(investmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.investment.create({
        data: { ...input, userId: ctx.session.user.id },
      });
    }),

  // Aggiorna metadati posizione
  update: protectedProcedure
    .input(investmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const userId = ctx.session.user.id;

      const inv = await ctx.db.investment.findUnique({
        where: { id, userId },
      });

      if (!inv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Investimento non trovato" });
      }

      return ctx.db.investment.update({ where: { id, userId }, data });
    }),

  // Elimina posizione + cascade transazioni
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const inv = await ctx.db.investment.findUnique({
        where: { id: input.id, userId },
      });

      if (!inv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Investimento non trovato" });
      }

      return ctx.db.investment.delete({ where: { id: input.id, userId } });
    }),

  // Aggiunge transazione (buy/sell/dividend/fee)
  addTransaction: protectedProcedure
    .input(transactionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const inv = await ctx.db.investment.findUnique({
        where: { id: input.investmentId, userId },
      });

      if (!inv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Investimento non trovato" });
      }

      // Valida sell: quantità disponibile sufficiente?
      if (input.type === "sell") {
        const transactions = await ctx.db.investmentTransaction.findMany({
          where: { investmentId: input.investmentId, userId },
        });
        const { currentQty } = calculatePositionMetrics(transactions, null);
        if (input.quantity > currentQty + 1e-8) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quantità insufficiente. Disponibili: ${currentQty}`,
          });
        }
      }

      return ctx.db.investmentTransaction.create({
        data: { ...input, userId },
      });
    }),

  // Elimina transazione
  deleteTransaction: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const tx = await ctx.db.investmentTransaction.findUnique({
        where: { id: input.id, userId },
      });

      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transazione non trovata" });
      }

      return ctx.db.investmentTransaction.delete({
        where: { id: input.id, userId },
      });
    }),

  // Fetch prezzi da Yahoo Finance (solo ticker non aggiornati nell'ultima ora)
  refreshPrices: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const investments = await ctx.db.investment.findMany({
      where: { userId, ticker: { not: null } },
      select: { id: true, ticker: true, currentPriceUpdatedAt: true },
    });

    const stale = investments.filter((inv) => isPriceStale(inv.currentPriceUpdatedAt));

    if (stale.length === 0) return { refreshed: 0, failed: 0, skipped: investments.length };

    let refreshed = 0;
    let failed = 0;

    // Batch da 5 per non spammare Yahoo
    for (let i = 0; i < stale.length; i += 5) {
      const chunk = stale.slice(i, i + 5);
      await Promise.all(
        chunk.map(async (inv) => {
          const price = await fetchYahooPrice(inv.ticker!);
          if (price !== null) {
            await ctx.db.investment.update({
              where: { id: inv.id },
              data: { currentPrice: price, currentPriceUpdatedAt: new Date() },
            });
            refreshed++;
          } else {
            failed++;
          }
        })
      );
    }

    return { refreshed, failed, skipped: investments.length - stale.length };
  }),

  // Prezzo manuale per strumenti senza ticker (GimmeS, fondi proprietary...)
  setManualPrice: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      price: z.number().positive("Il prezzo deve essere positivo"),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const inv = await ctx.db.investment.findUnique({
        where: { id: input.id, userId },
      });

      if (!inv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Investimento non trovato" });
      }

      return ctx.db.investment.update({
        where: { id: input.id, userId },
        data: { manualPrice: input.price, currentPriceUpdatedAt: new Date() },
      });
    }),

  // KPI aggregati portfolio — per la dashboard
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const investments = await ctx.db.investment.findMany({
      where: { userId },
      include: { transactions: true },
    });

    if (investments.length === 0) {
      return {
        totalValue: 0,
        totalCostBasis: 0,
        totalUnrealizedPnL: 0,
        totalUnrealizedPct: null,
        totalRealizedPnL: 0,
        totalDividends: 0,
        totalReturn: 0,
        totalReturnPct: null,
        allocationByPlatform: [] as { platform: string; value: number; percentage: number }[],
        allocationByType: [] as { type: string; value: number; percentage: number }[],
        positionCount: 0,
        pricesComplete: true,
      };
    }

    let totalValue = 0;
    let totalCostBasis = 0;
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;
    let totalDividends = 0;
    let pricesComplete = true;

    const platformMap = new Map<string, number>();
    const typeMap = new Map<string, number>();

    for (const inv of investments) {
      const currentPrice =
        inv.currentPrice != null ? toNumber(inv.currentPrice)
        : inv.manualPrice != null ? toNumber(inv.manualPrice)
        : null;

      const hasBuys = inv.transactions.some((t) => t.type === "buy");
      if (currentPrice === null && hasBuys) pricesComplete = false;

      const m = calculatePositionMetrics(inv.transactions, currentPrice);

      totalCostBasis += m.costBasis;
      totalUnrealizedPnL += m.unrealizedPnL ?? 0;
      totalRealizedPnL += m.realizedPnL;
      totalDividends += m.totalDividends;

      if (m.currentValue !== null) {
        totalValue += m.currentValue;
        platformMap.set(inv.platform, (platformMap.get(inv.platform) ?? 0) + m.currentValue);
        typeMap.set(inv.type, (typeMap.get(inv.type) ?? 0) + m.currentValue);
      }
    }

    const r = (n: number) => Math.round(n * 100) / 100;

    const totalUnrealizedPct =
      totalCostBasis > 0
        ? Math.round((totalUnrealizedPnL / totalCostBasis) * 10000) / 100
        : null;

    const totalReturn = r(totalUnrealizedPnL + totalRealizedPnL + totalDividends);
    const totalReturnPct =
      totalCostBasis > 0
        ? Math.round((totalReturn / totalCostBasis) * 10000) / 100
        : null;

    const allocationByPlatform = Array.from(platformMap.entries())
      .map(([platform, value]) => ({
        platform,
        value: r(value),
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const allocationByType = Array.from(typeMap.entries())
      .map(([type, value]) => ({
        type,
        value: r(value),
        percentage: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalValue: r(totalValue),
      totalCostBasis: r(totalCostBasis),
      totalUnrealizedPnL: r(totalUnrealizedPnL),
      totalUnrealizedPct,
      totalRealizedPnL: r(totalRealizedPnL),
      totalDividends: r(totalDividends),
      totalReturn,
      totalReturnPct,
      allocationByPlatform,
      allocationByType,
      positionCount: investments.length,
      pricesComplete,
    };
  }),
});
