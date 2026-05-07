import { cn } from "~/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  delta?: number | null;       // percentuale vs mese precedente
  deltaLabel?: string;         // es. "vs mese scorso"
  icon?: LucideIcon;
  isLoading?: boolean;
  className?: string;
}

// ─── Component ───────────────────────────────────────────

export function KpiCard({
  title,
  value,
  description,
  delta,
  deltaLabel = "vs mese scorso",
  icon: Icon,
  isLoading = false,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
          {title}
        </CardTitle>
        {Icon && (
          <div className="rounded-2xl bg-primary/10 p-2 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)] transition-transform duration-300 hover:scale-110">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          <>
            <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              {value}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {delta !== undefined && delta !== null && (
              <DeltaBadge delta={delta} label={deltaLabel} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Delta Badge ──────────────────────────────────────────

interface DeltaBadgeProps {
  delta: number;
  label: string;
}

function DeltaBadge({ delta, label }: DeltaBadgeProps) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "flex items-center gap-0.5 text-xs font-medium",
          isNeutral && "text-muted-foreground",
          isPositive && "text-red-500",    // spese in aumento = rosso
          !isPositive && !isNeutral && "text-green-500" // spese in calo = verde
        )}
      >
        <Icon className="h-3 w-3" />
        {isPositive ? "+" : ""}
        {delta}%
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
