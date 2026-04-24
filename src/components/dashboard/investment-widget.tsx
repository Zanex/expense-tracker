"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { TrendingUp, TrendingDown, Minus, ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  etf: "📊", stock: "🏢", crypto: "₿", fund: "🏦",
  bond: "📜", gold: "🥇", cash: "💶",
};

const PLATFORM_COLORS = [
  "#6366f1", "#22c55e", "#f97316", "#14b8a6",
  "#ec4899", "#eab308", "#3b82f6", "#a855f7",
];

// ─── Component ───────────────────────────────────────────

export function InvestmentWidget() {
  const { data: summary, isLoading } = api.investment.getSummary.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 } // 5 min — non refreshare ad ogni render
  );

  // Non mostrare se non ci sono posizioni
  if (!isLoading && (!summary || summary.positionCount === 0)) return null;

  const pnlPositive = (summary?.totalUnrealizedPnL ?? 0) >= 0;
  const PnLIcon = !summary?.totalUnrealizedPnL
    ? Minus
    : pnlPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Portafoglio investimenti
          </CardTitle>
          <Link
            href="/investments"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Vedi tutto
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Valore totale + P&L */}
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Valore totale</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatCurrency(summary!.totalValue)}
                </span>
                <span className="text-xs text-muted-foreground">
                  investito {formatCurrency(summary!.totalCostBasis)}
                </span>
              </div>

              {/* P&L badge */}
              <div
                className={cn(
                  "flex flex-col items-end gap-0.5 rounded-lg px-3 py-2",
                  pnlPositive
                    ? "bg-green-50 dark:bg-green-950/20"
                    : "bg-red-50 dark:bg-red-950/20"
                )}
              >
                <span className="text-xs text-muted-foreground">P&L</span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm font-bold tabular-nums",
                    pnlPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  )}
                >
                  <PnLIcon className="h-3.5 w-3.5" />
                  {pnlPositive ? "+" : ""}{formatCurrency(summary!.totalUnrealizedPnL ?? 0)}
                </span>
                {summary!.totalUnrealizedPct !== null && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      pnlPositive ? "text-green-600 dark:text-green-400" : "text-red-500"
                    )}
                  >
                    {pnlPositive ? "+" : ""}{summary!.totalUnrealizedPct}%
                  </span>
                )}
              </div>
            </div>

            {/* Barra allocazione per piattaforma */}
            {summary!.allocationByPlatform.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {summary!.allocationByPlatform.map((p, i) => (
                    <div
                      key={p.platform}
                      style={{
                        width: `${p.percentage}%`,
                        backgroundColor: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
                      }}
                      title={`${p.platform}: ${formatCurrency(p.value)} (${p.percentage}%)`}
                    />
                  ))}
                </div>
                {/* Legenda piattaforme */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {summary!.allocationByPlatform.map((p, i) => (
                    <span
                      key={p.platform}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[i % PLATFORM_COLORS.length] }}
                      />
                      {p.platform}
                      <span className="font-medium text-foreground">
                        {p.percentage}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Allocazione per tipo — pill badges */}
            {summary!.allocationByType.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {summary!.allocationByType.map((t) => (
                  <span
                    key={t.type}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    {TYPE_EMOJI[t.type] ?? "📈"}
                    <span className="capitalize">{t.type}</span>
                    <span className="text-muted-foreground">{t.percentage}%</span>
                  </span>
                ))}
              </div>
            )}

            {/* Warning prezzi incompleti */}
            {!summary!.pricesComplete && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-600 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Alcuni prezzi mancanti — valore parziale
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
