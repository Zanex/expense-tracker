"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";
import { MONTHS, getYearRange } from "~/lib/utils";
import { api } from "~/trpc/react";

// ─── Types ────────────────────────────────────────────────

export interface ExpenseFilters {
  month?: number;
  year?: number;
  categoryId?: string;
}

interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

// ─── Component ───────────────────────────────────────────

export function ExpenseFilters({ filters, onChange }: ExpenseFiltersProps) {
  const { data: categories } = api.category.getAll.useQuery();
  const years = getYearRange();

  const hasActiveFilters =
    filters.month ?? filters.year ?? filters.categoryId;

  function handleReset() {
    onChange({ month: undefined, year: undefined, categoryId: undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mese */}
      <Select
        value={filters.month?.toString() ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, month: !v || v === "all" ? undefined : parseInt(v) })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Mese" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i mesi</SelectItem>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value.toString()}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Anno */}
      <Select
        value={filters.year?.toString() ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, year: !v || v === "all" ? undefined : parseInt(v) })
        }
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Anno" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Categoria */}
      <Select
        value={filters.categoryId ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, categoryId: !v || v === "all" ? undefined : v })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le categorie</SelectItem>
          {categories?.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              <span className="flex items-center gap-2">
                <span>{cat.icon ?? "📁"}</span>
                <span>{cat.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset filtri */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="mr-1 h-4 w-4" />
          Rimuovi filtri
        </Button>
      )}
    </div>
  );
}