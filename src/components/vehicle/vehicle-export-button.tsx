"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VehicleExportButtonProps {
  vehicleId: string;
  vehicleName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}

export function VehicleExportButton({
  vehicleId,
  vehicleName,
  variant = "outline",
  size = "sm",
}: VehicleExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/csv/vehicle/${vehicleId}`);

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Errore durante l'export");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = vehicleName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      a.download = `veicolo-${slug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("CSV scaricato");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Errore durante l'export"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      {loading ? "Esportazione..." : "Esporta CSV"}
    </Button>
  );
}