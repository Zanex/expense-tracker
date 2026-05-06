"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatDate } from "~/lib/utils";
import { Wrench, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

// ─── Props ────────────────────────────────────────────────

interface VehicleServiceAlertProps {
  vehicleId: string;
}

// ─── Component ───────────────────────────────────────────

export function VehicleServiceAlert({ vehicleId }: VehicleServiceAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [kmInput, setKmInput] = useState("");

  const utils = api.useUtils();

  const { data, isLoading } = api.vehicle.getServiceStatus.useQuery(
    { vehicleId },
    { staleTime: 5 * 60 * 1000 }
  );

  const markDoneMutation = api.vehicle.markServiceDone.useMutation({
    onSuccess: async () => {
      await utils.vehicle.getServiceStatus.invalidate({ vehicleId });
      toast.success("Tagliando registrato!");
      setMarkDoneOpen(false);
      setDismissed(false);
      setKmInput("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Non mostrare se non configurato o dati in caricamento
  if (isLoading || !data || !data.configured) return null;

  // Non mostrare se ok e non c'è alert
  if (data.isOk && !dismissed) return null;

  // Non mostrare se dismesso dall'utente (solo warning, non overdue)
  if (dismissed && data.isWarning) return null;

  return (
    <>
      <div
        className={cn(
          "glass relative overflow-hidden flex items-start gap-4 rounded-3xl border px-5 py-4 text-sm transition-all duration-500",
          data.isOverdue
            ? "border-red-500/30 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            : "border-orange-500/30 bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]"
        )}
      >
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        {/* Icona */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform hover:scale-110",
            data.isOverdue
              ? "bg-red-500/20 text-red-500 animate-pulse"
              : "bg-orange-500/20 text-orange-500"
          )}
        >
          {data.isOverdue ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Wrench className="h-5 w-5" />
          )}
        </div>

        {/* Testo */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p
              className={cn(
                "font-semibold",
                data.isOverdue
                  ? "text-red-700 dark:text-red-400"
                  : "text-orange-700 dark:text-orange-400"
              )}
            >
              {data.isOverdue
                ? `Tagliando scaduto da ${Math.abs(data.kmToService).toLocaleString("it-IT")} km!`
                : `Tagliando tra ${data.kmToService.toLocaleString("it-IT")} km`}
            </p>
            <p className="text-xs text-muted-foreground">
              Km attuali:{" "}
              <span className="font-medium">{data.currentKm.toLocaleString("it-IT")}</span>
              {" · "}
              Prossimo tagliando a:{" "}
              <span className="font-medium">{data.nextServiceKm.toLocaleString("it-IT")} km</span>
              {data.lastServiceDate && (
                <>
                  {" · "}
                  Ultimo:{" "}
                  <span className="font-medium">{formatDate(data.lastServiceDate)}</span>
                </>
              )}
            </p>
          </div>

          {/* Barra progresso */}
          <div className="flex flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 p-[1px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--color),0.5)]",
                  data.isOverdue 
                    ? "bg-gradient-to-r from-red-600 to-red-400" 
                    : "bg-gradient-to-r from-orange-500 to-yellow-400"
                )}
                style={{ width: `${data.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{data.lastServiceKm.toLocaleString("it-IT")} km</span>
              <span className={cn(
                "font-medium",
                data.isOverdue ? "text-red-500" : "text-orange-500"
              )}>
                {data.percentage}% dell&apos;intervallo percorso
              </span>
              <span>{data.nextServiceKm.toLocaleString("it-IT")} km</span>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              size="sm"
              variant={data.isOverdue ? "default" : "outline"}
              className={cn(
                "h-7 text-xs",
                data.isOverdue &&
                  "bg-red-500 hover:bg-red-600 text-white border-transparent"
              )}
              onClick={() => {
                setKmInput(String(data.currentKm));
                setMarkDoneOpen(true);
              }}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Tagliando fatto
            </Button>

            {/* Dismiss solo per warning, non overdue */}
            {data.isWarning && (
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Ignora
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dialog conferma tagliando */}
      <Dialog open={markDoneOpen} onOpenChange={setMarkDoneOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registra tagliando</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Inserisci i km attuali al momento del tagliando. Questo aggiornerà
              il contatore per il prossimo intervento.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Km al tagliando</label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={kmInput}
                  onChange={(e) => setKmInput(e.target.value)}
                  placeholder={String(data.currentKm)}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  km
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Km registrati: {data.currentKm.toLocaleString("it-IT")} · 
                Prossimo tagliando a:{" "}
                {kmInput
                  ? (parseInt(kmInput) + data.serviceIntervalKm).toLocaleString("it-IT")
                  : "—"}{" "}
                km
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkDoneOpen(false)}
              disabled={markDoneMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              onClick={() => {
                const km = parseInt(kmInput);
                if (isNaN(km) || km <= 0) {
                  toast.error("Inserisci km validi");
                  return;
                }
                markDoneMutation.mutate({
                  vehicleId,
                  kmAtService: km,
                  date: new Date(),
                });
              }}
              disabled={markDoneMutation.isPending || !kmInput}
            >
              {markDoneMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Conferma tagliando
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}