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
    <Card>
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
          <div className="grid grid-cols-3 divide-x">

            {/* Costo mese corrente */}
            <div className="flex flex-col gap-1 pr-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Fuel className="h-3 w-3" />
                Questo mese
              </span>
              <span className="text-xl font-bold tabular-nums">
                {formatCurrency(monthTotal)}
              </span>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {currentMonth && currentMonth.fuel > 0 && (
                  <span>⛽ {formatCurrency(currentMonth.fuel)}</span>
                )}
                {currentMonth && currentMonth.expenses > 0 && (
                  <span>🔧 {formatCurrency(currentMonth.expenses)}</span>
                )}
                {monthTotal === 0 && (
                  <span>Nessuna spesa</span>
                )}
              </div>
            </div>

            {/* Km percorsi totali */}
            <div className="flex flex-col gap-1 px-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3 w-3" />
                Km attuali
              </span>
              <span className="text-xl font-bold tabular-nums">
                {(summary?.currentKm ?? 0).toLocaleString("it-IT")}
              </span>
              <span className="text-xs text-muted-foreground">
                {summary?.totalKm
                  ? `+${summary.totalKm.toLocaleString("it-IT")} tracciati`
                  : "Nessun dato"}
              </span>
            </div>

            {/* Consumo medio */}
            <div className="flex flex-col gap-1 pl-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Droplets className="h-3 w-3" />
                Consumo medio
              </span>
              <span className="text-xl font-bold tabular-nums">
                {summary?.avgConsumption != null
                  ? `${summary.avgConsumption}`
                  : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {summary?.avgConsumption != null
                  ? "L/100km"
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