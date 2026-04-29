"use client";

import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { Fuel, Gauge, TrendingUp, Wrench, Droplets, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  isLoading?: boolean;
}

function KpiCard({ title, value, description, icon: Icon, isLoading }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="rounded-full bg-primary/10 p-2 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface VehicleKpiGridProps {
  vehicleId: string;
}

export function VehicleKpiGrid({ vehicleId }: VehicleKpiGridProps) {
  const { data: summary, isLoading } = api.vehicle.getSummary.useQuery({ vehicleId });

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <KpiCard
        title="Costo totale"
        value={isLoading ? "—" : formatCurrency(summary?.totalCost ?? 0)}
        description={`Spese: ${formatCurrency(summary?.totalExpenses ?? 0)} · Carburante: ${formatCurrency(summary?.totalFuel ?? 0)}`}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <KpiCard
        title="Km percorsi"
        value={isLoading ? "—" : `${(summary?.totalKm ?? 0).toLocaleString("it-IT")} km`}
        description={summary?.currentKm ? `Km attuali: ${summary.currentKm.toLocaleString("it-IT")}` : undefined}
        icon={Gauge}
        isLoading={isLoading}
      />
      <KpiCard
        title="Costo / km"
        value={isLoading ? "—" : summary?.costPerKm != null ? `€ ${summary.costPerKm}` : "—"}
        description="Costo totale diviso km percorsi"
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <KpiCard
        title="Carburante"
        value={isLoading ? "—" : formatCurrency(summary?.totalFuel ?? 0)}
        description={`${summary?.totalLiters ?? 0} litri · ${summary?.refuelCount ?? 0} rifornimenti`}
        icon={Fuel}
        isLoading={isLoading}
      />
      <KpiCard
        title="Consumo medio"
        value={isLoading ? "—" : summary?.avgConsumption != null ? `${summary.avgConsumption} L/100km` : "—"}
        description="Calcolato su rifornimenti full tank"
        icon={Droplets}
        isLoading={isLoading}
      />
      <KpiCard
        title="Spese collegate"
        value={isLoading ? "—" : String(summary?.expenseCount ?? 0)}
        description={summary?.lastRefuelDate
          ? `Ultimo riforn.: ${new Date(summary.lastRefuelDate).toLocaleDateString("it-IT")}`
          : "Nessun rifornimento"}
        icon={summary?.lastRefuelDate ? Calendar : Wrench}
        isLoading={isLoading}
      />
    </div>
  );
}