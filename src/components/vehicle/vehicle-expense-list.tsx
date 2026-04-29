"use client";

import { api } from "~/trpc/react";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import { Receipt } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";

interface VehicleExpenseListProps {
  vehicleId: string;
}

export function VehicleExpenseList({ vehicleId }: VehicleExpenseListProps) {
  const { data, isLoading } = api.expense.getAll.useQuery({
    page: 1,
    limit: 10,
    vehicleId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const expenses = data?.expenses ?? [];

  if (!expenses.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nessuna spesa collegata"
        description="Aggiungi una spesa e seleziona questo veicolo."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{expense.description}</span>
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
          </div>
          <span className="font-semibold tabular-nums">
            {formatCurrency(toNumber(expense.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}