"use client";

import { useState, useRef } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn, formatCurrency, formatDate } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
}

interface PreviewRow {
  date: Date | null;
  description: string;
  amount: number | null;
  categoryId: string;
  valid: boolean;
  error?: string;
}

// ─── Step indicator ───────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Carica file", "Mappa colonne", "Conferma"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/20 text-primary font-bold",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? "✓" : step}
            </div>
            <span
              className={cn(
                "text-sm",
                active ? "font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="h-px w-6 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
    amount: "",
  });
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = api.category.getAll.useQuery();
  const utils = api.useUtils();

  const importMutation = api.expense.importBatch.useMutation({
    onSuccess: async (result) => {
      await utils.expense.getAll.invalidate();
      toast.success(`${result.imported} spese importate con successo`);
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── File parsing ──────────────────────────────────────

  function parseFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setHeaders(result.meta.fields ?? []);
          setRows(result.data);
          setStep(2);
        },
        error: () => toast.error("Errore durante il parsing del file CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!sheet) return toast.error("Foglio vuoto");
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
        if (json.length === 0) return toast.error("Nessun dato trovato");
        setHeaders(Object.keys(json[0]!));
        setRows(json);
        setStep(2);
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Formato non supportato. Usa CSV o XLSX.");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  // ─── Preview generation ────────────────────────────────

  function buildPreview() {
    if (!mapping.date || !mapping.description || !mapping.amount || !defaultCategoryId) {
      toast.error("Completa il mapping di tutte le colonne");
      return;
    }

    const parsed: PreviewRow[] = rows.slice(0, 100).map((row) => {
      const rawDate = row[mapping.date] ?? "";
      const rawAmount = row[mapping.amount] ?? "";
      const description = row[mapping.description]?.trim() ?? "";

      // Parse data
      const dateObj = new Date(rawDate);
      const validDate = !isNaN(dateObj.getTime());

      // Parse importo — gestisce virgola come separatore decimale
      const normalizedAmount = rawAmount.replace(",", ".");
      const amount = parseFloat(normalizedAmount);
      const validAmount = !isNaN(amount) && amount > 0;

      const valid = validDate && validAmount && description.length > 0;
      const error = !valid
        ? [
            !validDate && "data non valida",
            !validAmount && "importo non valido",
            !description && "descrizione vuota",
          ]
            .filter(Boolean)
            .join(", ")
        : undefined;

      return {
        date: validDate ? dateObj : null,
        description,
        amount: validAmount ? amount : null,
        categoryId: defaultCategoryId,
        valid,
        error,
      };
    });

    setPreview(parsed);
    setStep(3);
  }

  // ─── Import ────────────────────────────────────────────

  function handleImport() {
    const valid = preview.filter((r) => r.valid);
    if (valid.length === 0) {
      toast.error("Nessuna riga valida da importare");
      return;
    }

    importMutation.mutate({
      expenses: valid.map((r) => ({
        amount: r.amount!,
        description: r.description,
        date: r.date!,
        categoryId: r.categoryId,
      })),
    });
  }

  // ─── Reset ────────────────────────────────────────────

  function handleClose() {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({ date: "", description: "", amount: "" });
    setDefaultCategoryId("");
    setPreview([]);
    onClose();
  }

  const validRows = preview.filter((r) => r.valid).length;
  const invalidRows = preview.filter((r) => !r.valid).length;

  // ─── Render ────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa spese</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-10 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Trascina il file qui</p>
              <p className="text-sm text-muted-foreground">
                Supporta CSV e XLSX (Excel) — max 500 righe
              </p>
            </div>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <FileText className="mr-2 h-4 w-4" />
              Scegli file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* Step 2 — Mapping colonne */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {rows.length} righe trovate — mappa le colonne del file alle
              informazioni della spesa.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Data */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Data</label>
                <Select value={mapping.date} onValueChange={(v) => setMapping({ ...mapping, date: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli colonna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrizione */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Descrizione</label>
                <Select value={mapping.description} onValueChange={(v) => setMapping({ ...mapping, description: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli colonna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Importo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Importo</label>
                <Select value={mapping.amount} onValueChange={(v) => setMapping({ ...mapping, amount: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli colonna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Categoria</label>
                <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assegna categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon ?? "📁"} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Anteprima prime 3 righe */}
            {mapping.date && mapping.description && mapping.amount && (
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Anteprima prime 3 righe
                </div>
                <div className="divide-y">
                  {rows.slice(0, 3).map((row, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-2 text-sm">
                      <span className="w-24 text-muted-foreground">{row[mapping.date]}</span>
                      <span className="flex-1 truncate">{row[mapping.description]}</span>
                      <span className="tabular-nums font-medium">{row[mapping.amount]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button onClick={buildPreview}>
                Avanti
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Conferma */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            {/* Riepilogo */}
            <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{validRows} righe valide</span>
              </div>
              {invalidRows > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{invalidRows} righe con errori (saltate)</span>
                </div>
              )}
            </div>

            {/* Tabella preview */}
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <div className="divide-y">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm",
                      !row.valid && "opacity-50 bg-red-50"
                    )}
                  >
                    {row.valid ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {row.date ? formatDate(row.date) : "—"}
                    </span>
                    <span className="flex-1 truncate">{row.description || "—"}</span>
                    <span className="tabular-nums font-medium">
                      {row.amount !== null ? formatCurrency(row.amount) : "—"}
                    </span>
                    {row.error && (
                      <span className="text-xs text-red-500">{row.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Indietro
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows === 0 || importMutation.isPending}
              >
                {importMutation.isPending
                  ? "Importazione..."
                  : `Importa ${validRows} spese`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
