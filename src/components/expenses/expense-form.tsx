"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatDateInput, toNumber } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RefreshCw } from "lucide-react";
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
  vehicleId?: string | null;
  onSuccess: () => void;
}

// ─── Frequency label map ──────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Ogni mese" },
  { value: "weekly", label: "Ogni settimana" },
  { value: "yearly", label: "Ogni anno" },
] as const;

// ─── Component ───────────────────────────────────────────

export function ExpenseForm({ expense, defaultTripId, vehicleId, onSuccess }: ExpenseFormProps) {
  const isEditing = !!expense;
  const utils = api.useUtils();
  const { data: categories } = api.category.getAll.useQuery();

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
      vehicleId: expense?.vehicleId ?? vehicleId ?? null,
    },
  });

  const isRecurring = form.watch("isRecurring");

  // ─── Mutations ─────────────────────────────────────────

  const invalidateAll = async () => {
    await Promise.all([
      utils.expense.getAll.invalidate(),
      utils.report.getSummary.invalidate(),
      utils.report.getByCategory.invalidate(),
      utils.report.getMonthlyTrend.invalidate(),
    ]);
  };

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

  // ─── Submit ────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Importo */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Importo (€)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
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
                <Input placeholder="Es. Affitto, abbonamento Netflix..." {...field} />
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

        <FormField
          control={form.control}
          name="tripId"
          render={({ field }) => {
            const { data: trips } = api.trip.getAll.useQuery({ status: "all" });
            return (
              <FormItem>
                <FormLabel>
                  Viaggio{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
                </FormLabel>
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
                    {trips?.map((trip) => (
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
            );
          }}
        />

        <FormField
          control={form.control}
          name="vehicleId"
          render={({ field }) => {
            const { data: vehicles } = api.vehicle.getAll.useQuery();
            if (!vehicles?.length) return <></>;
            return (
              <FormItem>
                <FormLabel>
                  Veicolo{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
                </FormLabel>
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
                        🚗 {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* ─── Toggle Ricorrenza ─────────────────────── */}
        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem>
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  field.value
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/50"
                )}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    field.value && "animate-spin-slow text-primary"
                  )}
                />
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-medium", field.value && "text-primary")}>
                    Spesa ricorrente
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Ripeti automaticamente questa spesa
                  </span>
                </div>
                {/* Toggle visivo */}
                <div className="ml-auto">
                  <div
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      field.value ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        field.value ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </div>
                </div>
              </button>
            </FormItem>
          )}
        />

        {/* Opzioni ricorrenza — visibili solo se attivo */}
        {isRecurring && (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            {/* Frequenza */}
            <FormField
              control={form.control}
              name="recurringFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequenza</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Ogni quanto?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        )}

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Aggiunta..."
            : isEditing ? "Salva modifiche" : "Aggiungi spesa"}
        </Button>
      </form>
    </Form>
  );
}