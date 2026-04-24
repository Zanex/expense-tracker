"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import {
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
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
import { TransactionForm } from "./transaction-form";
import { toast } from "sonner";
import { Skeleton } from "~/components/ui/skeleton";

// ─── Config ───────────────────────────────────────────────

const TX_CONFIG = {
  buy: { label: "Acquisto", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", icon: TrendingUp },
  sell: { label: "Vendita", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20", icon: TrendingDown },
  dividend: { label: "Dividendo", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", icon: TrendingUp },
  fee: { label: "Commissione", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20", icon: Minus },
} as const;

// ─── Props ────────────────────────────────────────────────

interface TransactionListProps {
  investmentId: string;
  investmentName: string;
}

// ─── Component ───────────────────────────────────────────

export function TransactionList({
  investmentId,
  investmentName,
}: TransactionListProps) {
  const [editingTx, setEditingTx] = useState<{
    id: string;
    type: "buy" | "sell" | "dividend" | "fee";
    quantity: number;
    pricePerUnit: number;
    fees: number;
    date: Date;
    notes: string | null;
  } | null>(null);
  const utils = api.useUtils();

  const { data: investment, isLoading } = api.investment.getById.useQuery({
    id: investmentId,
  });

  const deleteMutation = api.investment.deleteTransaction.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getById.invalidate({ id: investmentId });
      await utils.investment.getSummary.invalidate();
      toast.success("Transazione eliminata");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const transactions = investment?.transactions ?? [];

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Info className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          Nessuna transazione registrata.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Form di Modifica (nello stesso contenitore, niente popup su popup) */}
      {editingTx ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-semibold">Modifica transazione</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setEditingTx(null)}
              className="h-8 px-2 text-xs"
            >
              ← Torna alla lista
            </Button>
          </div>
          <TransactionForm
            investmentId={investmentId}
            investmentName={investmentName}
            transaction={editingTx}
            onSuccess={() => setEditingTx(null)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 py-2">
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {transactions
                .slice()
                .reverse()
                .map((tx) => {
                  const config = TX_CONFIG[tx.type as keyof typeof TX_CONFIG];
                  const Icon = config.icon;

                  return (
                    <div
                      key={tx.id}
                      className="group flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {config.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {formatDate(tx.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {toNumber(tx.quantity)} quote
                            </span>
                            <span>@</span>
                            <span className="tabular-nums">
                              {formatCurrency(toNumber(tx.pricePerUnit))}
                            </span>
                            {toNumber(tx.fees) > 0 && (
                              <span className="text-orange-600/80 dark:text-orange-400/80">
                                (+{formatCurrency(toNumber(tx.fees))} comm.)
                              </span>
                            )}
                          </div>
                          {tx.notes && (
                            <p className="mt-0.5 text-[11px] italic text-muted-foreground/70 line-clamp-1">
                              {tx.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-bold tabular-nums ${config.color}`}>
                            {tx.type === "sell" || tx.type === "fee" ? "-" : "+"}
                            {formatCurrency(toNumber(tx.quantity) * toNumber(tx.pricePerUnit))}
                          </span>
                        </div>

                        {/* Azioni */}
                        <div className="flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingTx({
                              ...tx,
                              type: tx.type as "buy" | "sell" | "dividend" | "fee",
                              quantity: toNumber(tx.quantity),
                              pricePerUnit: toNumber(tx.pricePerUnit),
                              fees: toNumber(tx.fees),
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare transazione?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Questa azione ricalcolerà immediatamente il costo medio e il P&L dell{`'`}investimento.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate({ id: tx.id })}
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
