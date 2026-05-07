"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { PieChart as PieIcon } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ─── Types ────────────────────────────────────────────────

interface ExpensesByCategoryProps {
  month: number;
  year: number;
}

// ─── Custom Tooltip ───────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  payload: { color: string };
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
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none">
      <p className="text-sm font-bold text-gradient">{item.name}</p>
      <p className="text-lg font-semibold text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]">
        {formatCurrency(item.value)}
      </p>
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
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Component ───────────────────────────────────────────

export function ExpensesByCategory({ month, year }: ExpensesByCategoryProps) {
  const { data, isLoading } = api.report.getByCategory.useQuery({
    month,
    year,
  });

  if (isLoading) return <ChartSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Spese per categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <EmptyState
            icon={PieIcon}
            title="Nessun dato"
            description="Nessuna spesa registrata per questo mese."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3" />
                </filter>
              </defs>
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {data.map((entry) => {
                  if (!entry) return null;
                  return (
                    <Cell
                      key={entry.id}
                      fill={entry.color ?? "#6366f1"}
                      stroke="var(--background)"
                      strokeWidth={2}
                      style={{ filter: "url(#glow)", outline: "none" }}
                    />
                  );
                })}
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
