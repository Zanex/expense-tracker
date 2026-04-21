"use client";

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
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md outline-none">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-popover-foreground">
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
            <BarChart data={data} barSize={28}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
                opacity={0.5}
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
                fill={color}
                radius={[4, 4, 0, 0]}
                opacity={0.9}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
