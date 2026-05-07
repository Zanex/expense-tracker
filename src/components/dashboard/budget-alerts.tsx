"use client";

import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────

interface BudgetAlertsProps {
  month: number;
  year: number;
}

// ─── Component ───────────────────────────────────────────

export function BudgetAlerts({ month, year }: BudgetAlertsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: alerts, isLoading } = api.report.getBudgetAlerts.useQuery(
    { month, year },
    { staleTime: 60_000 }
  );

  if (isLoading || !alerts || alerts.length === 0) return null;

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((alert) => {
        const isOver = alert.status === "over";

        return (
          <div
            key={alert.id}
            className={cn(
              "glass-card flex items-center gap-3 px-4 py-3 text-sm",
              isOver ? "aura-destructive" : "aura-warning"
            )}
          >
            {/* Icona */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base",
                isOver ? "bg-red-100 dark:bg-red-900/50" : "bg-orange-100 dark:bg-orange-900/50"
              )}
            >
              {alert.icon ?? (isOver ? "🚨" : "⚠️")}
            </div>

            {/* Testo */}
            <div className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span
                className={cn(
                  "font-medium",
                  isOver ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"
                )}
              >
                {alert.name}
              </span>
              {isOver ? (
                <span className="text-red-600 dark:text-red-400">
                  ha sforato il budget —{" "}
                  <strong>{formatCurrency(alert.spent)}</strong> su{" "}
                  <strong>{formatCurrency(alert.budget)}</strong>
                  {" "}({alert.percentage}%)
                </span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">
                  è all&apos;{alert.percentage}% del budget —{" "}
                  <strong>{formatCurrency(alert.spent)}</strong> su{" "}
                  <strong>{formatCurrency(alert.budget)}</strong>
                </span>
              )}
            </div>

            {/* Barra progresso mini */}
            <div className="hidden w-24 sm:block">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isOver ? "bg-red-500" : "bg-orange-400"
                  )}
                  style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
              className={cn(
                "ml-1 shrink-0 rounded-md p-1 transition-colors",
                isOver
                  ? "text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50"
                  : "text-orange-400 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/50"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}