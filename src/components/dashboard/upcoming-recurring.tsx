"use client";

import { api } from "~/trpc/react";
import { formatCurrency, formatDate } from "~/lib/utils";
import { RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

// ─── Frequency label ──────────────────────────────────────

const FREQ_LABEL: Record<string, string> = {
  monthly: "mensile",
  weekly: "settimanale",
  yearly: "annuale",
};

// ─── Types ────────────────────────────────────────────────

interface UpcomingRecurringProps {
  month: number;
  year: number;
}

// ─── Component ───────────────────────────────────────────

export function UpcomingRecurring({ month, year }: UpcomingRecurringProps) {
  const { data, isLoading } = api.expense.getUpcomingRecurring.useQuery(
    { month, year },
    { staleTime: 60_000 }
  );

  // Non mostrare il widget se non c'è nulla in arrivo
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          In arrivo questo mese
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {data!.map((item) => (
              <div
                key={item.templateId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  item.alreadyCreated && "opacity-50"
                )}
              >
                {/* Icona categoria */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{
                    backgroundColor: `${item.category.color ?? "#6366f1"}20`,
                  }}
                >
                  {item.category.icon ?? "📁"}
                </div>

                {/* Info */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.description}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {item.alreadyCreated ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">
                          Già registrata
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        {formatDate(item.expectedDate)} ·{" "}
                        {FREQ_LABEL[item.frequency] ?? item.frequency}
                      </>
                    )}
                  </span>
                </div>

                {/* Importo */}
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    item.alreadyCreated
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Totale atteso */}
        {data && data.length > 0 && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">
              Totale atteso
            </span>
            <span className="text-sm font-bold tabular-nums">
              {formatCurrency(
                data
                  .filter((d) => !d.alreadyCreated)
                  .reduce((sum, d) => sum + d.amount, 0)
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}