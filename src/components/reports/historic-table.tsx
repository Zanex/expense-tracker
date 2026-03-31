"use client";

import { api } from "~/trpc/react";
import { formatCurrency, getCurrentMonth, getCurrentYear } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface HistoricTableProps {
  months?: number;
}

// ─── Component ───────────────────────────────────────────

export function HistoricTable({ months = 12 }: HistoricTableProps) {
  const { data, isLoading } = api.report.getHistoricTable.useQuery({
    months,
    fromMonth: getCurrentMonth(),
    fromYear: getCurrentYear(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Storico ultimi {months} mesi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-6 py-4 last:border-0"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data || data.every((r) => r.count === 0) ? (
          <div className="p-6">
            <EmptyState
              icon={BarChart2}
              title="Nessun dato storico"
              description="Inizia ad aggiungere spese per vedere il tuo storico."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mese</TableHead>
                <TableHead className="text-center">Spese</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead>Categoria top</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => {
                const isCurrentMonth =
                  row.month === getCurrentMonth() &&
                  row.year === getCurrentYear();
                const isEmpty = row.count === 0;

                return (
                  <TableRow
                    key={i}
                    className={cn(
                      isEmpty && "opacity-40",
                      isCurrentMonth && "bg-primary/5 font-medium"
                    )}
                  >
                    {/* Mese */}
                    <TableCell className="capitalize">
                      <div className="flex items-center gap-2">
                        {row.label}
                        {isCurrentMonth && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            in corso
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Numero spese */}
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {isEmpty ? "—" : row.count}
                    </TableCell>

                    {/* Totale */}
                    <TableCell className="text-right tabular-nums font-semibold">
                      {isEmpty ? "—" : formatCurrency(row.total)}
                    </TableCell>

                    {/* Categoria top */}
                    <TableCell>
                      {row.topCategory ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                          style={{
                            backgroundColor:
                              row.topCategory.color ?? "#6366f1",
                          }}
                        >
                          {row.topCategory.icon ?? "📁"}
                          {row.topCategory.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
