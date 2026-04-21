"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Plane } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { TripCard } from "./trip-card";
import { TripForm } from "./trip-form";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

type StatusFilter = "all" | "upcoming" | "ongoing" | "completed";

interface TripListProps {
  externalCreateOpen?: boolean;
  onExternalCreateClose?: () => void;
}

// ─── Tab config ───────────────────────────────────────────

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "Tutti" },
  { value: "upcoming",  label: "Pianificati" },
  { value: "ongoing",   label: "In corso" },
  { value: "completed", label: "Conclusi" },
];

// ─── Component ───────────────────────────────────────────

export function TripList({ externalCreateOpen = false, onExternalCreateClose }: TripListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Apertura dialog da bottone esterno (header pagina)
  useEffect(() => {
    if (externalCreateOpen) {
      setEditingId(null);
      setDialogOpen(true);
    }
  }, [externalCreateOpen]);

  const { data: trips, isLoading } = api.trip.getAll.useQuery(
    { status: statusFilter },
  );

  const { data: editingTrip } = api.trip.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  function handleOpenEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingId(null);
    onExternalCreateClose?.();
  }

  // ─── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {/* Tabs skeleton */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {TABS.map((t) => (
            <Skeleton key={t.value} className="h-8 w-24 rounded-md" />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-xl border bg-card">
              <Skeleton className="h-16 w-full" />
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                statusFilter === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid o empty state */}
        {!trips || trips.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={
              statusFilter === "all"
                ? "Nessun viaggio"
                : `Nessun viaggio ${TABS.find((t) => t.value === statusFilter)?.label.toLowerCase()}`
            }
            description={
              statusFilter === "all"
                ? "Crea il tuo primo viaggio per iniziare a tracciare le spese di viaggio."
                : "Cambia filtro per vedere altri viaggi."
            }
            action={
              statusFilter === "all"
                ? {
                    label: "Nuovo viaggio",
                    onClick: () => {
                      setEditingId(null);
                      setDialogOpen(true);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onEdit={handleOpenEdit} />
            ))}
          </div>
        )}
      </div>

      {/* Dialog create / edit */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica viaggio" : "Nuovo viaggio"}
            </DialogTitle>
          </DialogHeader>
          {editingId && !editingTrip ? (
            <div className="flex flex-col gap-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <TripForm
              trip={editingTrip ?? undefined}
              onSuccess={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
