import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getMonthRange,
  toNumber,
  getCurrentMonth,
  getCurrentYear,
} from "~/lib/utils";

// ─── formatCurrency ───────────────────────────────────────

describe("formatCurrency", () => {
  it("formatta correttamente un valore intero", () => {
    expect(formatCurrency(100).replace(/\s/g, " ")).toBe("100,00 €");
  });

  it("formatta correttamente un valore con decimali", () => {
    expect(formatCurrency(12345.5).replace(/\s/g, " ")).toBe("12.345,50 €");
  });

  it("formatta zero", () => {
    expect(formatCurrency(0).replace(/\s/g, " ")).toBe("0,00 €");
  });

  it("accetta anche una stringa numerica", () => {
    expect(formatCurrency("42.99").replace(/\s/g, " ")).toBe("42,99 €");
  });
});

// ─── formatDate ───────────────────────────────────────────

describe("formatDate", () => {
  it("formatta una data in formato italiano dd/mm/yyyy", () => {
    const result = formatDate(new Date(2026, 2, 15)); // 15 marzo 2026
    expect(result).toBe("15/03/2026");
  });

  it("accetta anche una stringa ISO", () => {
    const result = formatDate("2026-01-05T00:00:00.000Z");
    expect(result).toMatch(/05\/01\/2026/);
  });
});

// ─── formatDateInput ──────────────────────────────────────

describe("formatDateInput", () => {
  it("restituisce una stringa nel formato YYYY-MM-DD", () => {
    const result = formatDateInput(new Date(2026, 2, 15));
    expect(result).toBe("2026-03-15");
  });

  it("accetta una stringa ISO", () => {
    const result = formatDateInput("2026-12-01T00:00:00.000Z");
    expect(result).toBe("2026-12-01");
  });
});

// ─── getMonthRange ────────────────────────────────────────

describe("getMonthRange", () => {
  it("restituisce l'inizio e la fine del mese corretti", () => {
    const { gte, lt } = getMonthRange(3, 2026);
    expect(gte).toEqual(new Date(2026, 2, 1));  // 1 marzo
    expect(lt).toEqual(new Date(2026, 3, 1));   // 1 aprile
  });

  it("gestisce correttamente gennaio (mese 1)", () => {
    const { gte, lt } = getMonthRange(1, 2026);
    expect(gte).toEqual(new Date(2026, 0, 1));
    expect(lt).toEqual(new Date(2026, 1, 1));
  });

  it("gestisce correttamente dicembre (mese 12)", () => {
    const { gte, lt } = getMonthRange(12, 2025);
    expect(gte).toEqual(new Date(2025, 11, 1));
    expect(lt).toEqual(new Date(2026, 0, 1));
  });
});

// ─── toNumber ─────────────────────────────────────────────

describe("toNumber", () => {
  it("passa attraverso un number", () => {
    expect(toNumber(42.5)).toBe(42.5);
  });

  it("converte un oggetto Decimal con .toNumber()", () => {
    expect(toNumber({ toNumber: () => 99.99 })).toBe(99.99);
  });

  it("parsa una stringa numerica", () => {
    expect(toNumber("123.45")).toBe(123.45);
  });

  it("normalizza la virgola come separatore decimale", () => {
    expect(toNumber("12,50")).toBe(12.5);
  });

  it("restituisce 0 per null", () => {
    expect(toNumber(null)).toBe(0);
  });

  it("restituisce 0 per undefined", () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it("restituisce 0 per una stringa non numerica", () => {
    expect(toNumber("abc")).toBe(0);
  });
});

// ─── getCurrentMonth / getCurrentYear ─────────────────────

describe("getCurrentMonth", () => {
  it("restituisce un numero tra 1 e 12", () => {
    const month = getCurrentMonth();
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});

describe("getCurrentYear", () => {
  it("restituisce un anno ragionevole", () => {
    const year = getCurrentYear();
    expect(year).toBeGreaterThanOrEqual(2024);
    expect(year).toBeLessThanOrEqual(2100);
  });
});