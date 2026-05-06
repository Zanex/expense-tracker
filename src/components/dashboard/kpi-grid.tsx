"use client";

import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { KpiCard } from "./kpi-card";
import {
  Euro,
  Receipt,
  TrendingUp,
  Tag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface KpiGridProps {
  month: number;
  year: number;
}

// ─── Component ───────────────────────────────────────────

export function KpiGrid({ month, year }: KpiGridProps) {
  const { data: summary, isLoading } = api.report.getSummary.useQuery({
    month,
    year,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
      {/* Totale mese */}
      <KpiCard
        title="Totale mese"
        value={isLoading ? "—" : formatCurrency(summary?.totalAmount ?? 0)}
        delta={summary?.totalAmountDelta}
        icon={Euro}
        isLoading={isLoading}
      />

      {/* Numero spese */}
      <KpiCard
        title="Numero spese"
        value={isLoading ? "—" : String(summary?.expenseCount ?? 0)}
        description={
          summary?.expenseCount === 1 ? "transazione" : "transazioni"
        }
        delta={summary?.expenseCountDelta}
        icon={Receipt}
        isLoading={isLoading}
      />

      {/* Media per spesa */}
      <KpiCard
        title="Media per spesa"
        value={
          isLoading
            ? "—"
            : formatCurrency(summary?.averageAmount ?? 0)
        }
        description="importo medio per transazione"
        icon={TrendingUp}
        isLoading={isLoading}
      />

      {/* Categoria top */}
      <KpiCard
        title="Categoria top"
        value={
          isLoading
            ? "—"
            : summary?.topCategory
              ? `${summary.topCategory.icon ?? "📁"} ${summary.topCategory.name}`
              : "—"
        }
        description={
          summary?.topCategory
            ? formatCurrency(summary.topCategory.total)
            : "nessuna spesa"
        }
        icon={Tag}
        isLoading={isLoading}
      />
    </div>
  );
}
