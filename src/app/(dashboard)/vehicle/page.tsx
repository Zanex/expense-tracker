"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Plus, Car, Pencil, Fuel, Receipt } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { VehicleForm } from "~/components/vehicle/vehicle-form";
import { VehicleKpiGrid } from "~/components/vehicle/vehicle-kpi-grid";
import { VehicleMonthlyChart } from "~/components/vehicle/vehicle-monthly-chart";
import { RefuelForm } from "~/components/vehicle/refuel-form";
import { RefuelList } from "~/components/vehicle/refuel-list";
import { VehicleExpenseList } from "~/components/vehicle/vehicle-expense-list";
import { VehicleConsumptionChart } from "~/components/vehicle/vehicle-consumption-chart";
import { VehicleExportButton } from "~/components/vehicle/vehicle-export-button";
import { VehicleServiceAlert } from "~/components/vehicle/vehicle-service-alert";
import { VehicleFuelPriceChart } from "~/components/vehicle/vehicle-fuel-price-chart";
import { MonthFilterControl } from "~/components/dashboard/month-filter";
import { ChartErrorBoundary } from "~/components/ui/chart-error-boundary";
import { useMonthFilter } from "~/hooks/use-month-filter";
import { cn } from "~/lib/utils";

type Tab = "rifornimenti" | "spese";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Benzina",
  diesel: "Diesel",
  electric: "Elettrico",
  hybrid: "Ibrido",
};

export default function VehiclePage() {
  const [createVehicleOpen, setCreateVehicleOpen] = useState(false);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [addRefuelOpen, setAddRefuelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("rifornimenti");

  const filter = useMonthFilter();

  const { data: vehicles, isLoading } = api.vehicle.getAll.useQuery();
  const vehicle = vehicles?.[0];

  // ─── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────

  if (!vehicle) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Veicolo</h1>
          <p className="text-sm text-muted-foreground">Traccia i costi della tua auto.</p>
        </div>
        <EmptyState
          icon={Car}
          title="Nessun veicolo"
          description="Aggiungi il tuo veicolo per iniziare a tracciare rifornimenti e spese."
          action={{ label: "Aggiungi veicolo", onClick: () => setCreateVehicleOpen(true) }}
        />
        <Dialog open={createVehicleOpen} onOpenChange={setCreateVehicleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Aggiungi veicolo</DialogTitle></DialogHeader>
            <VehicleForm onSuccess={() => setCreateVehicleOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-8 chaos-entrance">

        {/* Header veicolo + filtro mese */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Info veicolo */}
          <div
            className="glass flex flex-1 items-start gap-5 rounded-3xl p-6 transition-all duration-300 hover:bg-background/50"
          >
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-lg shadow-primary/20 bg-primary"
            >
              🚗
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold text-gradient">
                {vehicle.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {vehicle.plate && (
                  <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-xs uppercase text-primary">
                    {vehicle.plate}
                  </span>
                )}
                {vehicle.year && <span>{vehicle.year}</span>}
                <span>{FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType}</span>
                <span>·</span>
                <span>{vehicle.initialKm.toLocaleString("it-IT")} km iniziali</span>
              </div>
            </div>
          </div>

          {/* Controlli destra */}
          <div className="flex flex-col items-end gap-2">
            {/* Filtro mese */}
            <MonthFilterControl filter={filter} />
            {/* Azioni */}
            <div className="flex gap-2">
              <VehicleExportButton
                vehicleId={vehicle.id}
                vehicleName={vehicle.name}
              />
              <Button variant="outline" size="sm" onClick={() => setAddRefuelOpen(true)}>
                <Fuel className="mr-1.5 h-3.5 w-3.5" />
                Rifornimento
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditVehicleOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Modifica
              </Button>
            </div>
          </div>
        </div>

        {/* Alert manutenzione — appare solo se configurato e necessario */}
        <VehicleServiceAlert vehicleId={vehicle.id} />

        {/* KPI Grid — filtrati per mese */}
        <VehicleKpiGrid
          vehicleId={vehicle.id}
          month={filter.month}
          year={filter.year}
        />

        {/* Prima riga — costi + consumi */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartErrorBoundary title="Costi mensili">
            <VehicleMonthlyChart vehicleId={vehicle.id} />
          </ChartErrorBoundary>
          <ChartErrorBoundary title="Consumo nel tempo">
            <VehicleConsumptionChart vehicleId={vehicle.id} />
          </ChartErrorBoundary>
        </div>

        {/* Seconda riga — prezzi carburante a larghezza piena */}
        <ChartErrorBoundary title="Storico prezzi carburante">
          <VehicleFuelPriceChart vehicleId={vehicle.id} />
        </ChartErrorBoundary>

        {/* Tab rifornimenti / spese — filtrati per mese */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-2xl border border-white/10 bg-background/20 backdrop-blur-md p-1.5 w-fit">
              {(["rifornimenti", "spese"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all capitalize",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {tab === "rifornimenti" ? (
                    <Fuel className="h-4 w-4" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "rifornimenti" && (
              <Button size="sm" onClick={() => setAddRefuelOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Aggiungi
              </Button>
            )}
          </div>

          {activeTab === "rifornimenti" ? (
            <RefuelList
              vehicleId={vehicle.id}
              month={filter.month}
              year={filter.year}
            />
          ) : (
            <VehicleExpenseList
              vehicleId={vehicle.id}
              month={filter.month}
              year={filter.year}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={editVehicleOpen} onOpenChange={setEditVehicleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Modifica veicolo</DialogTitle></DialogHeader>
          <VehicleForm vehicle={vehicle} onSuccess={() => setEditVehicleOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={addRefuelOpen} onOpenChange={setAddRefuelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuovo rifornimento</DialogTitle></DialogHeader>
          <RefuelForm vehicleId={vehicle.id} onSuccess={() => setAddRefuelOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}