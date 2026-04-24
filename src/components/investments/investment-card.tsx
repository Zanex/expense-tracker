"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatCurrency } from "~/lib/utils";
import {
  TrendingUp, TrendingDown, Minus,
  Pencil, Trash2, Plus, Clock, AlertCircle,
  History,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { InvestmentForm } from "./investment-form";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface InvestmentCardProps {
  investment: {
    id: string;
    name: string;
    ticker: string | null;
    platform: string;
    type: string;
    currency: string;
    currentPrice: number | null;
    currentPriceUpdatedAt: Date | null;
    manualPrice: number | null;
    isPriceStale: boolean;
    hasTicker: boolean;
    transactionCount: number;
    currentQty: number;
    costBasis: number;
    currentValue: number | null;
    unrealizedPnL: number | null;
    unrealizedPct: number | null;
    realizedPnL: number;
    totalDividends: number;
    totalReturn: number;
    totalReturnPct: number | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  etf: "📊", stock: "🏢", crypto: "₿", fund: "🏦",
  bond: "📜", gold: "🥇", cash: "💶",
};

function PnLBadge({ value, pct }: { value: number | null; pct: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">Prezzo mancante</span>;
  }

  const pos = value >= 0;
  const Icon = value === 0 ? Minus : pos ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm font-semibold tabular-nums",
        pos ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {pos ? "+" : ""}{formatCurrency(value)}
      {pct !== null && (
        <span className="text-xs font-medium opacity-80">
          ({pos ? "+" : ""}{pct}%)
        </span>
      )}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────

export function InvestmentCard({ investment: inv }: InvestmentCardProps) {
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.investment.delete.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      toast.success("Investimento eliminato");
    },
    onError: (err) => toast.error(err.message),
  });

  const setManualPriceMutation = api.investment.setManualPrice.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      toast.success("Prezzo aggiornato");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleManualPricePrompt() {
    const raw = prompt(
      `Inserisci il prezzo attuale per "${inv.name}" (€):`,
      inv.manualPrice != null ? String(inv.manualPrice) : ""
    );
    if (!raw) return;
    const price = parseFloat(raw.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      toast.error("Prezzo non valido");
      return;
    }
    setManualPriceMutation.mutate({ id: inv.id, price });
  }

  const emoji = TYPE_EMOJI[inv.type] ?? "📈";
  const hasBuys = inv.currentQty > 0;

  return (
    <>
      <div className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">

        {/* Header: emoji + nome + badge tipo + azioni */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
              {emoji}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold leading-tight">{inv.name}</span>
                {inv.ticker && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-medium text-primary">
                    {inv.ticker}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">{inv.type}</span>
            </div>
          </div>

          {/* Azioni — visibili su hover */}
          <div className="flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setTxDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setHistoryDialogOpen(true)}
              title="Cronologia transazioni">
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare {inv.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Verranno eliminate anche tutte le {inv.transactionCount} transazioni collegate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate({ id: inv.id })}
                  >
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Prezzo + warning stale */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {inv.currentPrice !== null ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatCurrency(inv.currentPrice)}/quota
              </span>
            ) : (
              <button
                onClick={handleManualPricePrompt}
                className="flex items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
              >
                <AlertCircle className="h-3 w-3" />
                Inserisci prezzo
              </button>
            )}
            {inv.isPriceStale && inv.currentPrice !== null && !inv.hasTicker && (
              <button
                onClick={handleManualPricePrompt}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Prezzo non aggiornato — clicca per aggiornare"
              >
                <Clock className="h-3 w-3" />
                Aggiorna
              </button>
            )}
          </div>

          {/* Qty */}
          {hasBuys && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {inv.currentQty % 1 === 0
                ? inv.currentQty.toFixed(0)
                : inv.currentQty.toFixed(4)} quote
            </span>
          )}
        </div>

        {/* Valori principali */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Valore attuale</span>
            <span className="text-lg font-bold tabular-nums">
              {inv.currentValue !== null ? formatCurrency(inv.currentValue) : "—"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-muted-foreground">P&L non realizzato</span>
            <PnLBadge value={inv.unrealizedPnL} pct={inv.unrealizedPct} />
          </div>
        </div>

        {/* Footer: costo medio + transazioni */}
        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>
            Investito {formatCurrency(inv.costBasis)}
          </span>
          <button 
            onClick={() => setHistoryDialogOpen(true)}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <History className="h-3 w-3" />
            {inv.transactionCount} {inv.transactionCount === 1 ? "transazione" : "transazioni"}
          </button>
        </div>
      </div>

      {/* Dialog nuova transazione */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova transazione</DialogTitle>
          </DialogHeader>
          <TransactionForm
            investmentId={inv.id}
            investmentName={inv.name}
            onSuccess={() => setTxDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog modifica investimento */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica investimento</DialogTitle>
          </DialogHeader>
          <InvestmentForm
            investment={inv}
            onSuccess={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog cronologia transazioni */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cronologia: {inv.name}</DialogTitle>
          </DialogHeader>
          <TransactionList investmentId={inv.id} investmentName={inv.name} />
        </DialogContent>
      </Dialog>
    </>
  );
}
