"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart2 } from "lucide-react";

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fuel = payload.find((p) => p.dataKey === "fuel")?.value ?? 0;
  const expenses = payload.find((p) => p.dataKey === "expenses")?.value ?? 0;

  return (
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none">
      <p className="mb-2 text-xs font-bold text-gradient uppercase tracking-wider">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]" />
            Carburante
          </span>
          <span className="text-xs font-medium tabular-nums">{formatCurrency(fuel)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
            Spese
          </span>
          <span className="text-xs font-medium tabular-nums">{formatCurrency(expenses)}</span>
        </div>
        <div className="mt-1 border-t pt-1 text-xs font-semibold">
          Totale: {formatCurrency(fuel + expenses)}
        </div>
      </div>
    </div>
  );
}

interface VehicleMonthlyChartProps {
  vehicleId: string;
}

export function VehicleMonthlyChart({ vehicleId }: VehicleMonthlyChartProps) {
  const { data, isLoading } = api.vehicle.getMonthlyTrend.useQuery({
    vehicleId,
    months: 12,
  });

  if (isLoading) return <ChartSkeleton />;

  const hasData = data?.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Costi ultimi 12 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            icon={BarChart2}
            title="Nessun dato"
            description="Aggiungi rifornimenti o spese per vedere il grafico."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} barSize={16} barGap={2} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="currentColor" className="text-muted-foreground/20" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.15 }} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">
                    {value === "fuel" ? "Carburante" : "Spese"}
                  </span>
                )}
              />
              <Bar 
                dataKey="fuel" 
                fill="url(#fuelGradient)" 
                radius={[0, 0, 0, 0]} 
                stackId="a" 
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1500}
                animationEasing="ease-out"
              />
              <Bar 
                dataKey="expenses" 
                fill="url(#expensesGradient)" 
                radius={[4, 4, 0, 0]} 
                stackId="a" 
                isAnimationActive={true}
                animationBegin={200}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}