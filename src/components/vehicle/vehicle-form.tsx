"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select";

const formSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio").max(100),
  plate: z.string().max(20).optional().or(z.literal("")),
  brand: z.string().max(50).optional().or(z.literal("")),
  model: z.string().max(50).optional().or(z.literal("")),
  year: z.string().refine((v) => !v || (parseInt(v) >= 1900 && parseInt(v) <= 2100), {
    message: "Anno non valido",
  }),
  fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]),
  initialKm: z.string().refine((v) => !v || parseInt(v) >= 0, {
    message: "Km non validi",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Benzina",
  diesel: "Diesel",
  electric: "Elettrico",
  hybrid: "Ibrido",
};

interface VehicleFormProps {
  vehicle?: {
    id: string;
    name: string;
    plate: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    fuelType: string;
    initialKm: number;
  };
  onSuccess: () => void;
}

export function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const isEditing = !!vehicle;
  const utils = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: vehicle?.name ?? "",
      plate: vehicle?.plate ?? "",
      brand: vehicle?.brand ?? "",
      model: vehicle?.model ?? "",
      year: vehicle?.year ? String(vehicle.year) : "",
      fuelType: (vehicle?.fuelType as FormValues["fuelType"]) ?? "gasoline",
      initialKm: vehicle?.initialKm ? String(vehicle.initialKm) : "0",
    },
  });

  const createMutation = api.vehicle.create.useMutation({
    onSuccess: async () => {
      await utils.vehicle.getAll.invalidate();
      toast.success("Veicolo creato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.vehicle.update.useMutation({
    onSuccess: async () => {
      await utils.vehicle.getAll.invalidate();
      toast.success("Veicolo aggiornato");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      plate: values.plate || undefined,
      brand: values.brand || undefined,
      model: values.model || undefined,
      year: values.year ? parseInt(values.year) : undefined,
      fuelType: values.fuelType,
      initialKm: values.initialKm ? parseInt(values.initialKm) : 0,
    };

    if (isEditing) {
      updateMutation.mutate({ id: vehicle.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Nome */}
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nome veicolo</FormLabel>
            <FormControl>
              <Input placeholder="Es. Fiat Panda 2022" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Brand + Model */}
        <div className="flex gap-4">
          <FormField control={form.control} name="brand" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Marca <span className="text-xs font-normal text-muted-foreground">(opz.)</span></FormLabel>
              <FormControl>
                <Input placeholder="Es. Fiat" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="model" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Modello <span className="text-xs font-normal text-muted-foreground">(opz.)</span></FormLabel>
              <FormControl>
                <Input placeholder="Es. Panda" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Targa + Anno */}
        <div className="flex gap-4">
          <FormField control={form.control} name="plate" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Targa <span className="text-xs font-normal text-muted-foreground">(opz.)</span></FormLabel>
              <FormControl>
                <Input placeholder="Es. AB123CD" className="uppercase" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="year" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Anno <span className="text-xs font-normal text-muted-foreground">(opz.)</span></FormLabel>
              <FormControl>
                <Input type="number" placeholder="2022" min={1900} max={2100} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Carburante + Km iniziali */}
        <div className="flex gap-4">
          <FormField control={form.control} name="fuelType" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Carburante</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FUEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="initialKm" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Km iniziali</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" min={0} placeholder="0" {...field} />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending
            ? isEditing ? "Salvataggio..." : "Creazione..."
            : isEditing ? "Salva modifiche" : "Crea veicolo"}
        </Button>
      </form>
    </Form>
  );
}