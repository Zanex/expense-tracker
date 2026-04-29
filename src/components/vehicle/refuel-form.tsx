"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatDateInput } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
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

const formSchema = z.object({
  date: z.string().min(1, "Data obbligatoria"),
  liters: z.string().refine((v) => parseFloat(v) > 0, { message: "Litri obbligatori" }),
  pricePerLiter: z.string().refine((v) => parseFloat(v) > 0, { message: "Prezzo obbligatorio" }),
  totalCost: z.string().refine((v) => parseFloat(v) > 0, { message: "Totale obbligatorio" }),
  kmAtRefuel: z.string().refine((v) => parseInt(v) > 0, { message: "Km obbligatori" }),
  fullTank: z.boolean(),
  notes: z.string().max(255).optional(),
  categoryId: z.string().min(1, "Seleziona categoria carburante"),
});

type FormValues = z.infer<typeof formSchema>;

interface RefuelFormProps {
  vehicleId: string;
  onSuccess: () => void;
}

export function RefuelForm({ vehicleId, onSuccess }: RefuelFormProps) {
  const utils = api.useUtils();
  const { data: categories } = api.category.getAll.useQuery();

  // Suggerisci categoria carburante automaticamente
  const fuelCategory = categories?.find(
    (c) => c.name.toLowerCase().includes("carburan") ||
           c.name.toLowerCase().includes("benzin") ||
           c.name.toLowerCase().includes("diesel")
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: formatDateInput(new Date()),
      liters: "",
      pricePerLiter: "",
      totalCost: "",
      kmAtRefuel: "",
      fullTank: true,
      notes: "",
      categoryId: fuelCategory?.id ?? "",
    },
  });

  function handleAutoCalc() {
    const liters = parseFloat(form.getValues("liters"));
    const price = parseFloat(form.getValues("pricePerLiter"));
    if (!isNaN(liters) && !isNaN(price) && liters > 0 && price > 0) {
      form.setValue("totalCost", (liters * price).toFixed(2));
    }
  }

  const mutation = api.expense.create.useMutation({
    onSuccess: async () => {
      await utils.vehicle.getSummary.invalidate({ vehicleId });
      await utils.vehicle.getMonthlyTrend.invalidate({ vehicleId });
      await utils.expense.getAll.invalidate();
      toast.success("Rifornimento aggiunto");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    const liters = parseFloat(values.liters);
    const totalCost = parseFloat(values.totalCost);

    mutation.mutate({
      amount: totalCost,
      description: `Rifornimento ${liters.toFixed(2)}L`,
      date: new Date(values.date),
      categoryId: values.categoryId,
      vehicleId,
      liters,
      kmAtRefuel: parseInt(values.kmAtRefuel),
      fullTank: values.fullTank,
      isRecurring: false,
      ...(values.notes && { description: `Rifornimento ${liters.toFixed(2)}L — ${values.notes}` }),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Categoria */}
        <FormField control={form.control} name="categoryId" render={({ field }) => (
          <FormItem>
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
        )} />

        {/* Data + Km */}
        <div className="flex gap-4">
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Data</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="kmAtRefuel" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Km al rifornimento</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" min={0} placeholder="50000" {...field} />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Litri + Prezzo/L */}
        <div className="flex gap-4">
          <FormField control={form.control} name="liters" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Litri</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" step="0.001" min="0" placeholder="40.00"
                    {...field}
                    onChange={(e) => { field.onChange(e); handleAutoCalc(); }}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">L</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pricePerLiter" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Prezzo / litro</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  <Input type="number" step="0.001" min="0" placeholder="1.850" className="pl-7"
                    {...field}
                    onChange={(e) => { field.onChange(e); handleAutoCalc(); }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Totale */}
        <FormField control={form.control} name="totalCost" render={({ field }) => (
          <FormItem>
            <FormLabel>Totale pagato</FormLabel>
            <FormControl>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                <Input type="number" step="0.01" min="0" placeholder="74.00" className="pl-7" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Full tank toggle */}
        <FormField control={form.control} name="fullTank" render={({ field }) => (
          <FormItem>
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                field.value
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-lg">⛽</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Pieno completo</span>
                <span className="text-xs text-muted-foreground">
                  Necessario per calcolare il consumo medio
                </span>
              </div>
              <div className="ml-auto">
                <div className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  field.value ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    field.value ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </div>
            </button>
          </FormItem>
        )} />

        <Button type="submit" disabled={mutation.isPending} className="mt-2">
          {mutation.isPending ? "Aggiunta..." : "Aggiungi rifornimento"}
        </Button>
      </form>
    </Form>
  );
}