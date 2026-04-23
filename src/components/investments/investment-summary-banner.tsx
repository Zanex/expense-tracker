"use client";

import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────

function DeltaBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;

  const pos = value > 0;
  const neutral = value === 0;
  const Icon = neutral ? Minus : pos ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        neutral && "text-muted-foreground",
        pos && "text-green-500",
        !pos && !neutral && "text-red-500"
      )}
    >
      <Icon className="h-3 w-3" />
      {pos ? "+" : ""}{value}{suffix}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────

export function InvestmentSummaryBanner() {
  const utils = api.useUtils();
  const { data: summary, isLoading } = api.investment.getSummary.useQuery();

  const refreshMutation = api.investment.refreshPrices.useMutation({
    onSuccess: async (result) => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      if (result.refreshed > 0) {
        toast.success(`${result.refreshed} prezzi aggiornati`);
      } else if (result.skipped > 0) {
        toast.info("Tutti i prezzi sono già aggiornati");
      } else {
        toast.warning(`Nessun prezzo aggiornato (${result.failed} falliti)`);
      }
    },
    onError: () => toast.error("Errore durante l'aggiornamento prezzi"),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    );
  }

  if (!summary || summary.positionCount === 0) return null;

  const pnlPositive = (summary.totalUnrealizedPnL ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Banner prezzi incompleti */}
      {!summary.pricesComplete && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm dark:border-orange-900/50 dark:bg-orange-950/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-orange-500" />
          <span className="text-orange-700 dark:text-orange-400">
            Alcuni strumenti non hanno un prezzo aggiornato. Il valore totale è parziale.
          </span>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Valore totale */}
        <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Valore portafoglio</span>
          <span className="text-xl font-bold tabular-nums">
            {formatCurrency(summary.totalValue)}
          </span>
          <span className="text-xs text-muted-foreground">
            investito {formatCurrency(summary.totalCostBasis)}
          </span>
        </div>

        {/* P&L non realizzato */}
        <div
          className={cn(
            "flex flex-col gap-1 rounded-xl border px-4 py-3",
            pnlPositive
              ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10"
              : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10"
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">P&L non realizzato</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              pnlPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {(summary.totalUnrealizedPnL ?? 0) >= 0 ? "+" : ""}
            {formatCurrency(summary.totalUnrealizedPnL ?? 0)}
          </span>
          <DeltaBadge value={summary.totalUnrealizedPct} />
        </div>

        {/* Rendimento totale (realized + unrealized + dividendi) */}
        <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Rendimento totale</span>
          <span className="text-xl font-bold tabular-nums">
            {summary.totalReturn >= 0 ? "+" : ""}
            {formatCurrency(summary.totalReturn)}
          </span>
          <DeltaBadge value={summary.totalReturnPct} />
        </div>

        {/* Dividendi */}
        <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Dividendi incassati</span>
          <span className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(summary.totalDividends)}
          </span>
          <span className="text-xs text-muted-foreground">
            {summary.positionCount} {summary.positionCount === 1 ? "posizione" : "posizioni"}
          </span>
        </div>
      </div>

      {/* Allocazione + refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        {/* Allocazione per piattaforma — barra stacked */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Allocazione per piattaforma</span>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {summary.allocationByPlatform.map((p, i) => {
              const colors = [
                "#6366f1", "#22c55e", "#f97316", "#14b8a6",
                "#ec4899", "#eab308", "#3b82f6", "#a855f7",
              ];
              return (
                <div
                  key={p.platform}
                  style={{
                    width: `${p.percentage}%`,
                    backgroundColor: colors[i % colors.length],
                  }}
                  title={`${p.platform}: ${p.percentage}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {summary.allocationByPlatform.map((p, i) => {
              const colors = [
                "#6366f1", "#22c55e", "#f97316", "#14b8a6",
                "#ec4899", "#eab308", "#3b82f6", "#a855f7",
              ];
              return (
                <span key={p.platform} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  {p.platform} {p.percentage}%
                </span>
              );
            })}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Aggiorna prezzi
        </button>
      </div>
    </div>
  );
}
