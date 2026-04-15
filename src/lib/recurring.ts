/**
 * Utility per la gestione delle date e delle ricorrenze.
 */

export type RecurringFrequency = "monthly" | "weekly" | "yearly";

/**
 * Calcola la prossima data di ricorrenza a partire da una data base.
 * Es: monthly "01/01/2026" -> "01/02/2026"
 */
export function getNextRecurringDate(
  baseDate: Date,
  frequency: RecurringFrequency
): Date {
  const next = new Date(baseDate);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
}

/**
 * Crea un oggetto range di date per le query Prisma.
 */
export function buildDateRange(month: number, year: number) {
  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}

/**
 * Calcola il mese precedente.
 */
export function getPrevMonth(month: number, year: number) {
  return month === 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year };
}
