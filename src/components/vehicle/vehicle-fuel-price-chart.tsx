"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { api } from "~/trpc/react";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Fuel } from "lucide-react";
import { toNumber } from "~/lib/utils";
import { cn } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────

function buildPriceData(
  expenses: {
    amount: { toNumber: () => number } | number;
    date: Date;
    liters: { toNumber: () => number } | number | null;
  }[]
) {
  return expenses
    .filter((e) => e.liters !== null)
    .map((e) => {
      const liters = toNumber(e.liters);
      const amount = toNumber(e.amount);
      if (liters <= 0) return null;

      return {
        label: new Date(e.date).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
        }),
        price: Math.round((amount / liters) * 1000) / 1000,
        liters: Math.round(liters * 100) / 100,
        total: Math.round(amount * 100) / 100,
        date: new Date(e.date).getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date - b!.date) as {
      label: string;
      price: number;
      liters: number;
      total: number;
      date: number;
    }[];
}

// ─── Custom Tooltip ───────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: { liters: number; total: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!;

  return (
    <div className="glass rounded-xl border border-white/10 bg-background/40 px-4 py-3 shadow-2xl backdrop-blur-xl outline-none text-sm">
      <p className="mb-2 font-bold text-gradient uppercase tracking-wider text-xs">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Prezzo/L</span>
          <span className="font-bold text-primary">
            € {d.value.toFixed(3)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Litri</span>
          <span className="font-medium">{d.payload.liters} L</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Totale</span>
          <span className="font-medium">€ {d.payload.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────

interface VehicleFuelPriceChartProps {
  vehicleId: string;
}

// ─── Component ───────────────────────────────────────────

export function VehicleFuelPriceChart({ vehicleId }: VehicleFuelPriceChartProps) {
  const { data, isLoading } = api.expense.getAll.useQuery({
    vehicleId,
    page: 1,
    limit: 100,
  });

  if (isLoading) return <ChartSkeleton />;

  const chartData = buildPriceData(data?.expenses ?? []);

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Storico prezzi carburante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Fuel}
            title="Dati insufficienti"
            description="Servono almeno 2 rifornimenti per vedere l'andamento prezzi."
          />
        </CardContent>
      </Card>
    );
  }

  // Calcola statistiche
  const prices = chartData.map((d) => d.price);
  const avgPrice = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 1000) / 1000;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Trend: confronta prima metà con seconda metà
  const half = Math.floor(chartData.length / 2);
  const firstHalfAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const secondHalfAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
  const trend = secondHalfAvg - firstHalfAvg;
  const TrendIcon = Math.abs(trend) < 0.01 ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  // Dominio Y con margine
  const yMin = Math.floor(minPrice * 10) / 10 - 0.05;
  const yMax = Math.ceil(maxPrice * 10) / 10 + 0.05;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Storico prezzi carburante
          </CardTitle>

          {/* Statistiche inline */}
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Media</span>
              <span className="font-semibold">€ {avgPrice.toFixed(3)}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Min</span>
              <span className="font-semibold text-green-600">
                € {minPrice.toFixed(3)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Max</span>
              <span className="font-semibold text-red-500">
                € {maxPrice.toFixed(3)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Trend</span>
              <span
                className={cn(
                  "flex items-center gap-0.5 font-semibold",
                  Math.abs(trend) < 0.01 && "text-muted-foreground",
                  trend > 0.01 && "text-red-500",
                  trend < -0.01 && "text-green-600"
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {trend > 0 ? "+" : ""}
                {trend.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <filter id="priceLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.4" />
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
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `€${v.toFixed(2)}`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Linea media */}
            <ReferenceLine
              y={avgPrice}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `media € ${avgPrice.toFixed(3)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />

            {/* Linea prezzi */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--background)", filter: "url(#priceLineGlow)" }}
              style={{ filter: "url(#priceLineGlow)" }}
              isAnimationActive={true}
              animationBegin={200}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}