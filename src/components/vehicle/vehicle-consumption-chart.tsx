"use client";

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
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-md outline-none text-sm">
      <p className="mb-2 font-medium text-muted-foreground">{label}</p>
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
            <ComposedChart data={chartData} barSize={20}>
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

              {/* Barre litri — asse destro */}
              <Bar
                yAxisId="liters"
                dataKey="liters"
                fill="#f97316"
                opacity={0.5}
                radius={[3, 3, 0, 0]}
              />

              {/* Linea consumo — asse sinistro */}
              <Line
                yAxisId="consumption"
                type="monotone"
                dataKey="consumption"
                stroke="#14b8a6"
                strokeWidth={2.5}
                dot={{ fill: "#14b8a6", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}