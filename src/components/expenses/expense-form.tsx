"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatDateInput, toNumber } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select";
import { RefreshCw, ChevronDown, Plane, Car } from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Schema ──────────────────────────────────────────────

const baseSchema = z.object({
  amount: z
    .string()
    .min(1, "L'importo è obbligatorio")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "L'importo deve essere maggiore di zero",
    }),
  description: z
    .string()
    .min(1, "La descrizione è obbligatoria")
    .max(255, "Max 255 caratteri"),
  date: z.string().min(1, "La data è obbligatoria"),
  categoryId: z.string().min(1, "Seleziona una categoria"),
  isRecurring: z.boolean(),
  recurringFrequency: z.enum(["monthly", "weekly", "yearly"]).optional(),
  recurringEndDate: z.string().optional(),
  tripId: z.string().cuid().optional().nullable(),
  vehicleId: z.string().cuid().optional().nullable(),
});

const formSchema = baseSchema.refine(
  (data) => !data.isRecurring || !!data.recurringFrequency,
  {
    message: "Seleziona la frequenza di ripetizione",
    path: ["recurringFrequency"],
  }
);

type FormValues = z.infer<typeof baseSchema>;

// ─── Props ────────────────────────────────────────────────

interface ExpenseFormProps {
  expense?: {
    id: string;
    amount: number | string | { toNumber: () => number };
    description: string;
    date: Date;
    categoryId: string;
    isRecurring?: boolean;
    recurringFrequency?: string | null;
    recurringEndDate?: Date | null;
    tripId?: string | null;
    vehicleId?: string | null;
  };
  defaultTripId?: string | null;
  defaultVehicleId?: string | null;
  onSuccess: () => void;
}

// ─── Sezione collassabile ─────────────────────────────────

interface SectionProps {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  label, icon, isOpen, onToggle, badge, children,
}: SectionProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors",
          isOpen
            ? "bg-muted/50 text-foreground"
            : "bg-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        )}
      >
        {icon}
        {label}
        {badge && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t bg-muted/10 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Frequency options ────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Ogni mese" },
  { value: "weekly",  label: "Ogni settimana" },
  { value: "yearly",  label: "Ogni anno" },
] as const;

// ─── Component ───────────────────────────────────────────

export function ExpenseForm({
  expense,
  defaultTripId,
  defaultVehicleId,
  onSuccess,
}: ExpenseFormProps) {
  const isEditing = !!expense;
  const utils = api.useUtils();

  const { data: categories } = api.category.getAll.useQuery();
  const { data: trips } = api.trip.getAll.useQuery({ status: "all" });
  const { data: vehicles } = api.vehicle.getAll.useQuery();

  // Sezioni aperte di default solo se hanno un valore precompilato
  const [tripOpen, setTripOpen] = useState(
    !!(expense?.tripId ?? defaultTripId)
  );
  const [vehicleOpen, setVehicleOpen] = useState(
    !!(expense?.vehicleId ?? defaultVehicleId)
  );
  const [recurringOpen, setRecurringOpen] = useState(
    !!(expense?.isRecurring)
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: expense ? toNumber(expense.amount).toFixed(2) : "",
      description: expense?.description ?? "",
      date: expense ? formatDateInput(expense.date) : formatDateInput(new Date()),
      categoryId: expense?.categoryId ?? "",
      isRecurring: expense?.isRecurring ?? false,
      recurringFrequency:
        (expense?.recurringFrequency as "monthly" | "weekly" | "yearly" | undefined) ?? undefined,
      recurringEndDate: expense?.recurringEndDate
        ? formatDateInput(expense.recurringEndDate)
        : "",
      tripId: expense?.tripId ?? defaultTripId ?? null,
      vehicleId: expense?.vehicleId ?? defaultVehicleId ?? null,
    },
  });

  const isRecurring = form.watch("isRecurring");

  // ─── Badge sezioni ────────────────────────────────────

  const selectedTrip = trips?.find((t) => t.id === form.watch("tripId"));
  const selectedVehicle = vehicles?.find((v) => v.id === form.watch("vehicleId"));

  // ─── Invalidazione cache ──────────────────────────────

  const invalidateAll = async () => {
    await Promise.all([
      utils.expense.getAll.invalidate(),
      utils.report.getSummary.invalidate(),
      utils.report.getByCategory.invalidate(),
      utils.report.getMonthlyTrend.invalidate(),
    ]);
  };

  // ─── Mutations ────────────────────────────────────────

  const createMutation = api.expense.create.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Spesa aggiunta");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.expense.update.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Spesa aggiornata");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Submit ───────────────────────────────────────────

  function onSubmit(values: FormValues) {
    const payload = {
      amount: parseFloat(values.amount),
      description: values.description,
      date: new Date(values.date),
      categoryId: values.categoryId,
      isRecurring: values.isRecurring,
      recurringFrequency: values.isRecurring ? values.recurringFrequency : undefined,
      recurringEndDate:
        values.isRecurring && values.recurringEndDate
          ? new Date(values.recurringEndDate)
          : undefined,
      tripId: values.tripId ?? undefined,
      vehicleId: values.vehicleId ?? undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: expense.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Render ───────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* ── Campi base — sempre visibili ──────────── */}

        {/* Importo */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Importo (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Descrizione */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Input
                  placeholder="Es. Affitto, abbonamento Netflix..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data + Categoria affiancate */}
        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Data</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon ?? "📁"}</span>
                          <span>{cat.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Sezioni collassabili ──────────────────── */}

        {/* Viaggio */}
        {!!trips?.length && (
          <CollapsibleSection
            label="Collega a viaggio"
            icon={<Plane className="h-4 w-4" />}
            isOpen={tripOpen}
            onToggle={() => {
              setTripOpen((v) => {
                // Chiudendo, resetta il valore
                if (v) form.setValue("tripId", null);
                return !v;
              });
            }}
            badge={selectedTrip ? selectedTrip.name : undefined}
          >
            <FormField
              control={form.control}
              name="tripId"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    value={field.value ?? "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nessun viaggio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nessun viaggio</SelectItem>
                      {trips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id}>
                          <span className="flex items-center gap-2">
                            <span>{trip.coverEmoji ?? "✈️"}</span>
                            <span>{trip.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleSection>
        )}

        {/* Veicolo */}
        {!!vehicles?.length && (
          <CollapsibleSection
            label="Collega a veicolo"
            icon={<Car className="h-4 w-4" />}
            isOpen={vehicleOpen}
            onToggle={() => {
              setVehicleOpen((v) => {
                if (v) form.setValue("vehicleId", null);
                return !v;
              });
            }}
            badge={selectedVehicle ? selectedVehicle.name : undefined}
          >
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    value={field.value ?? "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nessun veicolo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nessun veicolo</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            <span>🚗</span>
                            <span>{v.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleSection>
        )}

        {/* Ricorrenza */}
        <CollapsibleSection
          label="Spesa ricorrente"
          icon={<RefreshCw className="h-4 w-4" />}
          isOpen={recurringOpen}
          onToggle={() => {
            setRecurringOpen((v) => {
              if (v) {
                form.setValue("isRecurring", false);
                form.setValue("recurringFrequency", undefined);
                form.setValue("recurringEndDate", "");
              } else {
                form.setValue("isRecurring", true);
              }
              return !v;
            });
          }}
          badge={
            isRecurring && form.watch("recurringFrequency")
              ? FREQUENCY_OPTIONS.find(
                  (o) => o.value === form.watch("recurringFrequency")
                )?.label
              : undefined
          }
        >
          <div className="flex flex-col gap-4">
            {/* Frequenza */}
            <FormField
              control={form.control}
              name="recurringFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequenza</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                          field.value === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data fine */}
            <FormField
              control={form.control}
              name="recurringEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Data fine{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (opzionale — lascia vuoto per ripetere all&apos;infinito)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CollapsibleSection>

        {/* Submit */}
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Aggiunta..."
            : isEditing ? "Salva modifiche" : "Aggiungi spesa"}
        </Button>
      </form>
    </Form>
  );
}