"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { MONTHS, getYearRange } from "~/lib/utils";
import type { MonthFilter } from "~/hooks/use-month-filter";

// ─── Types ────────────────────────────────────────────────

interface MonthFilterProps {
  filter: MonthFilter;
}

// ─── Component ───────────────────────────────────────────

export function MonthFilterControl({ filter }: MonthFilterProps) {
  const { month, year, goToPrev, goToNext, setMonth, setYear, isCurrentMonth } =
    filter;

  const years = getYearRange();

  return (
    <div className="flex items-center gap-1">
      {/* Freccia indietro */}
      <Button variant="ghost" size="icon" onClick={goToPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Dropdown mese */}
      <Select
        value={month.toString()}
        onValueChange={(v) => {
          if (v) setMonth(parseInt(v, 10));
        }}
      >
        <SelectTrigger className="w-36 border-0 font-medium shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value.toString()}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Dropdown anno */}
      <Select
        value={year.toString()}
        onValueChange={(v) => {
          if (v) setYear(parseInt(v, 10));
        }}
      >
        <SelectTrigger className="w-24 border-0 font-medium shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Freccia avanti */}
      <Button variant="ghost" size="icon" onClick={goToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Badge "Oggi" se siamo nel mese corrente */}
      {isCurrentMonth && (
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Oggi
        </span>
      )}
    </div>
  );
}
