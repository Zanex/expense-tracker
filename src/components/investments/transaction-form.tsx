"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatDateInput } from "~/lib/utils";
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
import { cn } from "~/lib/utils";

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  type: z.enum(["buy", "sell", "dividend", "fee"]),
  quantity: z
    .string()
    .min(1, "Quantità obbligatoria")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Deve essere maggiore di zero",
    }),
  pricePerUnit: z
    .string()
    .min(1, "Prezzo obbligatorio")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: "Deve essere maggiore di zero",
    }),
  fees: z.string().refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), {
    message: "Deve essere ≥ 0",
  }),
  date: z.string().min(1, "Data obbligatoria"),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Config ───────────────────────────────────────────────

const TX_CONFIG = {
  buy:      { label: "Acquisto",   color: "text-green-600",  qtyLabel: "Quantità / quote",  priceLabel: "Prezzo per unità (€)" },
  sell:     { label: "Vendita",    color: "text-red-500",    qtyLabel: "Quantità / quote",  priceLabel: "Prezzo per unità (€)" },
  dividend: { label: "Dividendo",  color: "text-blue-500",   qtyLabel: "Quote possedute",   priceLabel: "Dividendo per quota (€)" },
  fee:      { label: "Commissione",color: "text-orange-500", qtyLabel: "Quantità (es. 1)",  priceLabel: "Importo commissione (€)" },
} as const;

// ─── Props ────────────────────────────────────────────────

interface TransactionFormProps {
  investmentId: string;
  investmentName: string;
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────

export function TransactionForm({ investmentId, investmentName, onSuccess }: TransactionFormProps) {
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "buy",
      quantity: "",
      pricePerUnit: "",
      fees: "",
      date: formatDateInput(new Date()),
      notes: "",
    },
  });

  const txType = form.watch("type");
  const config = TX_CONFIG[txType];

  const mutation = api.investment.addTransaction.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getById.invalidate({ id: investmentId });
      await utils.investment.getSummary.invalidate();
      toast.success("Transazione aggiunta");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    mutation.mutate({
      investmentId,
      type: values.type,
      quantity: parseFloat(values.quantity),
      pricePerUnit: parseFloat(values.pricePerUnit),
      fees: values.fees ? parseFloat(values.fees) : 0,
      date: new Date(values.date),
      notes: values.notes || undefined,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Stai aggiungendo una transazione su <strong>{investmentName}</strong>.
        </p>

        {/* Tipo transazione */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                {(["buy", "sell", "dividend", "fee"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => field.onChange(t)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      field.value === t
                        ? `border-transparent bg-primary text-primary-foreground`
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {TX_CONFIG[t].label}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantità + Prezzo */}
        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{config.qtyLabel}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pricePerUnit"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{config.priceLabel}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      €
                    </span>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Totale calcolato live */}
        {form.watch("quantity") && form.watch("pricePerUnit") && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {txType === "fee" ? "Commissione totale" : "Controvalore"}
            </span>
            <span className={cn("font-bold tabular-nums", config.color)}>
              {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                parseFloat(form.watch("quantity") || "0") *
                parseFloat(form.watch("pricePerUnit") || "0")
              )}
            </span>
          </div>
        )}

        {/* Data + Commissioni */}
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
          {txType !== "fee" && (
            <FormField
              control={form.control}
              name="fees"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    Commissioni{" "}
                    <span className="text-xs font-normal text-muted-foreground">(opz.)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        €
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Note */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Note{" "}
                <span className="text-xs font-normal text-muted-foreground">(opz.)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Es. Piano accumulo mensile" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending} className="mt-2">
          {mutation.isPending ? "Salvataggio..." : "Aggiungi transazione"}
        </Button>
      </form>
    </Form>
  );
}
