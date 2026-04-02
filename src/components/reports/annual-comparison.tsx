"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency, getYearRange, getCurrentYear } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Custom Tooltip ───────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  yearA,
  yearB,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  yearA: number;
  yearB: number;
}) {
  if (!active || !payload?.length) return null;

  const valA = payload.find((p) => p.dataKey === String(yearA))?.value ?? 0;
  const valB = payload.find((p) => p.dataKey === String(yearB))?.value ?? 0;
  const delta = valA === 0 ? null : Math.round(((valB - valA) / valA) * 100);

  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-md outline-hidden">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-popover-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#c7d2fe]" />
            {yearA}
          </span>
          <span className="text-xs font-medium tabular-nums text-popover-foreground">
            {formatCurrency(valA)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-popover-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
            {yearB}
          </span>
          <span className="text-xs font-medium tabular-nums text-popover-foreground">
            {formatCurrency(valB)}
          </span>
        </div>
        {delta !== null && (
          <p
            className={cn(
              "mt-1 border-t border-border/50 pt-1 text-xs font-medium",
              delta > 0 ? "text-red-500" : delta < 0 ? "text-green-500" : "text-muted-foreground"
            )}
          >
            {delta > 0 ? "+" : ""}{delta}% vs {yearA}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function AnnualComparison() {
  const currentYear = getCurrentYear();
  const years = getYearRange(2020);

  const [yearA, setYearA] = useState(currentYear - 1);
  const [yearB, setYearB] = useState(currentYear);

  const { data, isLoading } = api.report.getAnnualComparison.useQuery({
    yearA,
    yearB,
  });

  if (isLoading) return <ChartSkeleton />;

  const hasData = data?.months.some(
    (m) => (m[yearA] as number) > 0 || (m[yearB] as number) > 0
  );

  const { summary } = data ?? {};
  const deltaIsPositive = summary?.annualDelta && summary.annualDelta > 0;
  const deltaIsNeutral = summary?.annualDelta === 0;
  const DeltaIcon = deltaIsNeutral ? Minus : deltaIsPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Confronto annuale
          </CardTitle>

          {/* Year selectors */}
          <div className="flex items-center gap-2">
            <Select
              value={String(yearA)}
              onValueChange={(v) => v && setYearA(parseInt(v))}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground">vs</span>

            <Select
              value={String(yearB)}
              onValueChange={(v) => v && setYearB(parseInt(v))}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!hasData ? (
          <EmptyState
            icon={BarChart2}
            title="Nessun dato"
            description="Nessuna spesa trovata per gli anni selezionati."
          />
        ) : (
          <>
            {/* Grafico */}
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.months} barSize={12} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`
                  }
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  content={
                    <CustomTooltip yearA={yearA} yearB={yearB} />
                  }
                  cursor={{ fill: "var(--muted)", opacity: 0.15 }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">
                      {value}
                    </span>
                  )}
                />
                <Bar
                  dataKey={String(yearA)}
                  fill="#c7d2fe"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey={String(yearB)}
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Summary bar */}
            {summary && (
              <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/30">
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Totale {yearA}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(summary.totalA)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Totale {yearB}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(summary.totalB)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Variazione annuale
                  </span>
                  {summary.annualDelta !== null ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-sm font-semibold",
                        deltaIsNeutral && "text-muted-foreground",
                        deltaIsPositive && "text-red-500",
                        !deltaIsPositive && !deltaIsNeutral && "text-green-500"
                      )}
                    >
                      <DeltaIcon className="h-3.5 w-3.5" />
                      {summary.annualDelta > 0 ? "+" : ""}
                      {summary.annualDelta}%
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
