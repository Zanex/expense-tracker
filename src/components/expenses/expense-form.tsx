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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
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
});

type FormValues = z.infer<typeof formSchema>;

// ─── Props ────────────────────────────────────────────────

interface ExpenseFormProps {
  expense?: {
    id: string;
    amount: number | string | { toNumber: () => number };
    description: string;
    date: Date;
    categoryId: string;
  };
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const isEditing = !!expense;
  const utils = api.useUtils();

  const { data: categories } = api.category.getAll.useQuery();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: expense ? Number(expense.amount).toFixed(2) : "",
      description: expense?.description ?? "",
      date: expense ? formatDateInput(expense.date) : formatDateInput(new Date()),
      categoryId: expense?.categoryId ?? "",
    },
  });

  // ─── Mutations ─────────────────────────────────────────

  const createMutation = api.expense.create.useMutation({
    onSuccess: async () => {
      await utils.expense.getAll.invalidate();
      toast.success("Spesa aggiunta");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.expense.update.useMutation({
    onSuccess: async () => {
      await utils.expense.getAll.invalidate();
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
                <Input placeholder="Es. Spesa al supermercato" {...field} />
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

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Aggiunta..."
            : isEditing ? "Salva modifiche" : "Aggiungi spesa"}
        </Button>
      </form>
    </Form>
  );
}