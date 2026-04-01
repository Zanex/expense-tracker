import { cn, formatCurrency } from "~/lib/utils";
import { AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface BudgetProgressProps {
  budget: number;
  spent: number;
  color?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────

function getBudgetStatus(percentage: number) {
  if (percentage >= 100) return "over" as const;
  if (percentage >= 80) return "warning" as const;
  return "ok" as const;
}

// ─── Component ───────────────────────────────────────────

export function BudgetProgress({ budget, spent, color }: BudgetProgressProps) {
  const percentage = Math.round((spent / budget) * 100);
  const status = getBudgetStatus(percentage);
  const cappedPercentage = Math.min(percentage, 100);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Barra progresso */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            status === "ok" && "bg-green-500",
            status === "warning" && "bg-orange-400",
            status === "over" && "bg-red-500"
          )}
          style={{
            width: `${cappedPercentage}%`,
            // usa il colore categoria se disponibile e siamo in stato ok
            backgroundColor:
              status === "ok" && color ? color : undefined,
          }}
        />
      </div>

      {/* Etichetta */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs",
            status === "ok" && "text-muted-foreground",
            status === "warning" && "text-orange-500 font-medium",
            status === "over" && "text-red-500 font-medium"
          )}
        >
          {status === "over" ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Over budget +{percentage - 100}%
            </span>
          ) : (
            `${percentage}% del budget`
          )}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(spent)} / {formatCurrency(budget)}
        </span>
      </div>
    </div>
  );
}
