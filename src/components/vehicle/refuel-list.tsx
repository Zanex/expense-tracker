"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import { Fuel, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Pagination } from "~/components/expenses/pagination";

interface RefuelListProps {
  vehicleId: string;
}

export function RefuelList({ vehicleId }: RefuelListProps) {
  const [page, setPage] = useState(1);
  const utils = api.useUtils();

  const { data, isLoading } = api.expense.getAll.useQuery({
    vehicleId,
    page,
    limit: 10,
    onlyRefuels: true,
  });

  const deleteMutation = api.expense.delete.useMutation({
    onSuccess: async () => {
      await utils.expense.getAll.invalidate();
      await utils.vehicle.getSummary.invalidate({ vehicleId });
      await utils.vehicle.getMonthlyTrend.invalidate({ vehicleId });
      toast.success("Rifornimento eliminato");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Filtra solo le spese con liters (rifornimenti)
  const refuels = data?.expenses ?? [];

  if (!refuels.length) {
    return (
      <EmptyState
        icon={Fuel}
        title="Nessun rifornimento"
        description="Registra il tuo primo rifornimento."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {refuels.map((refuel) => {
        const liters = toNumber(refuel.liters);
        const pricePerLiter = liters > 0
          ? toNumber(refuel.amount) / liters
          : 0;

        return (
          <div
            key={refuel.id}
            className="group flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-950/20">
                <Fuel className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums">
                    {liters.toFixed(2)} L
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    € {pricePerLiter.toFixed(3)}/L
                  </span>
                  {refuel.fullTank && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      pieno
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(refuel.date)}</span>
                  {refuel.kmAtRefuel && (
                    <>
                      <span>·</span>
                      <span>{refuel.kmAtRefuel.toLocaleString("it-IT")} km</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums">
                {formatCurrency(toNumber(refuel.amount))}
              </span>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare il rifornimento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non è reversibile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate({ id: refuel.id })}
                    >
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}

      {data?.pagination && (
        <Pagination
          currentPage={data.pagination.currentPage}
          totalPages={data.pagination.totalPages}
          totalCount={data.pagination.totalCount}
          limit={data.pagination.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}