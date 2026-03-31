import { useState, useCallback } from "react";
import { getCurrentMonth, getCurrentYear, MONTHS } from "~/lib/utils";

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

// ─── Hook ────────────────────────────────────────────────

export function useMonthFilter(): MonthFilter {
  const [month, setMonthState] = useState(getCurrentMonth);
  const [year, setYearState] = useState(getCurrentYear);

  const goToPrev = useCallback(() => {
    setMonthState((m) => {
      if (m === 1) {
        setYearState((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const goToNext = useCallback(() => {
    setMonthState((m) => {
      if (m === 12) {
        setYearState((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  const setMonth = useCallback((m: number) => {
    setMonthState(m);
  }, []);

  const setYear = useCallback((y: number) => {
    setYearState(y);
  }, []);

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
