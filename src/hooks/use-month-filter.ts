"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { MONTHS, getCurrentMonth, getCurrentYear } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

export interface MonthFilter {
  month: number;
  year: number;
  label: string;
  goToPrev: () => void;
  goToNext: () => void;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  isCurrentMonth: boolean;
}

// ─── Hook ─────────────────────────────────────────────────

export function useMonthFilter(): MonthFilter {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Legge dall'URL, fallback al mese corrente
  const rawMonth = searchParams.get("month");
  const rawYear = searchParams.get("year");

  const month = rawMonth
    ? Math.min(Math.max(parseInt(rawMonth, 10), 1), 12)
    : getCurrentMonth();

  const year = rawYear
    ? parseInt(rawYear, 10)
    : getCurrentYear();

  // Scrive nell'URL senza aggiungere voce nella history
  const push = useCallback(
    (newMonth: number, newYear: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", String(newMonth));
      params.set("year", String(newYear));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const goToPrev = useCallback(() => {
    if (month === 1) {
      push(12, year - 1);
    } else {
      push(month - 1, year);
    }
  }, [month, year, push]);

  const goToNext = useCallback(() => {
    if (month === 12) {
      push(1, year + 1);
    } else {
      push(month + 1, year);
    }
  }, [month, year, push]);

  const setMonth = useCallback(
    (m: number) => push(m, year),
    [push, year]
  );

  const setYear = useCallback(
    (y: number) => push(month, y),
    [push, month]
  );

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";
  const label = `${monthLabel} ${year}`;

  const isCurrentMonth =
    month === getCurrentMonth() && year === getCurrentYear();

  return {
    month,
    year,
    label,
    goToPrev,
    goToNext,
    setMonth,
    setYear,
    isCurrentMonth,
  };
}