"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import { RefreshCw, Trash2, Calendar, Infinity as InfinityIcon } from "lucide-react";
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
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Badge } from "~/components/ui/badge";

// ─── Helpers ─────────────────────────────────────────────

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Mensile",
  weekly: "Settimanale",
  yearly: "Annuale",
};

const FREQUENCY_COLOR: Record<string, string> = {
  monthly: "#6366f1",
  weekly: "#22c55e",
  yearly: "#f97316",
};

// ─── Component ───────────────────────────────────────────

export function RecurringExpenseList() {
  const utils = api.useUtils();

  const { data: recurring, isLoading } = api.expense.getRecurring.useQuery();

  const deleteMutation = api.expense.delete.useMutation({
    onSuccess: async () => {
      await utils.expense.getRecurring.invalidate();
      toast.success("Spesa ricorrente eliminata");
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────

  if (!recurring || recurring.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Nessuna spesa ricorrente"
        description="Aggiungi una spesa e attiva l'opzione 'Spesa ricorrente' per vederla qui."
      />
    );
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {recurring.map((expense) => {
        const frequency = expense.recurringFrequency ?? "monthly";
        const frequencyLabel = FREQUENCY_LABEL[frequency] ?? frequency;
        const frequencyColor = FREQUENCY_COLOR[frequency] ?? "#6366f1";

        return (
          <div
            key={expense.id}
            className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm"
          >
            {/* Icona categoria */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${expense.category.color ?? "#6366f1"}20` }}
            >
              {expense.category.icon ?? "📁"}
            </div>

            {/* Info principale */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{expense.description}</span>
                {/* Badge frequenza */}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: frequencyColor }}
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  {frequencyLabel}
                </span>
                {/* Badge categoria */}
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: expense.category.color ?? "#6366f1",
                    color: "#fff",
                  }}
                >
                  {expense.category.name}
                </Badge>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Dal {formatDate(expense.date)}
                </span>
                <span className="flex items-center gap-1">
                  {expense.recurringEndDate ? (
                    <>
                      <Calendar className="h-3 w-3" />
                      Fino al {formatDate(expense.recurringEndDate)}
                    </>
                  ) : (
                    <>
                      <InfinityIcon className="h-3 w-3" />
                      Senza scadenza
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Importo */}
            <span className="shrink-0 text-lg font-bold tabular-nums">
              {formatCurrency(toNumber(expense.amount))}
            </span>

            {/* Elimina */}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare la ricorrenza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Verrà eliminato il template ricorrente per &quot;{expense.description}&quot;.
                    Le istanze già create rimarranno nella lista spese.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate({ id: expense.id })}
                  >
                    Elimina ricorrenza
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })}
    </div>
  );
}
