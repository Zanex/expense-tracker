import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Valuta ───────────────────────────────────────────────

export function formatCurrency(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// ─── Date ─────────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateInput(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthRange(month: number, year: number) {
  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}

// ─── Mesi ─────────────────────────────────────────────────

export const MONTHS = [
  { value: 1, label: "Gennaio" },
  { value: 2, label: "Febbraio" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Aprile" },
  { value: 5, label: "Maggio" },
  { value: 6, label: "Giugno" },
  { value: 7, label: "Luglio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Settembre" },
  { value: 10, label: "Ottobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Dicembre" },
];

export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function getYearRange(from = 2020): number[] {
  const current = getCurrentYear();
  return Array.from({ length: current - from + 1 }, (_, i) => current - i);
}

// ─── Conversione monetaria sicura ─────────────────────────

/**
 * Converte in modo sicuro qualsiasi tipo restituito da Prisma/tRPC
 * per i campi Decimal in un number JavaScript.
 *
 * Prisma Decimal → .toNumber()
 * number         → passthrough
 * string         → normalizza separatore decimale e parsa
 */
export function toNumber(
  value: { toNumber: () => number } | number | string | null | undefined
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }
  // Normalizza la virgola come separatore decimale (es. import CSV italiani)
  const normalized = String(value).replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}