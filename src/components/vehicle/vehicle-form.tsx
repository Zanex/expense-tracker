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
import { ChevronDown, Wrench } from "lucide-react";
import { useState } from "react";
import { cn, formatDateInput } from "~/lib/utils";

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
  lastServiceKm: z.string().refine(
    (v) => !v || parseInt(v) >= 0,
    { message: "Valore non valido" }
  ),
  serviceIntervalKm: z.string().refine(
    (v) => !v || parseInt(v) >= 1000,
    { message: "Minimo 1000 km" }
  ),
  lastServiceDate: z.string().optional(),
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
    lastServiceKm: number | null;
    serviceIntervalKm: number | null;
    lastServiceDate: Date | null;
  };
  onSuccess: () => void;
}

export function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const isEditing = !!vehicle;
  const utils = api.useUtils();
  const [maintenanceOpen, setMaintenanceOpen] = useState(!!vehicle?.serviceIntervalKm);

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
      lastServiceKm: vehicle?.lastServiceKm ? String(vehicle.lastServiceKm) : "",
      serviceIntervalKm: vehicle?.serviceIntervalKm ? String(vehicle.serviceIntervalKm) : "15000",
      lastServiceDate: vehicle?.lastServiceDate
        ? formatDateInput(vehicle.lastServiceDate)
        : "",
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
      lastServiceKm: values.lastServiceKm ? parseInt(values.lastServiceKm) : undefined,
      serviceIntervalKm: values.serviceIntervalKm ? parseInt(values.serviceIntervalKm) : undefined,
      lastServiceDate: values.lastServiceDate ? new Date(values.lastServiceDate) : undefined,
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
        {/* Sezione manutenzione collassabile */}
        <div className="rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setMaintenanceOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors",
                  maintenanceOpen
                    ? "bg-muted/50 text-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/30"
                )}
              >
                <Wrench className="h-4 w-4" />
                Manutenzione e tagliando
                <ChevronDown
                  className={cn(
                    "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                    maintenanceOpen && "rotate-180"
                  )}
                />
              </button>

              {maintenanceOpen && (
                <div className="border-t bg-muted/10 px-4 py-4 flex flex-col gap-4">
                  {/* Intervallo tagliando */}
                  <FormField
                    control={form.control}
                    name="serviceIntervalKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Intervallo tagliando
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              min={1000}
                              step={1000}
                              placeholder="15000"
                              {...field}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              km
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Km + data ultimo tagliando */}
                  <div className="flex gap-4">
                    <FormField
                      control={form.control}
                      name="lastServiceKm"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>
                            Km ultimo tagliando{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              (opz.)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                placeholder="45000"
                                {...field}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                km
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastServiceDate"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>
                            Data ultimo tagliando{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              (opz.)
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

                  <p className="text-xs text-muted-foreground">
                    Puoi aggiornare questi dati in qualsiasi momento. L&apos;alert
                    apparirà quando mancano meno di 1500 km al prossimo tagliando.
                  </p>
                </div>
              )}
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