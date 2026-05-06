"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { Car, ArrowRight, Fuel, Gauge, Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function VehicleWidget() {
  const { data: vehicles, isLoading: vehiclesLoading } = api.vehicle.getAll.useQuery();

  const vehicle = vehicles?.[0];

  const { data: summary, isLoading: summaryLoading } = api.vehicle.getSummary.useQuery(
    { vehicleId: vehicle?.id ?? "", month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    { enabled: !!vehicle?.id, staleTime: 5 * 60 * 1000 }
  );

  const { data: trend, isLoading: trendLoading } = api.vehicle.getMonthlyTrend.useQuery(
    { vehicleId: vehicle?.id ?? "", months: 1 },
    { enabled: !!vehicle?.id, staleTime: 5 * 60 * 1000 }
  );

  const isLoading = vehiclesLoading || summaryLoading || trendLoading;

  // Non mostrare se nessun veicolo
  if (!vehiclesLoading && !vehicle) return null;

  const currentMonth = trend?.[0];
  const monthTotal = currentMonth
    ? currentMonth.fuel + currentMonth.expenses
    : 0;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Car className="h-4 w-4" />
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              vehicle?.name ?? "Veicolo"
            )}
          </CardTitle>
          <Link
            href="/vehicle"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Vedi tutto
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Costo mese corrente */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary/70">
                <Fuel className="h-3.5 w-3.5" />
                Questo mese
              </span>
              <span className="text-3xl font-bold tabular-nums text-gradient">
                {formatCurrency(monthTotal)}
              </span>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                {currentMonth?.fuel !== undefined && currentMonth.fuel > 0 && (
                  <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10">⛽ {formatCurrency(currentMonth.fuel)}</span>
                )}
                {currentMonth?.expenses !== undefined && currentMonth.expenses > 0 && (
                  <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10">🔧 {formatCurrency(currentMonth.expenses)}</span>
                )}
              </div>
            </div>

            {/* Km percorsi totali */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                Km attuali
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {(summary?.currentKm ?? 0).toLocaleString("it-IT")}
              </span>
              <span className="text-xs text-muted-foreground mt-auto">
                {summary?.totalKm != null
                  ? `+${summary.totalKm.toLocaleString("it-IT")} tracciati`
                  : "In attesa di dati"}
              </span>
            </div>

            {/* Consumo medio */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-accent/5 border border-accent/10">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Droplets className="h-3.5 w-3.5" />
                Efficienza
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">
                  {summary?.avgConsumption != null
                    ? `${summary.avgConsumption}`
                    : "—"}
                </span>
                {summary?.avgConsumption != null && (
                  <span className="text-xs text-muted-foreground font-medium">L/100km</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground mt-auto">
                {summary?.avgConsumption != null
                  ? "Ottimo rendimento"
                  : "Servono ≥2 pieni"}
              </span>
            </div>
          </div>
        )}

        {/* Footer: costo totale + costo/km */}
        {!isLoading && summary && (
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>
              Costo totale: <span className="font-medium text-foreground">{formatCurrency(summary.totalCost)}</span>
            </span>
            {summary.costPerKm != null && (
              <span>
                Costo/km: <span className="font-medium text-foreground">€ {summary.costPerKm}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}