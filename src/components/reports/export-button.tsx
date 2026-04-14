"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Download, Loader2, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────

interface ExportButtonProps {
  month?: number;
  year?: number;
  label?: string;
}

type ExportFormat = "pdf" | "csv";

// ─── Helpers ─────────────────────────────────────────────

async function downloadExport(
  format: ExportFormat,
  month?: number,
  year?: number
): Promise<void> {
  const params = new URLSearchParams();
  if (month) params.set("month", String(month));
  if (year) params.set("year", String(year));

  const response = await fetch(`/api/export/${format}?${params.toString()}`);

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error ?? "Errore durante l'export");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const periodLabel =
    month && year
      ? `${String(month).padStart(2, "0")}-${year}`
      : "export";
  a.download = `spese-${periodLabel}.${format}`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────

export function ExportButton({ month, year, label }: ExportButtonProps) {
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    setLoadingFormat(format);
    try {
      await downloadExport(format, month, year);
      toast.success(`File ${format.toUpperCase()} scaricato`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore durante l'export");
    } finally {
      setLoadingFormat(null);
    }
  }

  const isLoading = loadingFormat !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {label ?? "Esporta"}
            <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("pdf")}
          disabled={isLoading}
        >
          <FileText className="mr-2 h-4 w-4 text-red-500" />
          Esporta PDF
          {loadingFormat === "pdf" && (
            <Loader2 className="ml-auto h-3 w-3 animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("csv")}
          disabled={isLoading}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          Esporta CSV / Excel
          {loadingFormat === "csv" && (
            <Loader2 className="ml-auto h-3 w-3 animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}