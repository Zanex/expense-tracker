"use client";

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
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-md outline-none">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
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
            <BarChart data={data} barSize={14} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
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
              <Bar dataKey="fuel" fill="#f97316" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="expenses" fill="#6366f1" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}