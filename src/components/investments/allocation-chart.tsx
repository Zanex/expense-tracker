"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

// ─── Config ───────────────────────────────────────────────

const COLORS = [
  "#6366f1", "#22c55e", "#f97316", "#14b8a6",
  "#ec4899", "#eab308", "#3b82f6", "#a855f7",
];

const TYPE_EMOJI: Record<string, string> = {
  etf: "📊", stock: "🏢", crypto: "₿", fund: "🏦",
  bond: "📜", gold: "🥇", cash: "💶",
};

// ─── Custom tooltip ───────────────────────────────────────

interface TooltipEntry {
  name: string;
  value: number;
  payload: { percentage: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="tabular-nums">{formatCurrency(item.value)}</p>
      <p className="text-muted-foreground">{item.payload.percentage}%</p>
    </div>
  );
}

// ─── Custom legend ────────────────────────────────────────

function CustomLegend({ items }: { items: { name: string; value: number; percentage: number; color: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-muted-foreground capitalize">{item.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 tabular-nums">
            <span className="text-xs text-muted-foreground">{item.percentage}%</span>
            <span className="font-medium">{formatCurrency(item.value)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

type View = "type" | "platform";

export function AllocationChart() {
  const [view, setView] = useState<View>("type");

  const { data: summary, isLoading } = api.investment.getSummary.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center justify-center">
          <Skeleton className="h-48 w-48 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary || summary.positionCount === 0) return null;

  const rawData = view === "type"
    ? summary.allocationByType.map((t) => ({
        name: `${TYPE_EMOJI[t.type] ?? "📈"} ${t.type}`,
        value: t.value,
        percentage: t.percentage,
      }))
    : summary.allocationByPlatform.map((p) => ({
        name: p.platform,
        value: p.value,
        percentage: p.percentage,
      }));

  const chartData = rawData.map((d, i) => ({
    ...d,
    color: COLORS[i % COLORS.length]!,
  }));

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Allocazione</h3>

        {/* Toggle tipo / piattaforma */}
        <div className="flex rounded-lg border bg-muted p-0.5 text-xs font-medium">
          {(["type", "platform"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 transition-all",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "type" ? "Per tipo" : "Per piattaforma"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda custom */}
      <CustomLegend items={chartData} />

      {/* Totale */}
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Totale portafoglio</span>
        <span className="font-bold tabular-nums">{formatCurrency(summary.totalValue)}</span>
      </div>
    </div>
  );
}
