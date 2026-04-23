"use client";

import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

// ─── Schema ──────────────────────────────────────────────

type FormValues = {
  name: string;
  ticker: string;
  platform: string;
  type: "etf" | "stock" | "crypto" | "fund" | "bond" | "gold" | "cash";
  currency: string;
  manualPrice: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio").max(100),
  ticker: z.string().max(20),
  platform: z.string().min(1, "Piattaforma obbligatoria").max(100),
  type: z.enum(["etf", "stock", "crypto", "fund", "bond", "gold", "cash"]),
  currency: z.string().length(3),
  manualPrice: z
    .string()
    .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
      message: "Deve essere maggiore di zero",
    }),
}) satisfies z.ZodType<FormValues>;

// ─── Config ───────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "etf",    label: "ETF",         emoji: "📊" },
  { value: "stock",  label: "Azione",      emoji: "🏢" },
  { value: "crypto", label: "Crypto",      emoji: "₿"  },
  { value: "fund",   label: "Fondo",       emoji: "🏦" },
  { value: "bond",   label: "Obbligazione",emoji: "📜" },
  { value: "gold",   label: "Oro",         emoji: "🥇" },
  { value: "cash",   label: "Liquidità",   emoji: "💶" },
] as const;

const PLATFORM_SUGGESTIONS = [
  "Scalable Capital",
  "DEGIRO",
  "Gimme5",
  "Banca Intesa",
  "Fineco",
  "Trade Republic",
  "Interactive Brokers",
  "Coinbase",
  "Binance",
];

// ─── Props ────────────────────────────────────────────────

interface InvestmentFormProps {
  investment?: {
    id: string;
    name: string;
    ticker: string | null;
    platform: string;
    type: string;
    currency: string;
    manualPrice: number | null;
    hasTicker: boolean;
  };
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────

export function InvestmentForm({ investment, onSuccess }: InvestmentFormProps) {
  const isEditing = !!investment;
  const utils = api.useUtils();

  const form: UseFormReturn<FormValues> = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: investment?.name ?? "",
      ticker: investment?.ticker ?? "",
      platform: investment?.platform ?? "",
      type: (investment?.type as FormValues["type"]) ?? "etf",
      currency: investment?.currency ?? "EUR",
      manualPrice: investment?.manualPrice != null ? String(investment.manualPrice) : "",
    },
  });

  const ticker = form.watch("ticker");
  const hasTicker = !!ticker?.trim();

  const createMutation = api.investment.create.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      toast.success("Investimento creato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.investment.update.useMutation({
    onSuccess: async () => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      toast.success("Investimento aggiornato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      ticker: values.ticker || undefined,
      platform: values.platform,
      type: values.type,
      currency: values.currency,
      manualPrice: values.manualPrice ? parseFloat(values.manualPrice) : undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: investment.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Tipo asset — visual selector */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all",
                      field.value === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    <span className="text-lg">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nome */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Es. Vanguard FTSE All-World" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Ticker + Piattaforma */}
        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="ticker"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  Ticker{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opz.)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Es. VWCE.DE" {...field} />
                </FormControl>
                <FormDescription className="text-xs">
                  {hasTicker
                    ? "✅ Prezzo automatico da Yahoo Finance"
                    : "⚠️ Senza ticker: prezzo manuale"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Piattaforma</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PLATFORM_SUGGESTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Altra piattaforma...</SelectItem>
                  </SelectContent>
                </Select>
                {field.value === "__custom__" && (
                  <Input
                    className="mt-2"
                    placeholder="Nome piattaforma"
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Prezzo manuale — solo se no ticker */}
        {!hasTicker && (
          <FormField
            control={form.control}
            name="manualPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Prezzo attuale{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opz.)</span>
                </FormLabel>
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
                <FormDescription className="text-xs">
                  Potrai aggiornarlo manualmente in qualsiasi momento.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Creazione..."
            : isEditing ? "Salva modifiche" : "Crea investimento"}
        </Button>
      </form>
    </Form>
  );
}
