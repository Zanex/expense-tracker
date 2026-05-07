"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PieChart as PieIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface TripCategoryChartProps {
  tripId: string;
}

// ─── Custom Tooltip ───────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  payload: { color: string; percentage: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (!item) return null;

  return (
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none text-sm">
      <p className="font-bold text-gradient mb-1">{item.name}</p>
      <p className="tabular-nums font-semibold text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">
        {formatCurrency(item.value)}
      </p>
      <p className="text-muted-foreground/80 font-medium text-xs mt-1">{item.payload.percentage}% del totale</p>
    </div>
  );
}

// ─── Custom Legend ────────────────────────────────────────

function CustomLegend({
  payload,
}: {
  payload?: { value: string; color: string }[];
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Component ───────────────────────────────────────────

export function TripCategoryChart({ tripId }: TripCategoryChartProps) {
  const { data: summary, isLoading } = api.trip.getSummary.useQuery({ id: tripId });

  if (isLoading) return <ChartSkeleton />;

  const data = summary?.categoryBreakdown ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Spese per categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={PieIcon}
            title="Nessun dato"
            description="Aggiungi spese al viaggio per vedere il breakdown."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <defs>
                <filter id="tripPieGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.3" />
                </filter>
              </defs>
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={3}
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry?.id}
                    fill={entry?.color ?? "#6366f1"}
                    stroke="var(--background)"
                    strokeWidth={2}
                    style={{ filter: "url(#tripPieGlow)", outline: "none" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
