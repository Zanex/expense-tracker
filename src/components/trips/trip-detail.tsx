"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TripForm } from "~/components/trips/trip-form";
import { TripExportButton, TripDuplicateButton } from "~/components/trips/trip-actions";
import { TripKpiGrid } from "~/components/trips/trip-kpi-grid";
import { TripCategoryChart } from "~/components/trips/trip-category-chart";
import { TripSpendingTimeline } from "~/components/trips/trip-spending-timeline";
import { ExpenseForm } from "~/components/expenses/expense-form";
import { Pagination } from "~/components/expenses/pagination";
import { ChartErrorBoundary } from "~/components/ui/chart-error-boundary";
import { cn } from "~/lib/utils";

// ─── Status config ────────────────────────────────────────

const STATUS_CONFIG = {
  upcoming:  { label: "Pianificato", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ongoing:   { label: "In corso",    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  completed: { label: "Concluso",    className: "bg-muted text-muted-foreground" },
} as const;

// ─── Props ────────────────────────────────────────────────

interface TripDetailProps {
  tripId: string;
}

// ─── Component ───────────────────────────────────────────

export function TripDetail({ tripId }: TripDetailProps) {
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const utils = api.useUtils();

  const { data: trip, isLoading: tripLoading } = api.trip.getById.useQuery({ id: tripId });

  const { data: expensesData, isLoading: expensesLoading } = api.trip.getExpenses.useQuery({
    id: tripId,
    page: currentPage,
    limit: 15,
  });

  const { data: editingExpense } = api.expense.getById.useQuery(
    { id: editingExpenseId! },
    { enabled: !!editingExpenseId }
  );

  const deleteExpenseMutation = api.expense.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.trip.getExpenses.invalidate({ id: tripId }),
        utils.trip.getById.invalidate({ id: tripId }),
        utils.trip.getSummary.invalidate({ id: tripId }),
        utils.trip.getSpendingTimeline.invalidate({ id: tripId }),
      ]);
      toast.success("Spesa eliminata");
      setDeletingExpenseId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDeletingExpenseId(null);
    },
  });

  function handleExpenseSuccess() {
    setAddExpenseOpen(false);
    setEditingExpenseId(null);
    void utils.trip.getExpenses.invalidate({ id: tripId });
    void utils.trip.getById.invalidate({ id: tripId });
    void utils.trip.getSummary.invalidate({ id: tripId });
    void utils.trip.getSpendingTimeline.invalidate({ id: tripId });
  }

  // ─── Loading skeleton ──────────────────────────────────

  if (tripLoading || !trip) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const color = trip.coverColor ?? "#6366f1";
  const emoji = trip.coverEmoji ?? "✈️";
  const statusCfg = STATUS_CONFIG[trip.status];
  const expenses = expensesData?.expenses ?? [];
  const pagination = expensesData?.pagination;
  const budget = trip.budget != null ? toNumber(trip.budget) : null;

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* Back link */}
        <Link
          href="/trips"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tutti i viaggi
        </Link>

        {/* ── Header ──────────────────────────────── */}
        <div
          className="flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-start sm:justify-between"
          style={{ backgroundColor: `${color}12`, border: `1.5px solid ${color}28` }}
        >
          <div className="flex items-start gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl shadow"
              style={{ backgroundColor: color }}
            >
              {emoji}
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold leading-tight" style={{ color }}>
                  {trip.name}
                </h1>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusCfg.className)}>
                  {statusCfg.label}
                </span>
              </div>
              {trip.destination && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {trip.destination}
                </span>
              )}
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(trip.startDate)}
                {trip.endDate && <> — {formatDate(trip.endDate)}</>}
                {trip.duration && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ backgroundColor: `${color}18`, color }}
                  >
                    {trip.duration} {trip.duration === 1 ? "giorno" : "giorni"}
                  </span>
                )}
              </span>
              {trip.notes && (
                <p className="mt-0.5 max-w-md text-sm text-muted-foreground leading-relaxed">
                  {trip.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            <TripExportButton tripId={tripId} tripName={trip.name} />
            <TripDuplicateButton
              tripId={tripId}
              tripName={trip.name}
              originalStartDate={trip.startDate}
              originalEndDate={trip.endDate ?? null}
            />
            <Button variant="outline" size="sm" onClick={() => setEditTripOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Modifica
            </Button>
            <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Aggiungi spesa
            </Button>
          </div>
        </div>

        {/* ── KPI + budget bar ─────────────────────── */}
        <TripKpiGrid tripId={tripId} coverColor={color} />

        {/* ── Grafici ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartErrorBoundary title="Spese per categoria">
            <TripCategoryChart tripId={tripId} />
          </ChartErrorBoundary>
          <ChartErrorBoundary title="Spese nel tempo">
            <TripSpendingTimeline
              tripId={tripId}
              duration={trip.duration}
              coverColor={color}
              budget={budget}
            />
          </ChartErrorBoundary>
        </div>

        {/* ── Lista spese ───────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Spese del viaggio
              {pagination && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({pagination.totalCount})
                </span>
              )}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setAddExpenseOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Aggiungi
            </Button>
          </div>

          {expensesLoading ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nessuna spesa"
              description="Aggiungi la prima spesa a questo viaggio."
              action={{ label: "Aggiungi spesa", onClick: () => setAddExpenseOpen(true) }}
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden rounded-xl border bg-card overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Importo</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id} className="group">
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{expense.description}</span>
                            {expense.recurringParentId && (
                              <RefreshCw className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            style={{ backgroundColor: expense.category.color ?? "#6366f1", color: "#fff" }}
                          >
                            {expense.category.icon ?? "📁"} {expense.category.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(toNumber(expense.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingExpenseId(expense.id); setAddExpenseOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeletingExpenseId(expense.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="flex flex-col divide-y rounded-xl border bg-card overflow-hidden md:hidden">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-start justify-between p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium">{expense.description}</p>
                        {expense.recurringParentId && (
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: expense.category.color ?? "#6366f1", color: "#fff" }}
                        >
                          {expense.category.icon ?? "📁"} {expense.category.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(expense.date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(toNumber(expense.amount))}
                      </span>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingExpenseId(expense.id); setAddExpenseOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingExpenseId(expense.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {pagination && (
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  limit={pagination.limit}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog modifica viaggio */}
      <Dialog open={editTripOpen} onOpenChange={setEditTripOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica viaggio</DialogTitle>
          </DialogHeader>
          <TripForm trip={trip} onSuccess={() => setEditTripOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog spesa */}
      <Dialog open={addExpenseOpen} onOpenChange={(open) => { if (!open) { setAddExpenseOpen(false); setEditingExpenseId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpenseId ? "Modifica spesa" : "Aggiungi spesa"}</DialogTitle>
          </DialogHeader>
          {editingExpenseId && !editingExpense ? (
            <div className="flex flex-col gap-4 py-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <ExpenseForm
              expense={editingExpense ?? undefined}
              defaultTripId={tripId}
              onSuccess={handleExpenseSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Alert elimina spesa */}
      <AlertDialog open={!!deletingExpenseId} onOpenChange={(open) => !open && setDeletingExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la spesa?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non è reversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingExpenseId && deleteExpenseMutation.mutate({ id: deletingExpenseId })}
              disabled={deleteExpenseMutation.isPending}
            >
              {deleteExpenseMutation.isPending ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}