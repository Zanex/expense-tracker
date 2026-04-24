"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Plus, Receipt, Pencil, Trash2, Upload, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate, getCurrentMonth, getCurrentYear, toNumber } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import { ImportDialog } from "./import-dialog";
import { Button } from "~/components/ui/button";
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
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { ExpenseForm } from "./expense-form";
import { ExpenseFilters, type ExpenseFilters as Filters } from "./expense-filters";
import { Pagination } from "./pagination";
import { cn } from "~/lib/utils";

// ─── Component ───────────────────────────────────────────

export function ExpenseList() {
  const [filters, setFilters] = useState<Filters>({
    month: getCurrentMonth(),
    year: getCurrentYear(),
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 300);

  const { data, isLoading } = api.expense.getAll.useQuery({
    ...filters,
    search: debouncedSearch,
    page: currentPage,
    limit: 10,
  });

  const { data: editingExpense } = api.expense.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const utils = api.useUtils();

  const deleteMutation = api.expense.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.expense.getAll.invalidate(),
        utils.report.getSummary.invalidate(),
        utils.report.getByCategory.invalidate(),
        utils.report.getMonthlyTrend.invalidate(),
        utils.report.getBudgetAlerts.invalidate(),
      ]);
      toast.success("Spesa eliminata");
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDeletingId(null);
    },
  });

  function handleFiltersChange(newFilters: Filters) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleOpenCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingId(null);
  }

  function handleConfirmDelete() {
    if (!deletingId || deleteMutation.isPending) return;
    deleteMutation.mutate({ id: deletingId });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const expenses = data?.expenses ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Filtri + bottoni */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ExpenseFilters filters={filters} onChange={handleFiltersChange} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importa
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi spesa
            </Button>
          </div>
        </div>

        {/* Tabella o empty state */}
        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nessuna spesa"
            description={
              filters.month ?? filters.year ?? filters.categoryId ?? filters.search ?? filters.amountMin ?? filters.amountMax
                ? "Nessuna spesa trovata con i filtri selezionati."
                : "Aggiungi la tua prima spesa per iniziare."
            }
            action={{ label: "Aggiungi spesa", onClick: handleOpenCreate }}
          />
        ) : (
          <>
            <div className="rounded-lg border bg-card">
              {/* Desktop */}
              <div className="hidden md:block">
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
                    {expenses.map((expense) => {
                      // È un'istanza generata da una ricorrenza
                      const isRecurringInstance = !!expense.recurringParentId;
                      // È il template originale ricorrente
                      const isRecurringTemplate = expense.isRecurring && !expense.recurringParentId;

                      return (
                        <TableRow key={expense.id} className="group">
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(expense.date)}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{expense.description}</span>
                              {/* Badge ricorrente */}
                              {(isRecurringInstance || isRecurringTemplate) && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                    isRecurringTemplate
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                  title={
                                    isRecurringTemplate
                                      ? "Template ricorrente"
                                      : "Generata da ricorrenza"
                                  }
                                >
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  {isRecurringTemplate ? "ricorrente" : "auto"}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: expense.category.color ?? "#6366f1",
                                color: "#fff",
                              }}
                            >
                              {expense.category.icon ?? "📁"} {expense.category.name}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(toNumber(expense.amount))}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-end gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(expense.id)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingId(expense.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="flex flex-col divide-y md:hidden">
                {expenses.map((expense) => {
                  const isRecurringInstance = !!expense.recurringParentId;
                  const isRecurringTemplate = expense.isRecurring && !expense.recurringParentId;

                  return (
                    <div key={expense.id} className="flex items-start justify-between p-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">{expense.description}</p>
                          {(isRecurringInstance || isRecurringTemplate) && (
                            <RefreshCw
                              className={cn(
                                "h-3 w-3",
                                isRecurringTemplate ? "text-primary" : "text-muted-foreground"
                              )}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: expense.category.color ?? "#6366f1",
                              color: "#fff",
                            }}
                          >
                            {expense.category.icon ?? "📁"} {expense.category.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(expense.date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(toNumber(expense.amount))}
                        </span>
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(expense.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(expense.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paginazione */}
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

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica spesa" : "Aggiungi spesa"}
            </DialogTitle>
          </DialogHeader>
          {editingId && !editingExpense ? (
            <div className="flex flex-col gap-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ExpenseForm expense={editingExpense ?? undefined} onSuccess={handleDialogClose} />
          )}
        </DialogContent>
      </Dialog>

      {/* Alert dialog elimina */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la spesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import dialog */}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}