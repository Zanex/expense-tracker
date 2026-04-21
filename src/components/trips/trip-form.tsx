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
import { ColorPicker } from "~/components/ui/color-picker";
import { cn } from "~/lib/utils";

// ─── Emoji preset ─────────────────────────────────────────

const TRIP_EMOJIS = [
  "✈️","🏖️","🏔️","🗼","🌍","🏕️","🚢","🎡","🏛️","🌴","🗺️","🚂",
  "🏜️","🌋","🏝️","🌃","🎭","🍷","⛷️","🤿",
];

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(100, "Max 100 caratteri"),
  destination: z.string().max(100, "Max 100 caratteri").optional().or(z.literal("")),
  startDate: z.string().min(1, "La data di inizio è obbligatoria"),
  endDate: z.string().optional().or(z.literal("")),
  budget: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
      message: "Il budget deve essere maggiore di zero",
    }),
  coverColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore non valido")
    .optional(),
  coverEmoji: z.string().max(8).optional(),
  notes: z.string().max(2000, "Max 2000 caratteri").optional().or(z.literal("")),
}).refine(
  (d) => {
    if (!d.endDate || !d.startDate) return true;
    return new Date(d.endDate) >= new Date(d.startDate);
  },
  { message: "La data di fine deve essere dopo la data di inizio", path: ["endDate"] }
);

type FormValues = z.infer<typeof formSchema>;

// ─── Props ────────────────────────────────────────────────

interface TripFormProps {
  trip?: {
    id: string;
    name: string;
    destination: string | null;
    startDate: Date;
    endDate: Date | null;
    budget: { toNumber: () => number } | number | null;
    coverColor: string | null;
    coverEmoji: string | null;
    notes: string | null;
  };
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────

export function TripForm({ trip, onSuccess }: TripFormProps) {
  const isEditing = !!trip;
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: trip?.name ?? "",
      destination: trip?.destination ?? "",
      startDate: trip ? formatDateInput(trip.startDate) : "",
      endDate: trip?.endDate ? formatDateInput(trip.endDate) : "",
      budget: trip?.budget != null ? toNumber(trip.budget).toFixed(2) : "",
      coverColor: trip?.coverColor ?? "#6366f1",
      coverEmoji: trip?.coverEmoji ?? "✈️",
      notes: trip?.notes ?? "",
    },
  });

  const selectedEmoji = form.watch("coverEmoji");
  const selectedColor = form.watch("coverColor") ?? "#6366f1";
  const nameValue = form.watch("name");

  // ─── Mutations ─────────────────────────────────────────

  const createMutation = api.trip.create.useMutation({
    onSuccess: async () => {
      await utils.trip.getAll.invalidate();
      toast.success("Viaggio creato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.trip.update.useMutation({
    onSuccess: async () => {
      await utils.trip.getAll.invalidate();
      await utils.trip.getById.invalidate({ id: trip!.id });
      toast.success("Viaggio aggiornato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Submit ────────────────────────────────────────────

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      destination: values.destination || undefined,
      startDate: new Date(values.startDate),
      endDate: values.endDate ? new Date(values.endDate) : undefined,
      budget: values.budget ? parseFloat(values.budget) : undefined,
      coverColor: values.coverColor ?? "#6366f1",
      coverEmoji: values.coverEmoji ?? "✈️",
      notes: values.notes || undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: trip.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Preview copertina */}
        <div
          className="flex items-center gap-3 rounded-lg p-3"
          style={{ backgroundColor: `${selectedColor}18`, border: `1.5px solid ${selectedColor}40` }}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-sm"
            style={{ backgroundColor: selectedColor }}
          >
            {selectedEmoji}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold leading-tight" style={{ color: selectedColor }}>
              {nameValue || "Nome viaggio"}
            </span>
            <span className="text-xs text-muted-foreground">Anteprima copertina</span>
          </div>
        </div>

        {/* Emoji selector */}
        <FormField
          control={form.control}
          name="coverEmoji"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emoji</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => field.onChange(emoji)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all hover:scale-110",
                        field.value === emoji
                          ? "border-primary bg-primary/10 shadow-sm scale-110"
                          : "border-border bg-background"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Colore */}
        <FormField
          control={form.control}
          name="coverColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colore</FormLabel>
              <FormControl>
                <ColorPicker
                  value={field.value ?? "#6366f1"}
                  onChange={field.onChange}
                />
              </FormControl>
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
              <FormLabel>Nome viaggio</FormLabel>
              <FormControl>
                <Input placeholder="Es. Vacanza Roma, Weekend Parigi..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Destinazione */}
        <FormField
          control={form.control}
          name="destination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Destinazione{" "}
                <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Es. Roma, Italia" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date */}
        <div className="flex gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Data inizio</FormLabel>
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
                <FormLabel>
                  Data fine{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Budget */}
        <FormField
          control={form.control}
          name="budget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Budget totale{" "}
                <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
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

        {/* Note */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Note{" "}
                <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
              </FormLabel>
              <FormControl>
                <textarea
                  placeholder="Informazioni, link utili, promemoria..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50 resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Creazione..."
            : isEditing ? "Salva modifiche" : "Crea viaggio"}
        </Button>
      </form>
    </Form>
  );
}
