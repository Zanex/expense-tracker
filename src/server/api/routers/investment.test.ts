import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { investmentRouter, calculatePositionMetrics, isPriceStale } from "~/server/api/routers/investment";
import { createMockDb, createTestContext, mockUser } from "~/test/helpers";

// ─── Setup ────────────────────────────────────────────────

const createCaller = createCallerFactory(investmentRouter);

function makeCaller() {
  const db = createMockDb();
  const ctx = createTestContext(db);
  const caller = createCaller(ctx as never);
  return { caller, db };
}

// ─── Mock data ────────────────────────────────────────────

const mockBuyTx = {
  id: "clvq9n8k0000108l42u7m1v5c",
  investmentId: "clvq9n8k0000008l42u7m1v5c",
  type: "buy",
  quantity: { toNumber: () => 10 },
  pricePerUnit: { toNumber: () => 100 },
  fees: { toNumber: () => 5 },
  date: new Date("2025-01-01"),
  notes: null,
  userId: mockUser.id,
  createdAt: new Date(),
};

const mockInvestment = {
  id: "clvq9n8k0000008l42u7m1v5c",
  name: "Vanguard FTSE All-World",
  ticker: "VWCE.DE",
  platform: "Scalable Capital",
  type: "etf",
  currency: "EUR",
  currentPrice: { toNumber: () => 110 },
  currentPriceUpdatedAt: new Date(),
  manualPrice: null,
  currentQty: { toNumber: () => 10 },
  costBasis: { toNumber: () => 1005 },
  realizedPnL: { toNumber: () => 0 },
  totalDividends: { toNumber: () => 0 },
  totalFees: { toNumber: () => 5 },
  userId: mockUser.id,
  _count: { transactions: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [mockBuyTx],
};

// ─── calculatePositionMetrics (pure function) ─────────────

describe("calculatePositionMetrics", () => {
  it("buy: calcola costBasis e currentValue correttamente", () => {
    const txs = [{ type: "buy", quantity: 10, pricePerUnit: 100, fees: 5, date: new Date() }];
    const m = calculatePositionMetrics(txs, 120);

    expect(m.currentQty).toBe(10);
    expect(m.costBasis).toBe(1005); // 10*100 + 5
    expect(m.currentValue).toBe(1200); // 10*120
    expect(m.unrealizedPnL).toBe(195); // 1200 - 1005
  });

  it("buy + sell: calcola realizedPnL con average cost", () => {
    const txs = [
      { type: "buy", quantity: 10, pricePerUnit: 100, fees: 0, date: new Date("2025-01-01") },
      { type: "sell", quantity: 5, pricePerUnit: 130, fees: 2, date: new Date("2025-06-01") },
    ];
    const m = calculatePositionMetrics(txs, 130);

    // avg cost = 100
    // realized = 5*130 - 2 - 5*100 = 650 - 2 - 500 = 148
    expect(m.currentQty).toBe(5);
    expect(m.realizedPnL).toBe(148);
    expect(m.currentValue).toBe(650); // 5*130
  });

  it("dividend: si somma a totalDividends ma non a costBasis", () => {
    const txs = [
      { type: "buy", quantity: 10, pricePerUnit: 100, fees: 0, date: new Date("2025-01-01") },
      { type: "dividend", quantity: 10, pricePerUnit: 2, fees: 0, date: new Date("2025-06-01") },
    ];
    const m = calculatePositionMetrics(txs, 100);

    expect(m.totalDividends).toBe(20); // 10*2
    expect(m.costBasis).toBe(1000); // invariato
    expect(m.currentQty).toBe(10); // invariato
  });

  it("fee standalone: si somma a totalFees ma non tocca qty", () => {
    const txs = [
      { type: "buy", quantity: 10, pricePerUnit: 100, fees: 0, date: new Date("2025-01-01") },
      { type: "fee", quantity: 1, pricePerUnit: 20, fees: 0, date: new Date("2025-12-31") },
    ];
    const m = calculatePositionMetrics(txs, 100);

    expect(m.totalFees).toBe(20);
    expect(m.currentQty).toBe(10);
  });

  it("currentPrice null: currentValue e unrealizedPnL sono null", () => {
    const txs = [{ type: "buy", quantity: 5, pricePerUnit: 100, fees: 0, date: new Date() }];
    const m = calculatePositionMetrics(txs, null);

    expect(m.currentValue).toBeNull();
    expect(m.unrealizedPnL).toBeNull();
    expect(m.unrealizedPct).toBeNull();
  });

  it("nessuna transazione: tutto a zero", () => {
    const m = calculatePositionMetrics([], null);

    expect(m.currentQty).toBe(0);
    expect(m.costBasis).toBe(0);
    expect(m.realizedPnL).toBe(0);
  });

  it("totalReturnPct include realized + unrealized + dividendi", () => {
    // buy 10 @ 100, sell 5 @ 130 (realized +150), dividend +20, current 5@120
    const txs = [
      { type: "buy", quantity: 10, pricePerUnit: 100, fees: 0, date: new Date("2025-01-01") },
      { type: "sell", quantity: 5, pricePerUnit: 130, fees: 0, date: new Date("2025-06-01") },
      { type: "dividend", quantity: 1, pricePerUnit: 20, fees: 0, date: new Date("2025-07-01") },
    ];
    const m = calculatePositionMetrics(txs, 120);

    expect(m.realizedPnL).toBe(150); // 5*(130-100)
    expect(m.totalDividends).toBe(20);
    expect(m.currentValue).toBe(600); // 5*120
    expect(m.unrealizedPnL).toBe(100); // 600 - 500
    expect(m.totalReturn).toBe(270); // 150+20+100
  });
});

// ─── isPriceStale ─────────────────────────────────────────

describe("isPriceStale", () => {
  it("null updatedAt → stale", () => {
    expect(isPriceStale(null)).toBe(true);
  });

  it("aggiornato 30 min fa → fresco", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    expect(isPriceStale(recent)).toBe(false);
  });

  it("aggiornato 2 ore fa → stale", () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isPriceStale(old)).toBe(true);
  });
});

// ─── getAll ───────────────────────────────────────────────

describe("investmentRouter.getAll", () => {
  it("restituisce investimenti con P&L calcolato", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([mockInvestment]);

    const result = await caller.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Vanguard FTSE All-World");
    expect(result[0]?.currentQty).toBe(10);
    // costBasis = 10*100 + 5 = 1005, currentValue = 10*110 = 1100
    expect(result[0]?.costBasis).toBe(1005);
    expect(result[0]?.currentValue).toBe(1100);
  });

  it("filtra per userId", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([]);

    await caller.getAll();

    const whereArg = db.investment.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.userId).toBe(mockUser.id);
  });

  it("usa manualPrice se currentPrice è null", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([{
      ...mockInvestment,
      ticker: null,
      currentPrice: null,
      manualPrice: { toNumber: () => 95 },
    }]);

    const result = await caller.getAll();

    expect(result[0]?.currentPrice).toBe(95);
  });

  it("isPriceStale true se currentPriceUpdatedAt è null", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([{
      ...mockInvestment,
      currentPriceUpdatedAt: null,
    }]);

    const result = await caller.getAll();

    expect(result[0]?.isPriceStale).toBe(true);
  });
});

// ─── getById ──────────────────────────────────────────────

describe("investmentRouter.getById", () => {
  it("restituisce l'investimento con le transazioni", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(mockInvestment);

    const result = await caller.getById({ id: "clvq9n8k0000008l42u7m1v5c" });

    expect(result.id).toBe("clvq9n8k0000008l42u7m1v5c");
    expect(result.currentQty).toBe(10);
  });

  it("lancia NOT_FOUND se non esiste", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(null);

    await expect(caller.getById({ id: "clvq9n8k0000408l42u7m1v5c" })).rejects.toThrow(TRPCError);
  });
});

// ─── create ───────────────────────────────────────────────

describe("investmentRouter.create", () => {
  it("crea l'investimento con userId dell'utente", async () => {
    const { caller, db } = makeCaller();
    db.investment.create.mockResolvedValue({ ...mockInvestment, id: "clvq9n8k0000208l42u7m1v5c" });

    await caller.create({
      name: "iShares Core MSCI EM",
      ticker: "EIMI.L",
      platform: "Scalable Capital",
      type: "etf",
    });

    const data = db.investment.create.mock.calls[0]?.[0]?.data;
    expect(data?.userId).toBe(mockUser.id);
    expect(data?.name).toBe("iShares Core MSCI EM");
  });

  it("rifiuta nome vuoto", async () => {
    const { caller } = makeCaller();
    await expect(caller.create({ name: "", platform: "Test", type: "etf" })).rejects.toThrow();
  });

  it("rifiuta tipo non valido", async () => {
    const { caller } = makeCaller();
    // @ts-expect-error testing invalid type
    await expect(caller.create({ name: "X", platform: "Y", type: "invalid" })).rejects.toThrow();
  });
});

// ─── addTransaction ───────────────────────────────────────

describe("investmentRouter.addTransaction", () => {
  it("aggiunge un buy correttamente", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(mockInvestment);
    db.investmentTransaction.create.mockResolvedValue({ ...mockBuyTx, id: "clvq9n8k0000308l42u7m1v5c" });
    db.investmentTransaction.findMany.mockResolvedValue([mockBuyTx]);

    await caller.addTransaction({
      investmentId: "clvq9n8k0000008l42u7m1v5c",
      type: "buy",
      quantity: 5,
      pricePerUnit: 110,
      fees: 2,
      date: new Date(),
    });

    expect(db.investmentTransaction.create).toHaveBeenCalledOnce();
  });

  it("lancia BAD_REQUEST su sell con qty insufficiente", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(mockInvestment);
    // Solo 10 quote disponibili da mockBuyTx
    db.investmentTransaction.findMany.mockResolvedValue([mockBuyTx]);

    await expect(
      caller.addTransaction({
        investmentId: "inv-1",
        type: "sell",
        quantity: 999, // troppo
        pricePerUnit: 100,
        fees: 0,
        date: new Date(),
      })
    ).rejects.toThrow(TRPCError);
  });

  it("lancia NOT_FOUND se investimento non esiste", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(null);

    await expect(
      caller.addTransaction({
        investmentId: "clvq9n8k0000408l42u7m1v5c",
        type: "buy",
        quantity: 1,
        pricePerUnit: 100,
        fees: 0,
        date: new Date(),
      })
    ).rejects.toThrow(TRPCError);
  });

  it("rifiuta quantity negativa", async () => {
    const { caller } = makeCaller();
    await expect(
      caller.addTransaction({
        investmentId: "inv-1",
        type: "buy",
        quantity: -5,
        pricePerUnit: 100,
        fees: 0,
        date: new Date(),
      })
    ).rejects.toThrow();
  });
});

// ─── deleteTransaction ────────────────────────────────────

describe("investmentRouter.deleteTransaction", () => {
  it("elimina la transazione se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.investmentTransaction.findUnique.mockResolvedValue(mockBuyTx);
    db.investmentTransaction.delete.mockResolvedValue(mockBuyTx);
    db.investmentTransaction.findMany.mockResolvedValue([]);

    await caller.deleteTransaction({ id: "clvq9n8k0000108l42u7m1v5c" });

    expect(db.investmentTransaction.delete).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se transazione non esiste", async () => {
    const { caller, db } = makeCaller();
    db.investmentTransaction.findUnique.mockResolvedValue(null);

    await expect(caller.deleteTransaction({ id: "clvq9n8k0000508l42u7m1v5c" })).rejects.toThrow(TRPCError);
  });
});

// ─── setManualPrice ───────────────────────────────────────

describe("investmentRouter.setManualPrice", () => {
  it("aggiorna manualPrice e currentPriceUpdatedAt", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(mockInvestment);
    db.investment.update.mockResolvedValue({ ...mockInvestment, manualPrice: 88 });

    await caller.setManualPrice({ id: "clvq9n8k0000008l42u7m1v5c", price: 88 });

    const data = db.investment.update.mock.calls[0]?.[0]?.data;
    expect(data?.manualPrice).toBe(88);
    expect(data?.currentPriceUpdatedAt).toBeInstanceOf(Date);
  });

  it("lancia NOT_FOUND se investimento non esiste", async () => {
    const { caller, db } = makeCaller();
    db.investment.findUnique.mockResolvedValue(null);

    await expect(caller.setManualPrice({ id: "clvq9n8k0000408l42u7m1v5c", price: 50 })).rejects.toThrow(TRPCError);
  });

  it("rifiuta prezzo non positivo", async () => {
    const { caller } = makeCaller();
    await expect(caller.setManualPrice({ id: "clvq9n8k0000008l42u7m1v5c", price: -10 })).rejects.toThrow();
  });
});

// ─── getSummary ───────────────────────────────────────────

describe("investmentRouter.getSummary", () => {
  it("restituisce zero summary se nessun investimento", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([]);

    const result = await caller.getSummary();

    expect(result.totalValue).toBe(0);
    expect(result.positionCount).toBe(0);
    expect(result.allocationByPlatform).toHaveLength(0);
  });

  it("calcola totalValue e allocation correttamente", async () => {
    const { caller, db } = makeCaller();

    // VWCE: 10 quote @ 110 = 1100, costo 1005
    const inv1 = { ...mockInvestment };
    // Gimme5 piano oro: 5 grammi @ 60 = 300, costo 280
    const inv2 = {
      ...mockInvestment,
      id: "clvq9n8k0000608l42u7m1v5c",
      name: "Piano Oro",
      ticker: null,
      platform: "Gimme5",
      type: "gold",
      currentPrice: null,
      manualPrice: { toNumber: () => 60 },
      currentQty: { toNumber: () => 5 },
      costBasis: { toNumber: () => 280 },
      transactions: [
        {
          type: "buy",
          quantity: { toNumber: () => 5 },
          pricePerUnit: { toNumber: () => 56 },
          fees: { toNumber: () => 0 },
          date: new Date("2025-01-01"),
        },
      ],
      _count: { transactions: 1 },
    };

    db.investment.findMany.mockResolvedValue([inv1, inv2]);

    const result = await caller.getSummary();

    // totalValue = 1100 + 300 = 1400
    expect(result.totalValue).toBe(1400);
    expect(result.positionCount).toBe(2);
    expect(result.allocationByPlatform).toHaveLength(2);
    expect(result.allocationByPlatform[0]?.platform).toBe("Scalable Capital");
    expect(result.allocationByPlatform[0]?.percentage).toBeCloseTo(78.57, 0);
  });

  it("pricesComplete false se un investimento non ha prezzo", async () => {
    const { caller, db } = makeCaller();
    db.investment.findMany.mockResolvedValue([{
      ...mockInvestment,
      currentPrice: null,
      manualPrice: null,
    }]);

    const result = await caller.getSummary();

    expect(result.pricesComplete).toBe(false);
  });

  it("totalUnrealizedPct calcolato su costBasis aggregato", async () => {
    const { caller, db } = makeCaller();
    // costBasis 1005, value 1100 → ~+9.45%
    db.investment.findMany.mockResolvedValue([mockInvestment]);

    const result = await caller.getSummary();

    expect(result.totalUnrealizedPnL).toBe(95); // 1100 - 1005
    expect(result.totalUnrealizedPct).toBeCloseTo(9.45, 0);
  });
});
