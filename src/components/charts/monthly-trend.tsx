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
  Cell,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ─── Types ────────────────────────────────────────────────

interface MonthlyTrendProps {
  month: number;
  year: number;
  months?: number;  // quanti mesi mostrare (default 6)
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
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none">
      <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)] mt-1">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function MonthlyTrend({ month, year, months = 6 }: MonthlyTrendProps) {
  const { data, isLoading } = api.report.getMonthlyTrend.useQuery({
    month,
    year,
    months,
  });

  if (isLoading) return <ChartSkeleton />;

  const hasData = data?.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Andamento ultimi {months} mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !hasData ? (
          <EmptyState
            icon={BarChart2}
            title="Nessun dato"
            description="Nessuna spesa registrata nel periodo selezionato."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} barSize={36} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="currentColor" className="text-muted-foreground/20" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`
                }
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: "var(--muted)", opacity: 0.15 }} 
              />
              <Bar 
                dataKey="total" 
                radius={[6, 6, 0, 0]}
                isAnimationActive={true}
                animationBegin={200}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.month === month && entry.year === year
                        ? "url(#barGradientActive)"
                        : "url(#barGradient)"
                    }
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
