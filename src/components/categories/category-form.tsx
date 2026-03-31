"use client";

import { useForm } from "react-hook-form";
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
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { ColorPicker } from "~/components/ui/color-picker";

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(50, "Max 50 caratteri"),
  icon: z.string().emoji("Deve essere un emoji").optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Colore HEX non valido (es. #FF5733)")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Props ────────────────────────────────────────────────

interface CategoryFormProps {
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const isEditing = !!category;
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      icon: category?.icon ?? "",
      color: category?.color ?? "#6366f1",
    },
  });

  // ─── Mutations ─────────────────────────────────────────

  const createMutation = api.category.create.useMutation({
    onSuccess: async () => {
      await utils.category.getAll.invalidate();
      toast.success("Categoria creata");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = api.category.update.useMutation({
    onSuccess: async () => {
      await utils.category.getAll.invalidate();
      toast.success("Categoria aggiornata");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ─── Submit ────────────────────────────────────────────

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      icon: values.icon || undefined,
      color: values.color || undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: category.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Nome */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Es. Alimentari" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Icona */}
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icona (emoji)</FormLabel>
              <FormControl>
                <Input placeholder="🛒" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Color Picker */}
        <FormField
          control={form.control}
          name="color"
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

        {/* Preview categoria */}
        {(form.watch("name") || form.watch("icon")) && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span className="text-lg">{form.watch("icon") || "📁"}</span>
            <span
              className="rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ backgroundColor: form.watch("color") || "#6366f1" }}
            >
              {form.watch("name") || "Anteprima"}
            </span>
          </div>
        )}

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing
              ? "Salvataggio..."
              : "Creazione..."
            : isEditing
              ? "Salva modifiche"
              : "Crea categoria"}
        </Button>
      </form>
    </Form>
  );
}