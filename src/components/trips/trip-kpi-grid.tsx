"use client";

import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import {
  Euro,
  Receipt,
  TrendingUp,
  Tag,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface TripKpiGridProps {
  tripId: string;
  coverColor?: string | null;
}

// ─── Single KPI card ──────────────────────────────────────

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  valueColor,
  isLoading,
  alert,
}: {
  title: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  valueColor?: string;
  isLoading?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3",
        alert && "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium text-muted-foreground", alert && "text-red-600 dark:text-red-400")}>
          {title}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              alert ? "text-red-400" : "text-muted-foreground"
            )}
          />
        )}
      </div>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : (
        <>
          <span
            className="text-xl font-bold tabular-nums"
            style={valueColor ? { color: valueColor } : undefined}
          >
            {value}
          </span>
          {description && (
            <span
              className={cn(
                "text-xs text-muted-foreground",
                alert && "text-red-500 dark:text-red-400"
              )}
            >
              {description}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Budget progress bar ──────────────────────────────────

function BudgetBar({
  percentage,
  color,
  isLoading,
}: {
  percentage: number | null;
  color: string;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-2 w-full rounded-full" />;
  if (percentage === null) return null;

  const capped = Math.min(percentage, 100);
  const over = percentage > 100;
  const warn = percentage >= 80 && !over;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            over && "bg-red-500",
            warn && "bg-orange-400",
          )}
          style={{
            width: `${capped}%`,
            backgroundColor: !over && !warn ? color : undefined,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={cn(over && "font-medium text-red-500", warn && "font-medium text-orange-500")}>
          {over
            ? `Over budget +${percentage - 100}%`
            : warn
            ? `Attenzione: ${percentage}% usato`
            : `${percentage}% del budget usato`}
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function TripKpiGrid({ tripId, coverColor }: TripKpiGridProps) {
  const { data: summary, isLoading } = api.trip.getSummary.useQuery({ id: tripId });

  const color = coverColor ?? "#6366f1";
  const overBudget = summary?.budget != null && summary.totalSpent > summary.budget;
  const nearBudget =
    !overBudget &&
    summary?.budgetPercentage != null &&
    summary.budgetPercentage >= 80;

  return (
    <div className="flex flex-col gap-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Totale speso"
          value={isLoading ? "—" : formatCurrency(summary?.totalSpent ?? 0)}
          description={
            isLoading
              ? undefined
              : `${summary?.expenseCount ?? 0} ${(summary?.expenseCount ?? 0) === 1 ? "transazione" : "transazioni"}`
          }
          icon={Euro}
          valueColor={color}
          isLoading={isLoading}
        />

        <KpiCard
          title="Media per spesa"
          value={isLoading ? "—" : formatCurrency(summary?.avgAmount ?? 0)}
          description="importo medio"
          icon={TrendingUp}
          isLoading={isLoading}
        />

        <KpiCard
          title="Spesa più alta"
          value={isLoading ? "—" : formatCurrency(summary?.maxAmount ?? 0)}
          description="singola transazione"
          icon={Receipt}
          isLoading={isLoading}
        />

        <KpiCard
          title="Budget totale"
          value={
            isLoading
              ? "—"
              : summary?.budget != null
              ? formatCurrency(summary.budget)
              : "—"
          }
          description={summary?.budget == null ? "non impostato" : "budget viaggio"}
          icon={Calendar}
          isLoading={isLoading}
        />

        <KpiCard
          title="Rimanente"
          value={
            isLoading
              ? "—"
              : summary?.budgetRemaining != null
              ? formatCurrency(Math.abs(summary.budgetRemaining))
              : "—"
          }
          description={
            summary?.budgetRemaining == null
              ? "nessun budget"
              : overBudget
              ? "sforato"
              : "ancora disponibili"
          }
          icon={overBudget ? AlertTriangle : undefined}
          valueColor={
            summary?.budgetRemaining == null
              ? undefined
              : overBudget
              ? "#ef4444"
              : nearBudget
              ? "#f97316"
              : "#22c55e"
          }
          isLoading={isLoading}
          alert={overBudget}
        />

        <KpiCard
          title="Categoria top"
          value={
            isLoading
              ? "—"
              : summary?.categoryBreakdown[0]
              ? `${summary.categoryBreakdown[0].icon ?? "📁"} ${summary.categoryBreakdown[0].name}`
              : "—"
          }
          description={
            summary?.categoryBreakdown[0]
              ? formatCurrency(summary.categoryBreakdown[0].total)
              : "nessuna spesa"
          }
          icon={Tag}
          isLoading={isLoading}
        />
      </div>

      {/* Budget progress bar */}
      <BudgetBar
        percentage={isLoading ? null : (summary?.budgetPercentage ?? null)}
        color={color}
        isLoading={isLoading}
      />
    </div>
  );
}
