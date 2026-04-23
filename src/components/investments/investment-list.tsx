"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { InvestmentCard } from "./investment-card";
import { InvestmentForm } from "./investment-form";
import { InvestmentSummaryBanner } from "./investment-summary-banner";

// ─── Types ────────────────────────────────────────────────

interface InvestmentListProps {
  externalCreateOpen?: boolean;
  onExternalCreateClose?: () => void;
}

// ─── Component ───────────────────────────────────────────

export function InvestmentList({
  externalCreateOpen = false,
  onExternalCreateClose,
}: InvestmentListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (externalCreateOpen) setDialogOpen(true);
  }, [externalCreateOpen]);

  const { data: investments, isLoading } = api.investment.getAll.useQuery();

  function handleDialogClose() {
    setDialogOpen(false);
    onExternalCreateClose?.();
  }

  // ─── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {["Scalable Capital", "GimmeS"].map((platform) => (
            <div key={platform} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────

  if (!investments || investments.length === 0) {
    return (
      <>
        <EmptyState
          icon={TrendingUp}
          title="Nessun investimento"
          description="Aggiungi la tua prima posizione per iniziare a tracciare il portafoglio."
          action={{
            label: "Nuovo investimento",
            onClick: () => setDialogOpen(true),
          }}
        />
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuovo investimento</DialogTitle>
            </DialogHeader>
            <InvestmentForm onSuccess={handleDialogClose} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ─── Raggruppa per piattaforma ─────────────────────────

  const byPlatform = investments.reduce(
    (acc, inv) => {
      if (!acc[inv.platform]) acc[inv.platform] = [];
      acc[inv.platform]!.push(inv);
      return acc;
    },
    {} as Record<string, typeof investments>
  );

  // Ordina piattaforme per valore totale decrescente
  const sortedPlatforms = Object.entries(byPlatform).sort(([, a], [, b]) => {
    const totalA = a.reduce((sum, i) => sum + (i.currentValue ?? 0), 0);
    const totalB = b.reduce((sum, i) => sum + (i.currentValue ?? 0), 0);
    return totalB - totalA;
  });

  // ─── Render ────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Banner KPI portfolio */}
        <InvestmentSummaryBanner />

        {/* Lista per piattaforma */}
        {sortedPlatforms.map(([platform, invs]) => {
          const platformTotal = invs.reduce((sum, i) => sum + (i.currentValue ?? 0), 0);
          const platformCost = invs.reduce((sum, i) => sum + i.costBasis, 0);
          const platformPnL = platformTotal - platformCost;

          return (
            <div key={platform} className="flex flex-col gap-3">
              {/* Header piattaforma */}
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{platform}</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(platformTotal)}
                  </span>
                  {platformCost > 0 && (
                    <span
                      className={
                        platformPnL >= 0
                          ? "font-medium text-green-600 dark:text-green-400"
                          : "font-medium text-red-500 dark:text-red-400"
                      }
                    >
                      {platformPnL >= 0 ? "+" : ""}
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(platformPnL)}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid card */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {invs.map((inv) => (
                  <InvestmentCard key={inv.id} investment={inv} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog crea */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo investimento</DialogTitle>
          </DialogHeader>
          <InvestmentForm onSuccess={handleDialogClose} />
        </DialogContent>
      </Dialog>
    </>
  );
}
