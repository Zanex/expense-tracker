import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { vehicleRouter } from "~/server/api/routers/vehicle";
import { createMockDb, createTestContext, mockUser } from "~/test/helpers";

// ─── Setup ────────────────────────────────────────────────

const createCaller = createCallerFactory(vehicleRouter);

function makeCaller() {
  const db = createMockDb();
  const ctx = createTestContext(db);
  const caller = createCaller(ctx as never);
  return { caller, db };
}

// ─── Mock data ────────────────────────────────────────────

const mockVehicle = {
  id: "clvehicle000001",
  name: "Fiat Panda 2022",
  plate: "AB123CD",
  brand: "Fiat",
  model: "Panda",
  year: 2022,
  fuelType: "gasoline",
  initialKm: 0,
  lastServiceKm: 10000,
  serviceIntervalKm: 15000,
  lastServiceDate: new Date("2025-01-01"),
  userId: mockUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { expenses: 3, refuels: 5 },
};

const makeExpense = (overrides: Partial<{
  amount: { toNumber: () => number };
  liters: { toNumber: () => number } | null;
  kmAtRefuel: number | null;
  fullTank: boolean | null;
  date: Date;
}> = {}) => ({
  amount: { toNumber: () => 80 },
  liters: { toNumber: () => 40 },
  kmAtRefuel: 20000,
  fullTank: true,
  date: new Date("2026-03-01"),
  ...overrides,
});

// ─── getAll ───────────────────────────────────────────────

describe("vehicleRouter.getAll", () => {
  it("restituisce i veicoli dell'utente", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findMany.mockResolvedValue([mockVehicle]);

    const result = await caller.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Fiat Panda 2022");
  });

  it("filtra per userId — non espone veicoli di altri", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findMany.mockResolvedValue([]);

    await caller.getAll();

    const whereArg = db.vehicle.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.userId).toBe(mockUser.id);
  });
});

// ─── getById ──────────────────────────────────────────────

describe("vehicleRouter.getById", () => {
  it("restituisce il veicolo se appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    const result = await caller.getById({ id: "clvehicle000001" });

    expect(result.id).toBe("clvehicle000001");
    expect(result.name).toBe("Fiat Panda 2022");
  });

  it("lancia NOT_FOUND se il veicolo non esiste", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.getById({ id: "clvehicle000099" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── create ───────────────────────────────────────────────

describe("vehicleRouter.create", () => {
  it("crea il veicolo con userId dell'utente autenticato", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.create.mockResolvedValue({ ...mockVehicle, id: "clvehicle000002" });

    await caller.create({
      name: "Fiat Panda 2022",
      fuelType: "gasoline",
      initialKm: 0,
    });

    const data = db.vehicle.create.mock.calls[0]?.[0]?.data;
    expect(data?.userId).toBe(mockUser.id);
    expect(data?.name).toBe("Fiat Panda 2022");
  });

  it("rifiuta nome vuoto", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "", fuelType: "gasoline", initialKm: 0 })
    ).rejects.toThrow();
  });

  it("rifiuta km iniziali negativi", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.create({ name: "Test", fuelType: "gasoline", initialKm: -100 })
    ).rejects.toThrow();
  });

  it("rifiuta tipo carburante non valido", async () => {
    const { caller } = makeCaller();

    await expect(
      // @ts-expect-error testing invalid fuelType
      caller.create({ name: "Test", fuelType: "plutonio", initialKm: 0 })
    ).rejects.toThrow();
  });
});

// ─── update ───────────────────────────────────────────────

describe("vehicleRouter.update", () => {
  it("aggiorna i dati del veicolo", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.vehicle.update.mockResolvedValue({ ...mockVehicle, name: "Panda Aggiornata" });

    await caller.update({ id: "clvehicle000001", name: "Panda Aggiornata" });

    expect(db.vehicle.update).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se il veicolo non esiste", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.update({ id: "clvehicle000099", name: "X" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── delete ───────────────────────────────────────────────

describe("vehicleRouter.delete", () => {
  it("elimina il veicolo", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.vehicle.delete.mockResolvedValue(mockVehicle);

    await caller.delete({ id: "clvehicle000001" });

    expect(db.vehicle.delete).toHaveBeenCalledOnce();
  });

  it("lancia NOT_FOUND se il veicolo non esiste", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.delete({ id: "clvehicle000099" })
    ).rejects.toThrow(TRPCError);

    expect(db.vehicle.delete).not.toHaveBeenCalled();
  });
});

// ─── getSummary ───────────────────────────────────────────

describe("vehicleRouter.getSummary", () => {
  it("calcola totalCost sommando carburante e spese", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ amount: { toNumber: () => 80 }, liters: { toNumber: () => 40 } }),
      makeExpense({ amount: { toNumber: () => 120 }, liters: null, kmAtRefuel: null, fullTank: null }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.totalFuel).toBe(80);
    expect(result.totalExpenses).toBe(120);
    expect(result.totalCost).toBe(200);
  });

  it("calcola totalLiters sommando tutti i rifornimenti", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ liters: { toNumber: () => 40 }, kmAtRefuel: 10000 }),
      makeExpense({ liters: { toNumber: () => 35 }, kmAtRefuel: 11000 }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.totalLiters).toBe(75);
  });

  it("calcola km percorsi nel mese come differenza primo/ultimo km", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ kmAtRefuel: 0 }),
      makeExpense({ kmAtRefuel: 500 }),
      makeExpense({ kmAtRefuel: 1200 }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.totalKm).toBe(1200); // 1200 - 0
  });

  it("calcola avgConsumption L/100km con almeno 2 pieni", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    // Pieno 1 a 10000km, pieno 2 a 10500km con 25L → 25/500 * 100 = 5 L/100km
    db.expense.findMany.mockResolvedValue([
      makeExpense({ kmAtRefuel: 10000, liters: { toNumber: () => 30 }, fullTank: true }),
      makeExpense({ kmAtRefuel: 10500, liters: { toNumber: () => 25 }, fullTank: true }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.avgConsumption).toBe(5); // 25L / 500km * 100
  });

  it("calcola avgConsumption includendo rifornimenti parziali tra i pieni", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ kmAtRefuel: 10000, liters: { toNumber: () => 30 }, fullTank: true }),
      makeExpense({ kmAtRefuel: 10200, liters: { toNumber: () => 15 }, fullTank: false }),
      makeExpense({ kmAtRefuel: 10500, liters: { toNumber: () => 25 }, fullTank: true }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    // 15L + 25L = 40L percorsi in 500km -> 40/500*100 = 8 L/100km
    expect(result.avgConsumption).toBe(8);
  });

  it("restituisce avgConsumption null con meno di 2 pieni", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ kmAtRefuel: 10000, fullTank: true }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.avgConsumption).toBeNull();
  });

  it("restituisce costPerKm null se nessun km registrato", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    db.expense.findMany.mockResolvedValue([
      makeExpense({ kmAtRefuel: null, liters: null, fullTank: null }),
    ]);

    const result = await caller.getSummary({
      vehicleId: "clvehicle000001",
      month: 3,
      year: 2026,
    });

    expect(result.costPerKm).toBeNull();
    expect(result.totalKm).toBeNull();
  });

  it("lancia NOT_FOUND se veicolo non appartiene all'utente", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.getSummary({ vehicleId: "clvehicle000099", month: 3, year: 2026 })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── getMonthlyTrend ──────────────────────────────────────

describe("vehicleRouter.getMonthlyTrend", () => {
  it("restituisce N periodi mensili", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.expense.findMany.mockResolvedValue([]);

    const result = await caller.getMonthlyTrend({
      vehicleId: "clvehicle000001",
      months: 6,
    });

    expect(result).toHaveLength(6);
  });

  it("separa correttamente carburante da altre spese", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);

    const now = new Date();
    db.expense.findMany.mockResolvedValue([
      // Rifornimento
      makeExpense({
        amount: { toNumber: () => 80 },
        liters: { toNumber: () => 40 },
        date: now,
      }),
      // Spesa normale
      makeExpense({
        amount: { toNumber: () => 150 },
        liters: null,
        kmAtRefuel: null,
        fullTank: null,
        date: now,
      }),
    ]);

    const result = await caller.getMonthlyTrend({
      vehicleId: "clvehicle000001",
      months: 1,
    });

    const currentPeriod = result[result.length - 1]!;
    expect(currentPeriod.fuel).toBe(80);
    expect(currentPeriod.expenses).toBe(150);
    expect(currentPeriod.total).toBe(230);
  });

  it("restituisce totali zero per mesi senza spese", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.expense.findMany.mockResolvedValue([]);

    const result = await caller.getMonthlyTrend({
      vehicleId: "clvehicle000001",
      months: 3,
    });

    result.forEach((period) => {
      expect(period.fuel).toBe(0);
      expect(period.expenses).toBe(0);
      expect(period.total).toBe(0);
    });
  });
});

// ─── getServiceStatus ─────────────────────────────────────

describe("vehicleRouter.getServiceStatus", () => {
  it("restituisce configured false se serviceIntervalKm non impostato", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: null,
      serviceIntervalKm: null,
    });

    const result = await caller.getServiceStatus({ vehicleId: "clvehicle000001" });

    expect(result.configured).toBe(false);
  });

  it("calcola correttamente kmToService", async () => {
    const { caller, db } = makeCaller();

    // lastServiceKm: 10000, intervalKm: 15000 → nextService: 25000
    db.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: 10000,
      serviceIntervalKm: 15000,
      initialKm: 0,
    });

    // Ultimo rifornimento a 20000km
    db.expense.findFirst.mockResolvedValue({ kmAtRefuel: 20000 });

    const result = await caller.getServiceStatus({ vehicleId: "clvehicle000001" });

    if (!result.configured) throw new Error("Should be configured");

    expect(result.nextServiceKm).toBe(25000);
    expect(result.kmToService).toBe(5000);  // 25000 - 20000
    expect(result.isOk).toBe(true);
    expect(result.isWarning).toBe(false);
    expect(result.isOverdue).toBe(false);
  });

  it("isWarning true quando mancano meno di 1500 km", async () => {
    const { caller, db } = makeCaller();

    db.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: 10000,
      serviceIntervalKm: 15000,
    });

    // A 24200km → mancano 800km al tagliando a 25000
    db.expense.findFirst.mockResolvedValue({ kmAtRefuel: 24200 });

    const result = await caller.getServiceStatus({ vehicleId: "clvehicle000001" });

    if (!result.configured) throw new Error("Should be configured");

    expect(result.isWarning).toBe(true);
    expect(result.isOverdue).toBe(false);
    expect(result.kmToService).toBe(800);
  });

  it("isOverdue true quando km superati", async () => {
    const { caller, db } = makeCaller();

    db.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: 10000,
      serviceIntervalKm: 15000,
    });

    // A 26000km → tagliando scaduto da 1000km
    db.expense.findFirst.mockResolvedValue({ kmAtRefuel: 26000 });

    const result = await caller.getServiceStatus({ vehicleId: "clvehicle000001" });

    if (!result.configured) throw new Error("Should be configured");

    expect(result.isOverdue).toBe(true);
    expect(result.isWarning).toBe(false);
    expect(result.kmToService).toBe(-1000);
  });

  it("calcola percentage correttamente", async () => {
    const { caller, db } = makeCaller();

    // lastService: 10000, interval: 10000, current: 15000 → 50%
    db.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: 10000,
      serviceIntervalKm: 10000,
    });

    db.expense.findFirst.mockResolvedValue({ kmAtRefuel: 15000 });

    const result = await caller.getServiceStatus({ vehicleId: "clvehicle000001" });

    if (!result.configured) throw new Error("Should be configured");

    expect(result.percentage).toBe(50);
  });

  it("lancia NOT_FOUND se veicolo non trovato", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.getServiceStatus({ vehicleId: "clvehicle000099" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── markServiceDone ──────────────────────────────────────

describe("vehicleRouter.markServiceDone", () => {
  it("aggiorna lastServiceKm e lastServiceDate", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.vehicle.update.mockResolvedValue({
      ...mockVehicle,
      lastServiceKm: 25000,
      lastServiceDate: new Date(),
    });

    await caller.markServiceDone({
      vehicleId: "clvehicle000001",
      kmAtService: 25000,
    });

    const data = db.vehicle.update.mock.calls[0]?.[0]?.data;
    expect(data?.lastServiceKm).toBe(25000);
    expect(data?.lastServiceDate).toBeInstanceOf(Date);
  });

  it("lancia NOT_FOUND se veicolo non esiste", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      caller.markServiceDone({
        vehicleId: "clvehicle000099",
        kmAtService: 25000,
      })
    ).rejects.toThrow(TRPCError);
  });

  it("rifiuta km negativi", async () => {
    const { caller } = makeCaller();

    await expect(
      caller.markServiceDone({
        vehicleId: "clvehicle000001",
        kmAtService: -100,
      })
    ).rejects.toThrow();
  });

  it("accetta km a zero per veicoli nuovi", async () => {
    const { caller, db } = makeCaller();
    db.vehicle.findUnique.mockResolvedValue(mockVehicle);
    db.vehicle.update.mockResolvedValue(mockVehicle);

    await caller.markServiceDone({
      vehicleId: "clvehicle000001",
      kmAtService: 0,
    });

    expect(db.vehicle.update).toHaveBeenCalledOnce();
  });
});