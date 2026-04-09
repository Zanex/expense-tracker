"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { MONTHS, getYearRange } from "~/lib/utils";
import { api } from "~/trpc/react";

// ─── Types ────────────────────────────────────────────────

export interface ExpenseFilters {
  month?: number;
  year?: number;
  categoryId?: string;
  search?: string;
  amountMin?: number;
  amountMax?: number;
}

interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

// ─── Component ───────────────────────────────────────────

export function ExpenseFilters({ filters, onChange }: ExpenseFiltersProps) {
  const { data: categories } = api.category.getAll.useQuery();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const years = getYearRange();

  const hasActiveFilters =
    filters.categoryId ??
    filters.search ??
    filters.amountMin ??
    filters.amountMax;

  function handleReset() {
    onChange({
      categoryId: undefined,
      search: undefined,
      amountMin: undefined,
      amountMax: undefined,
    });
    setShowAdvanced(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Riga principale: search + filtri base */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Campo ricerca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca spesa..."
            value={filters.search ?? ""}
            onChange={(e) =>
              onChange({ ...filters, search: e.target.value || undefined })
            }
            className="w-52 pl-8"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: undefined })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

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

        {/* Toggle filtri avanzati */}
        <Button
          variant={showAdvanced ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Filtri avanzati
          {(filters.amountMin ?? filters.amountMax) && (
            <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              !
            </span>
          )}
        </Button>

        {/* Reset filtri */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="mr-1 h-4 w-4" />
            Rimuovi filtri
          </Button>
        )}
      </div>

      {/* Riga avanzata: filtro importo */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Importo:
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                placeholder="Min"
                min={0}
                step={0.01}
                value={filters.amountMin ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    amountMin: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-28 pl-7"
              />
            </div>
            <span className="text-muted-foreground">—</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                placeholder="Max"
                min={0}
                step={0.01}
                value={filters.amountMax ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    amountMax: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-28 pl-7"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
