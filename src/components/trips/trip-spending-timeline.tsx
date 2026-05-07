"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface TripSpendingTimelineProps {
  tripId: string;
  duration: number | null;
  coverColor?: string | null;
  budget?: number | null;
}

// ─── Custom Tooltip ───────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === undefined) return null;

  return (
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none text-sm">
      <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)] mt-1">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function TripSpendingTimeline({
  tripId,
  duration,
  coverColor,
  budget,
}: TripSpendingTimelineProps) {
  // Granularità automatica: daily per viaggi ≤ 21gg, weekly per più lunghi
  const granularity = duration == null || duration <= 21 ? "daily" : "weekly";
  const color = coverColor ?? "#6366f1";

  const { data, isLoading } = api.trip.getSpendingTimeline.useQuery({
    id: tripId,
    granularity,
  });

  if (isLoading) return <ChartSkeleton />;

  const hasData = data && data.length > 0;

  // Soglia giornaliera/settimanale per la reference line
  const avgPerPeriod =
    budget != null && data && data.length > 0
      ? budget / data.length
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Spese nel tempo{" "}
          <span className="text-xs font-normal">
            ({granularity === "daily" ? "per giorno" : "per settimana"})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            icon={BarChart2}
            title="Nessun dato"
            description="Le spese appariranno qui man mano che le aggiungi."
          />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barSize={28} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tripBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="currentColor"
                className="text-muted-foreground/20"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
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
                content={<CustomTooltip />}
                cursor={{ fill: "var(--muted)", opacity: 0.2 }}
              />
              {/* Reference line budget medio per periodo */}
              {avgPerPeriod != null && (
                <ReferenceLine
                  y={avgPerPeriod}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: "media budget",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}
              <Bar
                dataKey="total"
                fill="url(#tripBarGradient)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1500}
                animationEasing="ease-out"
                className="transition-all duration-300 hover:opacity-80"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
