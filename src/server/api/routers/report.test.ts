import { describe, it, expect } from "vitest";
import { createCallerFactory } from "~/server/api/trpc";
import { reportRouter } from "~/server/api/routers/report";
import { createMockDb, createTestContext } from "~/test/helpers";

// ─── Setup ────────────────────────────────────────────────

const createCaller = createCallerFactory(reportRouter);

function makeCaller() {
  const db = createMockDb();
  const ctx = createTestContext(db);
  const caller = createCaller(ctx as never);
  return { caller, db };
}

// ─── getSummary ───────────────────────────────────────────

describe("reportRouter.getSummary", () => {
  it("restituisce totalAmount e expenseCount corretti", async () => {
    const { caller, db } = makeCaller();

    // Mese corrente: €150, 3 spese
    db.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 150 } }, _count: 3 })
      // Mese precedente: €100, 2 spese
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 100 } }, _count: 2 });

    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.totalAmount).toBe(150);
    expect(result.expenseCount).toBe(3);
  });

  it("calcola media per spesa correttamente", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 90 } }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 });

    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.averageAmount).toBe(30); // 90 / 3
  });

  it("calcola il delta percentuale vs mese precedente", async () => {
    const { caller, db } = makeCaller();

    // Corrente: €150 → Precedente: €100 → delta = +50%
    db.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 150 } }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 100 } }, _count: 2 });

    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.totalAmountDelta).toBe(50);
  });

  it("restituisce delta null se il mese precedente è zero", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 100 } }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 0 } }, _count: 0 });

    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.totalAmountDelta).toBeNull();
  });

  it("gestisce il cambio anno correttamente (gennaio → dicembre precedente)", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 0 } },
      _count: 0,
    });
    db.expense.groupBy.mockResolvedValue([]);

    // Gennaio 2026: il mese precedente deve essere Dicembre 2025
    await caller.getSummary({ month: 1, year: 2026 });

    // La seconda chiamata aggregate è per il mese precedente
    const secondCall = db.expense.aggregate.mock.calls[1]?.[0]?.where?.date;
    expect(secondCall?.gte).toEqual(new Date(2025, 11, 1)); // 1 Dic 2025
    expect(secondCall?.lt).toEqual(new Date(2026, 0, 1));  // 1 Gen 2026
  });

  it("restituisce topCategory se esiste", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 200 } }, _count: 5 })
      .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 150 } }, _count: 3 });

    db.expense.groupBy.mockResolvedValue([
      { categoryId: "cat-1", _sum: { amount: { toNumber: () => 120 } } },
    ]);

    db.category.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Alimentari",
      icon: "🛒",
      color: "#22c55e",
    });

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.topCategory?.name).toBe("Alimentari");
    expect(result.topCategory?.total).toBe(120);
  });

  it("restituisce topCategory null se nessuna spesa", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 0 } },
      _count: 0,
    });
    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ month: 3, year: 2026 });

    expect(result.topCategory).toBeNull();
  });
});

// ─── getMonthlyTrend ──────────────────────────────────────

describe("reportRouter.getMonthlyTrend", () => {
  it("restituisce N periodi mensili", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 100 } },
      _count: 2,
    });

    const result = await caller.getMonthlyTrend({
      month: 3,
      year: 2026,
      months: 6,
    });

    expect(result).toHaveLength(6);
  });

  it("il totale di ogni periodo è 0 se nessuna spesa", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: 0,
    });

    const result = await caller.getMonthlyTrend({
      month: 3,
      year: 2026,
      months: 3,
    });

    result.forEach((period) => expect(period.total).toBe(0));
  });

  it("gestisce correttamente il cambio anno nei periodi", async () => {
    const { caller, db } = makeCaller();

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 50 } },
      _count: 1,
    });

    // Marzo 2026, 6 mesi → dovrebbe includere Ottobre 2025
    const result = await caller.getMonthlyTrend({
      month: 3,
      year: 2026,
      months: 6,
    });

    const years = result.map((r) => r.year);
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  });
});