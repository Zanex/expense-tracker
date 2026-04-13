import { describe, it, expect } from "vitest";
import { createCallerFactory } from "~/server/api/trpc";
import { categoryRouter } from "~/server/api/routers/category";
import { createMockDb, createTestContext, mockUser } from "~/test/helpers";
import { TRPCError } from "@trpc/server";

// ─── Setup ────────────────────────────────────────────────

const createCaller = createCallerFactory(categoryRouter);

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
  budget: null,
  userId: mockUser.id,
  createdAt: new Date(),
  _count: { expenses: 3 },
  expenses: [
    { amount: { toNumber: () => 20 } },
    { amount: { toNumber: () => 15.5 } },
  ],
};

// ─── getAll ───────────────────────────────────────────────

describe("categoryRouter.getAll", () => {
  it("restituisce le categorie con spentThisMonth calcolato", async () => {
    const { caller, db } = makeCaller();
    db.category.findMany.mockResolvedValue([mockCategory]);

    const result = await caller.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]?.spentThisMonth).toBe(35.5); // 20 + 15.5
  });

  it("filtra per userId — non espone categorie di altri", async () => {
    const { caller, db } = makeCaller();
    db.category.findMany.mockResolvedValue([]);

    await caller.getAll();

    const whereArg = db.category.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.userId).toBe(mockUser.id);
  });

  it("non espone le singole spese nel risultato", async () => {
    const { caller, db } = makeCaller();
    db.category.findMany.mockResolvedValue([mockCategory]);

    const result = await caller.getAll();

    expect((result[0] as Record<string, unknown>)?.expenses).toBeUndefined();
  });
});

// ─── getById ──────────────────────────────────────────────

describe("categoryRouter.getById", () => {
  it("restituisce la categoria se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue(mockCategory);

    const result = await caller.getById({ id: "clk1f82qg000008l412345678" });

    expect(result.id).toBe("clk1f82qg000008l412345678");
    expect(result.name).toBe("Alimentari");
  });

  it("lancia NOT_FOUND se la categoria non esiste", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue(null);

    await expect(caller.getById({ id: "clk1f82qg000308l412345678" })).rejects.toThrow(
      TRPCError
    );
  });
});

// ─── create ───────────────────────────────────────────────

describe("categoryRouter.create", () => {
  it("crea la categoria con userId dell'utente autenticato", async () => {
    const { caller, db } = makeCaller();
    db.category.findFirst.mockResolvedValue(null); // nessun duplicato
    db.category.create.mockResolvedValue({ ...mockCategory, id: "clk1f82qg000108l412345678" });

    await caller.create({ name: "Alimentari", icon: "🛒", color: "#22c55e" });

    const createArg = db.category.create.mock.calls[0]?.[0]?.data;
    expect(createArg?.userId).toBe(mockUser.id);
    expect(createArg?.name).toBe("Alimentari");
  });

  it("lancia CONFLICT se esiste già una categoria con lo stesso nome", async () => {
    const { caller, db } = makeCaller();
    db.category.findFirst.mockResolvedValue(mockCategory); // duplicato trovato!

    await expect(
      caller.create({ name: "Alimentari" })
    ).rejects.toThrow(TRPCError);

    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("accetta una categoria senza icona e colore", async () => {
    const { caller, db } = makeCaller();
    db.category.findFirst.mockResolvedValue(null);
    db.category.create.mockResolvedValue({ ...mockCategory, icon: null, color: null });

    await expect(
      caller.create({ name: "Nuova Categoria" })
    ).resolves.not.toThrow();
  });

  it("rifiuta un nome vuoto", async () => {
    const { caller } = makeCaller();

    await expect(caller.create({ name: "" })).rejects.toThrow();
  });

  it("rifiuta un colore HEX non valido", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", color: "rosso" }) // non è HEX
    ).rejects.toThrow();
  });

  it("rifiuta un budget negativo", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", budget: -50 })
    ).rejects.toThrow();
  });
});

// ─── delete ───────────────────────────────────────────────

describe("categoryRouter.delete", () => {
  it("elimina la categoria se non ha spese collegate", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue({
      ...mockCategory,
      _count: { expenses: 0 }, // nessuna spesa!
    });
    db.category.delete.mockResolvedValue(mockCategory);

    await caller.delete({ id: "clk1f82qg000008l412345678" });

    expect(db.category.delete).toHaveBeenCalledOnce();
  });

  it("lancia PRECONDITION_FAILED se ha spese collegate", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue({
      ...mockCategory,
      _count: { expenses: 5 }, // 5 spese collegate!
    });

    await expect(caller.delete({ id: "clk1f82qg000008l412345678" })).rejects.toThrow(TRPCError);
    expect(db.category.delete).not.toHaveBeenCalled();
  });

  it("lancia NOT_FOUND se la categoria non esiste", async () => {
    const { caller, db } = makeCaller();
    db.category.findUnique.mockResolvedValue(null);

    await expect(caller.delete({ id: "clk1f82qg000308l412345678" })).rejects.toThrow(
      TRPCError
    );
  });
});