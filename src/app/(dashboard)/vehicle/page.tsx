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
      <div className="flex flex-col gap-6">

        {/* Header veicolo + filtro mese */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Info veicolo */}
          <div
            className="flex flex-1 items-start gap-4 rounded-xl p-4"
            style={{ backgroundColor: "#6366f118", border: "1.5px solid #6366f128" }}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl shadow"
              style={{ backgroundColor: "#6366f1" }}
            >
              🚗
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold" style={{ color: "#6366f1" }}>
                {vehicle.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {vehicle.plate && (
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs uppercase">
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

        {/* KPI Grid — filtrati per mese */}
        <VehicleKpiGrid
          vehicleId={vehicle.id}
          month={filter.month}
          year={filter.year}
        />

        {/* Grafico mensile */}
        <ChartErrorBoundary title="Costi mensili">
          <VehicleMonthlyChart vehicleId={vehicle.id} />
        </ChartErrorBoundary>

        <ChartErrorBoundary title="Consumo nel tempo">
          <VehicleConsumptionChart vehicleId={vehicle.id} />
        </ChartErrorBoundary>
        {/* Tab rifornimenti / spese — filtrati per mese */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
              {(["rifornimenti", "spese"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all capitalize",
                    activeTab === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
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