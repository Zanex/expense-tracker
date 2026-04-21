"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "~/lib/utils";
import { Pencil, Trash2, MapPin, Calendar, Receipt } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface TripCardProps {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: Date;
    endDate: Date | null;
    budget: { toNumber: () => number } | number | null;
    coverColor: string | null;
    coverEmoji: string | null;
    totalSpent: number;
    budgetRemaining: number | null;
    status: "upcoming" | "ongoing" | "completed";
    duration: number | null;
    expenseCount: number;
  };
  onEdit: (id: string) => void;
}

// ─── Status badge ─────────────────────────────────────────

const STATUS_CONFIG = {
  upcoming: { label: "Pianificato", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ongoing:  { label: "In corso",    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  completed:{ label: "Concluso",    className: "bg-muted text-muted-foreground" },
} as const;

// ─── Component ───────────────────────────────────────────

export function TripCard({ trip, onEdit }: TripCardProps) {
  const utils = api.useUtils();
  const color = trip.coverColor ?? "#6366f1";
  const emoji = trip.coverEmoji ?? "✈️";
  const budget = typeof trip.budget === "object" && trip.budget !== null && "toNumber" in trip.budget
    ? trip.budget.toNumber()
    : (trip.budget as number | null);

  const budgetPercentage =
    budget != null && budget > 0
      ? Math.min(Math.round((trip.totalSpent / budget) * 100), 100)
      : null;

  const overBudget = budget != null && trip.totalSpent > budget;

  const deleteMutation = api.trip.delete.useMutation({
    onSuccess: async () => {
      await utils.trip.getAll.invalidate();
      toast.success("Viaggio eliminato");
    },
    onError: (err) => toast.error(err.message),
  });

  const statusCfg = STATUS_CONFIG[trip.status];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Header colorato */}
      <div
        className="relative flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: `${color}18`, borderBottom: `2px solid ${color}30` }}
      >
        {/* Emoji + nome */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl shadow-sm"
            style={{ backgroundColor: color }}
          >
            {emoji}
          </span>
          <div className="flex flex-col gap-0.5">
            <Link
              href={`/trips/${trip.id}`}
              className="font-semibold leading-tight hover:underline"
              style={{ color }}
            >
              {trip.name}
            </Link>
            {trip.destination && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {trip.destination}
              </span>
            )}
          </div>
        </div>

        {/* Status badge + azioni */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusCfg.className
            )}
          >
            {statusCfg.label}
          </span>

          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(trip.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare il viaggio?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le spese collegate a &quot;{trip.name}&quot; non verranno eliminate,
                    ma perderanno il riferimento al viaggio.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate({ id: trip.id })}
                  >
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Body */}
      <Link href={`/trips/${trip.id}`} className="flex flex-col gap-3 p-4">
        {/* Date + durata */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(trip.startDate)}
            {trip.endDate && <> — {formatDate(trip.endDate)}</>}
          </span>
          {trip.duration && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {trip.duration} {trip.duration === 1 ? "giorno" : "giorni"}
            </span>
          )}
        </div>

        {/* KPI row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            <span>
              {trip.expenseCount === 0
                ? "Nessuna spesa"
                : `${trip.expenseCount} ${trip.expenseCount === 1 ? "spesa" : "spese"}`}
            </span>
          </div>
          <span className="text-base font-bold tabular-nums">
            {formatCurrency(trip.totalSpent)}
          </span>
        </div>

        {/* Budget progress — solo se budget impostato */}
        {budget != null && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overBudget ? "bg-red-500" : "bg-primary"
                )}
                style={{
                  width: `${budgetPercentage ?? 0}%`,
                  backgroundColor: overBudget ? undefined : color,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={cn(overBudget && "font-medium text-red-500")}>
                {overBudget
                  ? `Over budget +${Math.round(((trip.totalSpent - budget) / budget) * 100)}%`
                  : `${budgetPercentage ?? 0}% del budget`}
              </span>
              <span className="tabular-nums">
                {formatCurrency(trip.totalSpent)} / {formatCurrency(budget)}
              </span>
            </div>
          </div>
        )}
      </Link>
    </div>
  );
}
