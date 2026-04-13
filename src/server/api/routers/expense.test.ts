import { describe, it, expect } from "vitest";
import { createCallerFactory } from "~/server/api/trpc";
import { expenseRouter } from "~/server/api/routers/expense";
import { createMockDb, createTestContext, mockUser } from "~/test/helpers";
import { TRPCError } from "@trpc/server";

// ─── Setup ────────────────────────────────────────────────

const createCaller = createCallerFactory(expenseRouter);

function makeCaller() {
  const db = createMockDb();
  const ctx = createTestContext(db);
  const caller = createCaller(ctx as never);
  return { caller, db };
}

// ─── Dati mock ────────────────────────────────────────────

const mockCategory = {
  id: "clk1f82qg000008l412345678",
  name: "Alimentari",
  icon: "🛒",
  color: "#22c55e",
  userId: mockUser.id,
  createdAt: new Date(),
};

const mockExpense = {
  id: "clk1f82qg000108l412345678",
  amount: { toNumber: () => 42.5 },
  description: "Spesa al supermercato",
  date: new Date(2026, 2, 10),
  categoryId: "clk1f82qg000008l412345678",
  userId: mockUser.id,
  category: mockCategory,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── getAll ───────────────────────────────────────────────

describe("expenseRouter.getAll", () => {
  it("restituisce le spese dell'utente con paginazione", async () => {
    const { caller, db } = makeCaller();

    db.expense.findMany.mockResolvedValue([mockExpense]);
    db.expense.count.mockResolvedValue(1);

    const result = await caller.getAll({ page: 1, limit: 10 });

    expect(result.expenses).toHaveLength(1);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.pagination.currentPage).toBe(1);
  });

  it("filtra per userId — non espone dati di altri utenti", async () => {
    const { caller, db } = makeCaller();
    db.expense.findMany.mockResolvedValue([mockExpense]);
    db.expense.count.mockResolvedValue(1);

    await caller.getAll({ page: 1, limit: 10 });

    const whereArg = db.expense.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.userId).toBe(mockUser.id);
  });

  it("applica il filtro mese/anno se passati", async () => {
    const { caller, db } = makeCaller();
    db.expense.findMany.mockResolvedValue([]);
    db.expense.count.mockResolvedValue(0);

    await caller.getAll({ month: 3, year: 2026, page: 1, limit: 10 });

    const whereArg = db.expense.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.date).toBeDefined();
    expect(whereArg?.date?.gte).toEqual(new Date(2026, 2, 1));
    expect(whereArg?.date?.lt).toEqual(new Date(2026, 3, 1));
  });

  it("applica il filtro ricerca sulla descrizione", async () => {
    const { caller, db } = makeCaller();
    db.expense.findMany.mockResolvedValue([]);
    db.expense.count.mockResolvedValue(0);

    await caller.getAll({ search: "supermercato", page: 1, limit: 10 });

    const whereArg = db.expense.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.description?.contains).toBe("supermercato");
    expect(whereArg?.description?.mode).toBe("insensitive");
  });

  it("restituisce array vuoto se nessuna spesa", async () => {
    const { caller, db } = makeCaller();
    db.expense.findMany.mockResolvedValue([]);
    db.expense.count.mockResolvedValue(0);

    const result = await caller.getAll({ page: 1, limit: 10 });

    expect(result.expenses).toHaveLength(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

// ─── getById ──────────────────────────────────────────────

describe("expenseRouter.getById", () => {
  it("restituisce la spesa se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.expense.findUnique.mockResolvedValue(mockExpense);

    const result = await caller.getById({ id: "clk1f82qg000108l412345678" });

    expect(result.id).toBe("clk1f82qg000108l412345678");
  });

  it("lancia NOT_FOUND se la spesa non esiste", async () => {
    const { caller, db } = makeCaller();
    db.expense.findUnique.mockResolvedValue(null);

    await expect(caller.getById({ id: "clk1f82qg000308l412345678" })).rejects.toThrow(
      TRPCError
    );
  });
});

// ─── create ───────────────────────────────────────────────

describe("expenseRouter.create", () => {
  it("crea la spesa con userId dell'utente autenticato", async () => {
    const { caller, db } = makeCaller();

    db.category.findUnique.mockResolvedValue(mockCategory);
    db.expense.create.mockResolvedValue({ ...mockExpense });

    await caller.create({
      amount: 42.5,
      description: "Pranzo",
      date: new Date(),
      categoryId: "clk1f82qg000008l412345678",
    });

    const createArg = db.expense.create.mock.calls[0]?.[0]?.data;
    expect(createArg?.userId).toBe(mockUser.id);
    expect(createArg?.amount).toBe(42.5);
  });

  it("lancia NOT_FOUND se la categoria non appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue(null); // categoria non trovata

    await expect(
      caller.create({
        amount: 10,
        description: "Test",
        date: new Date(),
        categoryId: "clk1f82qg000208l412345678",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("rifiuta importi negativi", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({
        amount: -5,
        description: "Negativo",
        date: new Date(),
        categoryId: "clk1f82qg000008l412345678",
      })
    ).rejects.toThrow();
  });

  it("rifiuta la descrizione vuota", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({
        amount: 10,
        description: "",
        date: new Date(),
        categoryId: "clk1f82qg000008l412345678",
      })
    ).rejects.toThrow();
  });
});

// ─── delete ───────────────────────────────────────────────

describe("expenseRouter.delete", () => {
  it("elimina la spesa se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.expense.findUnique.mockResolvedValue(mockExpense);
    db.expense.delete.mockResolvedValue(mockExpense);

    await caller.delete({ id: "clk1f82qg000108l412345678" });

    expect(db.expense.delete).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se la spesa non esiste", async () => {
    const { caller, db } = makeCaller();
    db.expense.findUnique.mockResolvedValue(null);

    await expect(caller.delete({ id: "clk1f82qg000308l412345678" })).rejects.toThrow(
      TRPCError
    );
    expect(db.expense.delete).not.toHaveBeenCalled();
  });
});