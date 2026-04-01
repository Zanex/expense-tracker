"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────

interface ExportButtonProps {
  month?: number;
  year?: number;
  label?: string;
}

// ─── Component ───────────────────────────────────────────

export function ExportButton({ month, year, label }: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleExport() {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (month) params.set("month", String(month));
      if (year) params.set("year", String(year));

      const response = await fetch(`/api/export/pdf?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error ?? "Errore durante l'export");
      }

      // Scarica il file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        month && year
          ? `spese-${String(month).padStart(2, "0")}-${year}.pdf`
          : "spese-export.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("PDF scaricato con successo");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Errore durante l'export"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {label ?? "Esporta PDF"}
    </Button>
  );
}
