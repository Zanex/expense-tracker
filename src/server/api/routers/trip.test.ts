import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { tripRouter, getTripStatus } from "~/server/api/routers/trip";
import { createMockDb, createTestContext, mockUser } from "~/test/helpers";

// ─── Setup ────────────────────────────────────────────────────────────────────

const createCaller = createCallerFactory(tripRouter);

function makeCaller() {
  const db = createMockDb();
  const ctx = createTestContext(db);
  const caller = createCaller(ctx as never);
  return { caller, db };
}

// ─── Dati mock ────────────────────────────────────────────────────────────────

const TODAY = new Date();
const YESTERDAY = new Date(TODAY);
YESTERDAY.setDate(YESTERDAY.getDate() - 1);
const TOMORROW = new Date(TODAY);
TOMORROW.setDate(TOMORROW.getDate() + 1);
const NEXT_WEEK = new Date(TODAY);
NEXT_WEEK.setDate(NEXT_WEEK.getDate() + 7);
const LAST_WEEK = new Date(TODAY);
LAST_WEEK.setDate(LAST_WEEK.getDate() - 7);

const mockTrip = {
  id: "clk1trip0000000001",
  name: "Vacanza Roma",
  destination: "Roma, Italia",
  startDate: YESTERDAY,
  endDate: TOMORROW,
  budget: { toNumber: () => 500 },
  coverColor: "#6366f1",
  coverEmoji: "🏛️",
  notes: null,
  userId: mockUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { expenses: 3 },
  expenses: [
    { amount: { toNumber: () => 50 } },
    { amount: { toNumber: () => 80 } },
    { amount: { toNumber: () => 30 } },
  ],
};

// ─── getTripStatus ────────────────────────────────────────────────────────────

describe("getTripStatus", () => {
  it("restituisce 'upcoming' se il viaggio non è ancora iniziato", () => {
    expect(getTripStatus(TOMORROW, NEXT_WEEK)).toBe("upcoming");
  });

  it("restituisce 'ongoing' se il viaggio è in corso con data fine", () => {
    expect(getTripStatus(YESTERDAY, TOMORROW)).toBe("ongoing");
  });

  it("restituisce 'ongoing' se il viaggio è in corso senza data fine", () => {
    expect(getTripStatus(YESTERDAY, null)).toBe("ongoing");
  });

  it("restituisce 'completed' se il viaggio è terminato", () => {
    expect(getTripStatus(LAST_WEEK, YESTERDAY)).toBe("completed");
  });

  it("restituisce 'ongoing' se oggi coincide con startDate", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(getTripStatus(today, TOMORROW)).toBe("ongoing");
  });

  it("restituisce 'ongoing' se oggi coincide con endDate", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(getTripStatus(YESTERDAY, today)).toBe("ongoing");
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe("tripRouter.getAll", () => {
  it("restituisce i viaggi dell'utente con totalSpent calcolato", async () => {
    const { caller, db } = makeCaller();
    db.trip.findMany.mockResolvedValue([mockTrip]);

    const result = await caller.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]?.totalSpent).toBe(160); // 50 + 80 + 30
  });

  it("filtra per userId — non espone viaggi di altri utenti", async () => {
    const { caller, db } = makeCaller();
    db.trip.findMany.mockResolvedValue([]);

    await caller.getAll();

    const whereArg = db.trip.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.userId).toBe(mockUser.id);
  });

  it("non espone le singole spese nel risultato", async () => {
    const { caller, db } = makeCaller();
    db.trip.findMany.mockResolvedValue([mockTrip]);

    const result = await caller.getAll();

    expect((result[0] as Record<string, unknown>)?.expenses).toBeUndefined();
  });

  it("calcola budgetRemaining correttamente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findMany.mockResolvedValue([mockTrip]);

    const result = await caller.getAll();

    expect(result[0]?.budgetRemaining).toBe(340); // 500 - 160
  });

  it("restituisce budgetRemaining null se budget non impostato", async () => {
    const { caller, db } = makeCaller();
    db.trip.findMany.mockResolvedValue([{ ...mockTrip, budget: null }]);

    const result = await caller.getAll();

    expect(result[0]?.budgetRemaining).toBeNull();
  });

  it("filtra correttamente per status 'upcoming'", async () => {
    const { caller, db } = makeCaller();
    const upcomingTrip = { ...mockTrip, startDate: NEXT_WEEK, endDate: null };
    db.trip.findMany.mockResolvedValue([mockTrip, upcomingTrip]);

    const result = await caller.getAll({ status: "upcoming" });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("upcoming");
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe("tripRouter.getById", () => {
  it("restituisce il viaggio se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(mockTrip);

    const result = await caller.getById({ id: "clk1trip0000000001" });

    expect(result.id).toBe("clk1trip0000000001");
    expect(result.name).toBe("Vacanza Roma");
  });

  it("lancia NOT_FOUND se il viaggio non esiste", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(null);

    await expect(caller.getById({ id: "clk1trip0000000099" })).rejects.toThrow(
      TRPCError
    );
  });

  it("calcola budgetPercentage correttamente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(mockTrip);

    const result = await caller.getById({ id: "clk1trip0000000001" });

    // 160 / 500 = 32%
    expect(result.budgetPercentage).toBe(32);
  });
});

// ─── getSummary ───────────────────────────────────────────────────────────────

describe("tripRouter.getSummary", () => {
  it("restituisce i KPI aggregati del viaggio", async () => {
    const { caller, db } = makeCaller();

    db.trip.findUnique.mockResolvedValue({
      id: "clk1trip0000000001",
      budget: { toNumber: () => 500 },
      startDate: YESTERDAY,
      endDate: TOMORROW,
    });

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 160 } },
      _count: 3,
      _avg: { amount: { toNumber: () => 53.33 } },
      _max: { amount: { toNumber: () => 80 } },
    });

    db.expense.groupBy.mockResolvedValue([
      { categoryId: "cat-1", _sum: { amount: { toNumber: () => 100 } } },
      { categoryId: "cat-2", _sum: { amount: { toNumber: () => 60 } } },
    ]);

    db.category.findMany.mockResolvedValue([
      { id: "cat-1", name: "Cibo", icon: "🍕", color: "#ef4444" },
      { id: "cat-2", name: "Trasporti", icon: "🚗", color: "#f97316" },
    ]);

    const result = await caller.getSummary({ id: "clk1trip0000000001" });

    expect(result.totalSpent).toBe(160);
    expect(result.expenseCount).toBe(3);
    expect(result.budgetRemaining).toBe(340);
    expect(result.budgetPercentage).toBe(32);
    expect(result.categoryBreakdown).toHaveLength(2);
    expect(result.categoryBreakdown[0]?.percentage).toBe(63); // 100/160
  });

  it("lancia NOT_FOUND se il viaggio non appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(null);

    await expect(
      caller.getSummary({ id: "clk1trip0000000099" })
    ).rejects.toThrow(TRPCError);
  });

  it("restituisce budgetPercentage null se budget non impostato", async () => {
    const { caller, db } = makeCaller();

    db.trip.findUnique.mockResolvedValue({
      id: "clk1trip0000000001",
      budget: null,
      startDate: YESTERDAY,
      endDate: TOMORROW,
    });

    db.expense.aggregate.mockResolvedValue({
      _sum: { amount: { toNumber: () => 50 } },
      _count: 1,
      _avg: { amount: { toNumber: () => 50 } },
      _max: { amount: { toNumber: () => 50 } },
    });

    db.expense.groupBy.mockResolvedValue([]);

    const result = await caller.getSummary({ id: "clk1trip0000000001" });

    expect(result.budget).toBeNull();
    expect(result.budgetPercentage).toBeNull();
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("tripRouter.create", () => {
  it("crea il viaggio con userId dell'utente autenticato", async () => {
    const { caller, db } = makeCaller();
    db.trip.create.mockResolvedValue({ ...mockTrip, id: "clk1trip0000000002" });

    await caller.create({
      name: "Weekend Milano",
      startDate: TOMORROW,
      endDate: NEXT_WEEK,
    });

    const createArg = db.trip.create.mock.calls[0]?.[0]?.data;
    expect(createArg?.userId).toBe(mockUser.id);
    expect(createArg?.name).toBe("Weekend Milano");
  });

  it("rifiuta un nome vuoto", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "", startDate: TOMORROW })
    ).rejects.toThrow();
  });

  it("rifiuta endDate precedente a startDate", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", startDate: TOMORROW, endDate: YESTERDAY })
    ).rejects.toThrow();
  });

  it("rifiuta un budget negativo", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", startDate: TOMORROW, budget: -100 })
    ).rejects.toThrow();
  });

  it("rifiuta un colore HEX non valido", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", startDate: TOMORROW, coverColor: "rosso" })
    ).rejects.toThrow();
  });

  it("accetta un viaggio senza endDate (viaggio senza data fine)", async () => {
    const { caller, db } = makeCaller();
    db.trip.create.mockResolvedValue({ ...mockTrip, endDate: null });

    await expect(
      caller.create({ name: "Nomade", startDate: TOMORROW })
    ).resolves.not.toThrow();
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("tripRouter.update", () => {
  it("aggiorna i campi del viaggio", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(mockTrip);
    db.trip.update.mockResolvedValue({ ...mockTrip, name: "Roma Aggiornata" });

    await caller.update({ id: "clk1trip0000000001", name: "Roma Aggiornata" });

    expect(db.trip.update).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se il viaggio non esiste", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(null);

    await expect(
      caller.update({ id: "clk1trip0000000099", name: "X" })
    ).rejects.toThrow(TRPCError);
  });

  it("rifiuta se la nuova endDate è prima della startDate esistente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(mockTrip); // startDate = YESTERDAY

    await expect(
      caller.update({
        id: "clk1trip0000000001",
        endDate: LAST_WEEK, // prima di YESTERDAY
      })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("tripRouter.delete", () => {
  it("elimina il viaggio", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(mockTrip);
    db.trip.delete.mockResolvedValue(mockTrip);

    await caller.delete({ id: "clk1trip0000000001" });

    expect(db.trip.delete).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se il viaggio non esiste", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(null);

    await expect(
      caller.delete({ id: "clk1trip0000000099" })
    ).rejects.toThrow(TRPCError);

    expect(db.trip.delete).not.toHaveBeenCalled();
  });
});

// ─── getExpenses ──────────────────────────────────────────────────────────────

describe("tripRouter.getExpenses", () => {
  it("restituisce le spese filtrate per tripId", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue({ id: "clk1trip0000000001" });
    db.expense.findMany.mockResolvedValue([]);
    db.expense.count.mockResolvedValue(0);

    await caller.getExpenses({ id: "clk1trip0000000001", page: 1, limit: 10 });

    const whereArg = db.expense.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.tripId).toBe("clk1trip0000000001");
    expect(whereArg?.userId).toBe(mockUser.id);
  });

  it("lancia NOT_FOUND se il viaggio non appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.trip.findUnique.mockResolvedValue(null);

    await expect(
      caller.getExpenses({ id: "clk1trip0000000099", page: 1, limit: 10 })
    ).rejects.toThrow(TRPCError);
  });
});
