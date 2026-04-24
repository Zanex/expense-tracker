import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { toNumber } from "~/lib/utils";
import { type Prisma, type PrismaClient } from "@prisma/client";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

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
    const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
    const q = quote as unknown as { regularMarketPrice?: number; currentPrice?: number; bid?: number; ask?: number };
    return q.regularMarketPrice ?? q.currentPrice ?? q.bid ?? q.ask ?? null;
  } catch (error) {
    console.error(`[Yahoo Finance] Error fetching price for ${ticker}:`, error);
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

const transactionUpdateSchema = z.object({
  id: z.string().cuid(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  quantity: z.number().positive().optional(),
  pricePerUnit: z.number().positive().optional(),
  fees: z.number().min(0).optional(),
  date: z.date().optional(),
  notes: z.string().max(500).optional().nullable(),
});

// ─── Metrics Helper ───────────────────────────────────────

/**
 * Ricalcola le metriche di un investimento e le salva nel DB.
 * Da chiamare dopo ogni modifica alle transazioni.
 */
async function recalculateInvestmentMetrics(
  db: PrismaClient | Prisma.TransactionClient,
  investmentId: string,
  userId: string
) {
  const transactions = await db.investmentTransaction.findMany({
    where: { investmentId, userId },
    orderBy: { date: "asc" },
  });

  const metrics = calculatePositionMetrics(transactions, null);

  await db.investment.update({
    where: { id: investmentId, userId },
    data: {
      currentQty: metrics.currentQty,
      costBasis: metrics.costBasis,
      realizedPnL: metrics.realizedPnL,
      totalDividends: metrics.totalDividends,
      totalFees: metrics.totalFees,
    },
  });

  return metrics;
}

// ─── Router ──────────────────────────────────────────────

export const investmentRouter = createTRPCRouter({

  // Lista tutti gli investimenti con P&L calcolato (USA CACHE)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const investments = await ctx.db.investment.findMany({
      where: { userId },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
    });

    return investments.map((inv) => {
      const currentPrice =
        inv.currentPrice != null ? toNumber(inv.currentPrice)
        : inv.manualPrice != null ? toNumber(inv.manualPrice)
        : null;

      // Usa i valori cachati invece di ricalcolarli dalle transazioni
      const costBasis = toNumber(inv.costBasis);
      const currentQty = toNumber(inv.currentQty);
      const realizedPnL = toNumber(inv.realizedPnL);
      const totalDividends = toNumber(inv.totalDividends);
      const totalFees = toNumber(inv.totalFees);

      const r = (n: number) => Math.round(n * 100) / 100;
      const currentValue = currentPrice !== null && currentQty > 0 ? r(currentQty * currentPrice) : null;
      const unrealizedPnL = currentValue !== null ? r(currentValue - costBasis) : null;
      const unrealizedPct = costBasis > 0 && unrealizedPnL !== null ? Math.round((unrealizedPnL / costBasis) * 10000) / 100 : null;
      const totalReturn = r((unrealizedPnL ?? 0) + realizedPnL + totalDividends);
      const totalReturnPct = costBasis > 0 ? Math.round((totalReturn / costBasis) * 10000) / 100 : null;

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
        transactionCount: inv._count.transactions,
        currentQty,
        costBasis,
        currentValue,
        unrealizedPnL,
        unrealizedPct,
        realizedPnL,
        totalDividends,
        totalFees,
        totalReturn,
        totalReturnPct,
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
          _count: {
            select: { transactions: true },
          },
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
        transactionCount: inv._count.transactions,
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

      const res = await ctx.db.investmentTransaction.create({
        data: { ...input, userId },
      });

      // Aggiorna cache
      await recalculateInvestmentMetrics(ctx.db, input.investmentId, userId);

      return res;
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

      const res = await ctx.db.investmentTransaction.delete({
        where: { id: input.id, userId },
      });

      // Aggiorna cache
      await recalculateInvestmentMetrics(ctx.db, tx.investmentId, userId);

      return res;
    }),

  // Aggiorna transazione esistente
  updateTransaction: protectedProcedure
    .input(transactionUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const userId = ctx.session.user.id;

      const tx = await ctx.db.investmentTransaction.findUnique({
        where: { id, userId },
      });

      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transazione non trovata" });
      }

      const res = await ctx.db.investmentTransaction.update({
        where: { id, userId },
        data,
      });

      // Aggiorna cache dell'investimento collegato
      await recalculateInvestmentMetrics(ctx.db, tx.investmentId, userId);

      return res;
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

  // Prezzo manuale per strumenti senza ticker
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

  // ─── importBatch ─────────────────────────────────────────────────────────────
  /**
   * Importa transazioni in batch.
   * Per ogni transazione:
   *   1. Cerca una posizione esistente per (name+platform) o (isin+platform)
   *   2. Se non esiste, la crea
   *   3. Crea la transazione collegata
   * Tutto in una singola $transaction Prisma per atomicità.
   */
  importBatch: protectedProcedure
    .input(
      z.object({
        transactions: z
          .array(
            z.object({
              // Identificazione posizione
              name: z.string().min(1).max(100),
              ticker: z.string().max(20).optional().nullable(),
              isin: z.string().max(20).optional().nullable(),
              platform: z.string().min(1).max(100),
              investmentType: z.enum(["etf", "stock", "crypto", "fund", "bond", "gold", "cash"]),
              // Transazione
              txType: z.enum(["buy", "sell", "dividend", "fee"]),
              quantity: z.number().positive(),
              pricePerUnit: z.number().positive(),
              fees: z.number().min(0).default(0),
              date: z.date(),
              notes: z.string().max(500).optional().nullable(),
            })
          )
          .min(1)
          .max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
 
      // Raggruppa per (name, platform) per fare upsert efficiente
      const investmentKey = (name: string, platform: string) =>
        `${name.toLowerCase().trim()}||${platform.toLowerCase().trim()}`;
 
      // Cache locale: chiave → id investimento (evita query duplicate)
      const investmentCache = new Map<string, string>();
 
      // Pre-carica le posizioni esistenti dell'utente
      const existing = await ctx.db.investment.findMany({
        where: { userId },
        select: { id: true, name: true, platform: true, isin: true },
      });
 
      for (const inv of existing) {
        investmentCache.set(investmentKey(inv.name, inv.platform), inv.id);
        // Anche per ISIN se disponibile
        if (inv.isin) {
          investmentCache.set(`isin||${inv.isin}||${inv.platform.toLowerCase()}`, inv.id);
        }
      }
 
      let created = 0;
      let createdPositions = 0;
 
      await ctx.db.$transaction(async (tx) => {
        for (const item of input.transactions) {
          // 1. Trova o crea la posizione
          const nameKey = investmentKey(item.name, item.platform);
          const isinKey = item.isin
            ? `isin||${item.isin}||${item.platform.toLowerCase()}`
            : null;
 
          let investmentId =
            investmentCache.get(nameKey) ??
            (isinKey ? investmentCache.get(isinKey) : undefined);
 
          if (!investmentId) {
            const newInv = await tx.investment.create({
              data: {
                name: item.name,
                ticker: item.ticker ?? null,
                isin: item.isin ?? null,
                platform: item.platform,
                type: item.investmentType,
                currency: "EUR",
                userId,
              },
              select: { id: true },
            });
            investmentId = newInv.id;
            investmentCache.set(nameKey, investmentId);
            if (isinKey) investmentCache.set(isinKey, investmentId);
            createdPositions++;
          }
 
          // 2. Crea la transazione
          await tx.investmentTransaction.create({
            data: {
              investmentId,
              type: item.txType,
              quantity: item.quantity,
              pricePerUnit: item.pricePerUnit,
              fees: item.fees,
              date: item.date,
              notes: item.notes ?? null,
              userId,
            },
          });
 
          created++;
        }
      });
 
      // 3. Ricalcola metriche per tutti gli investimenti toccati
      const affectedInvestmentIds = Array.from(investmentCache.values());
      for (const invId of affectedInvestmentIds) {
        await recalculateInvestmentMetrics(ctx.db, invId, userId);
      }

      return { imported: created, createdPositions };
    }),
  
  // KPI aggregati portfolio — per la dashboard (USA CACHE)
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const investments = await ctx.db.investment.findMany({
      where: { userId },
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

    const r = (n: number) => Math.round(n * 100) / 100;

    for (const inv of investments) {
      const currentPrice =
        inv.currentPrice != null ? toNumber(inv.currentPrice)
        : inv.manualPrice != null ? toNumber(inv.manualPrice)
        : null;

      const costBasis = toNumber(inv.costBasis);
      const currentQty = toNumber(inv.currentQty);
      const realizedPnL = toNumber(inv.realizedPnL);
      const totalDividendsInv = toNumber(inv.totalDividends);

      if (currentPrice === null && currentQty > 0) pricesComplete = false;

      const currentValue = currentPrice !== null && currentQty > 0 ? r(currentQty * currentPrice) : null;
      const unrealizedPnL = currentValue !== null ? r(currentValue - costBasis) : 0;

      totalCostBasis += costBasis;
      totalUnrealizedPnL += unrealizedPnL;
      totalRealizedPnL += realizedPnL;
      totalDividends += totalDividendsInv;

      if (currentValue !== null) {
        totalValue += currentValue;
        platformMap.set(inv.platform, (platformMap.get(inv.platform) ?? 0) + currentValue);
        typeMap.set(inv.type, (typeMap.get(inv.type) ?? 0) + currentValue);
      }
    }

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
