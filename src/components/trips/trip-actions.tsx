"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Download, Copy, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDateInput } from "~/lib/utils";

// ─── PDF Export ───────────────────────────────────────────

interface TripExportButtonProps {
  tripId: string;
  tripName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  showLabel?: boolean;
}

export function TripExportButton({
  tripId,
  tripName,
  variant = "outline",
  size = "sm",
  showLabel = true,
}: TripExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/pdf/trip/${tripId}`);

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Errore durante l'export");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = tripName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.download = `viaggio-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("PDF scaricato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore export");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {showLabel && <span className={loading ? "ml-1.5" : "ml-1.5"}>
        {loading ? "Esportazione..." : "Esporta PDF"}
      </span>}
    </Button>
  );
}

// ─── Duplicate ────────────────────────────────────────────

const duplicateSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(100),
  startDate: z.string().min(1, "La data di inizio è obbligatoria"),
  endDate: z.string().optional().or(z.literal("")),
}).refine(
  (d) => !d.endDate || new Date(d.endDate) >= new Date(d.startDate),
  { message: "La data di fine deve essere dopo quella di inizio", path: ["endDate"] }
);

type DuplicateValues = z.infer<typeof duplicateSchema>;

interface TripDuplicateButtonProps {
  tripId: string;
  tripName: string;
  originalStartDate: Date;
  originalEndDate: Date | null;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  showLabel?: boolean;
}

export function TripDuplicateButton({
  tripId,
  tripName,
  originalStartDate,
  originalEndDate,
  variant = "outline",
  size = "sm",
  showLabel = true,
}: TripDuplicateButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();

  // Calcola date default +1 anno
  const defaultStart = new Date(originalStartDate);
  defaultStart.setFullYear(defaultStart.getFullYear() + 1);
  const defaultEnd = originalEndDate
    ? new Date(new Date(originalEndDate).setFullYear(originalEndDate.getFullYear() + 1))
    : null;

  const form = useForm<DuplicateValues>({
    resolver: zodResolver(duplicateSchema),
    defaultValues: {
      name: `Copia di ${tripName}`,
      startDate: formatDateInput(defaultStart),
      endDate: defaultEnd ? formatDateInput(defaultEnd) : "",
    },
  });

  const duplicateMutation = api.trip.duplicate.useMutation({
    onSuccess: async (newTrip) => {
      await utils.trip.getAll.invalidate();
      toast.success("Viaggio duplicato");
      setOpen(false);
      router.push(`/trips/${newTrip.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: DuplicateValues) {
    duplicateMutation.mutate({
      id: tripId,
      name: values.name,
      startDate: new Date(values.startDate),
      endDate: values.endDate ? new Date(values.endDate) : null,
    });
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Copy className="h-3.5 w-3.5" />
        {showLabel && <span className="ml-1.5">Duplica</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplica viaggio</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Crea una copia di <strong>{tripName}</strong> senza le spese. Puoi cambiare il nome e le date.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Inizio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Fine <span className="text-xs font-normal text-muted-foreground">(opz.)</span></FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="-mx-4 -mb-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={duplicateMutation.isPending}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={duplicateMutation.isPending}>
                  {duplicateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Duplicazione...
                    </>
                  ) : (
                    "Duplica viaggio"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
