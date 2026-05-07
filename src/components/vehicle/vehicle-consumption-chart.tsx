"use client";

import React from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency, toNumber } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Droplets } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────

/**
 * Calcola L/100km per ogni coppia di rifornimenti full tank consecutivi.
 * Restituisce array ordinato per data con: label, consumption, liters, km, costPerLiter.
 */
function buildConsumptionData(
  expenses: {
    amount: { toNumber: () => number } | number;
    date: Date;
    liters: { toNumber: () => number } | number | null;
    kmAtRefuel: number | null;
    fullTank: boolean | null;
  }[]
) {
  // Solo rifornimenti full tank con km registrati, ordinati per km
  const fullTanks = expenses
    .filter((e) => e.liters !== null && e.kmAtRefuel !== null && e.fullTank)
    .sort((a, b) => (a.kmAtRefuel ?? 0) - (b.kmAtRefuel ?? 0));

  if (fullTanks.length < 2) return [];

  const points = [];

  for (let i = 1; i < fullTanks.length; i++) {
    const prev = fullTanks[i - 1]!;
    const curr = fullTanks[i]!;

    const kmDriven = curr.kmAtRefuel! - prev.kmAtRefuel!;
    const liters = toNumber(curr.liters);
    const amount = toNumber(curr.amount);

    if (kmDriven <= 0 || liters <= 0) continue;

    const consumption = Math.round((liters / kmDriven) * 10000) / 100;
    const costPerLiter = Math.round((amount / liters) * 1000) / 1000;
    const date = new Date(curr.date);
    const label = date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });

    points.push({
      label,
      consumption,
      liters: Math.round(liters * 100) / 100,
      km: kmDriven,
      costPerLiter,
      cost: Math.round(amount * 100) / 100,
    });
  }

  return points;
}

// ─── Custom Tooltip ───────────────────────────────────────

interface TooltipPayload {
  value: number;
  dataKey: string;
  payload: {
    consumption: number;
    liters: number;
    km: number;
    costPerLiter: number;
    cost: number;
  };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none text-sm">
      <p className="mb-3 font-bold text-gradient uppercase tracking-wider text-xs">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" />
            Consumo
          </span>
          <span className="font-bold text-[#14b8a6]">{d.consumption} L/100km</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]" />
            Litri
          </span>
          <span className="font-medium">{d.liters} L</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Km percorsi</span>
          <span className="font-medium">{d.km.toLocaleString("it-IT")} km</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Prezzo/L</span>
          <span className="font-medium">€ {d.costPerLiter}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t pt-1">
          <span className="text-muted-foreground">Totale riforn.</span>
          <span className="font-semibold">{formatCurrency(d.cost)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────

interface VehicleConsumptionChartProps {
  vehicleId: string;
}

// ─── Component ───────────────────────────────────────────

export function VehicleConsumptionChart({ vehicleId }: VehicleConsumptionChartProps) {
  // Prende tutte le spese del veicolo senza filtro mese
  // Il consumo ha senso vederlo su tutto lo storico
  const { data, isLoading } = api.expense.getAll.useQuery({
    vehicleId,
    page: 1,
    limit: 100,
  });

  if (isLoading) return <ChartSkeleton />;

  const expenses = data?.expenses ?? [];
  const chartData = buildConsumptionData(expenses);

  // Media consumo per reference line
  const avgConsumption =
    chartData.length > 0
      ? Math.round(
          (chartData.reduce((sum, d) => sum + d.consumption, 0) / chartData.length) * 100
        ) / 100
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Consumo nel tempo (L/100km)
          </CardTitle>
          {avgConsumption !== null && (
            <span className="text-xs text-muted-foreground">
              Media:{" "}
              <span className="font-semibold text-foreground">
                {avgConsumption} L/100km
              </span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
          <EmptyState
            icon={Droplets}
            title="Dati insufficienti"
            description="Servono almeno 2 rifornimenti con pieno completo e km registrati."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} barSize={24} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="litersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.1} />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#14b8a6" floodOpacity="0.4" />
                </filter>
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
              />

              {/* Asse sinistro — L/100km */}
              <YAxis
                yAxisId="consumption"
                orientation="left"
                tickFormatter={(v: number) => `${v}L`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={["auto", "auto"]}
              />

              {/* Asse destro — litri */}
              <YAxis
                yAxisId="liters"
                orientation="right"
                tickFormatter={(v: number) => `${v}L`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.15 }} />

              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">
                    {value === "consumption" ? "L/100km" : "Litri riforniti"}
                  </span>
                )}
              />

              {/* Reference line — media consumo */}
              {avgConsumption !== null && (
                <ReferenceLine
                  yAxisId="consumption"
                  y={avgConsumption}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `media ${avgConsumption}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}

              <Bar
                yAxisId="liters"
                dataKey="liters"
                fill="url(#litersGradient)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={1500}
                animationEasing="ease-out"
              />

              {/* Linea consumo — asse sinistro */}
              <Line
                yAxisId="consumption"
                type="monotone"
                dataKey="consumption"
                stroke="#14b8a6"
                strokeWidth={3}
                dot={{ fill: "#14b8a6", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--background)", filter: "url(#lineGlow)" }}
                style={{ filter: "url(#lineGlow)" }}
                isAnimationActive={true}
                animationBegin={300}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}