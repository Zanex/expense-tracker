"use client";

import { useState, useRef } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronRight } from "lucide-react";
import { cn, formatCurrency, formatDate } from "~/lib/utils";
import {
  detectCSVFormat,
  parseScalableCapitalCSV,
  parseGenericCSV,
  type ParsedTransaction,
  type ColumnMapping,
  type InvestmentType,
  type TransactionType,
} from "~/lib/investment-parsers";

// ─── Step indicator ───────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-1.5">
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              done && "bg-primary text-primary-foreground",
              active && "bg-primary/20 text-primary font-bold",
              !done && !active && "bg-muted text-muted-foreground"
            )}>
              {done ? "✓" : step}
            </div>
            <span className={cn("hidden text-xs sm:inline", active ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────

interface InvestmentImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

const INVESTMENT_TYPES: { value: InvestmentType; label: string; emoji: string }[] = [
  { value: "etf",    label: "ETF",          emoji: "📊" },
  { value: "stock",  label: "Azione",        emoji: "🏢" },
  { value: "crypto", label: "Crypto",        emoji: "₿"  },
  { value: "fund",   label: "Fondo",         emoji: "🏦" },
  { value: "bond",   label: "Obbligazione",  emoji: "📜" },
  { value: "gold",   label: "Oro",           emoji: "🥇" },
  { value: "cash",   label: "Liquidità",     emoji: "💶" },
];

const TX_TYPES: { value: TransactionType; label: string }[] = [
  { value: "buy",      label: "Acquisto" },
  { value: "sell",     label: "Vendita" },
  { value: "dividend", label: "Dividendo" },
  { value: "fee",      label: "Commissione" },
];

const TX_TYPE_COLORS: Record<TransactionType, string> = {
  buy:      "text-green-600",
  sell:     "text-red-500",
  dividend: "text-blue-500",
  fee:      "text-orange-500",
};

// ─── Component ───────────────────────────────────────────

export function InvestmentImportDialog({ open, onClose }: InvestmentImportDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<"scalable" | "generic">("generic");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generic CSV mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    txType: "",
    name: "",
    ticker: "",
    quantity: "",
    pricePerUnit: "",
    fees: "",
    notes: "",
  });
  const [defaultPlatform, setDefaultPlatform] = useState("");
  const [defaultTxType, setDefaultTxType] = useState<TransactionType>("buy");
  const [defaultInvType, setDefaultInvType] = useState<InvestmentType>("etf");

  const utils = api.useUtils();

  const importMutation = api.investment.importBatch.useMutation({
    onSuccess: async (result) => {
      await utils.investment.getAll.invalidate();
      await utils.investment.getSummary.invalidate();
      toast.success(
        `${result.imported} transazioni importate` +
        (result.createdPositions > 0 ? ` · ${result.createdPositions} posizioni create` : "")
      );
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── File parsing ──────────────────────────────────────

  function parseFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        const data = result.data;
        const format = detectCSVFormat(fields);

        setHeaders(fields);
        setRawRows(data);
        setDetectedFormat(format);

        if (format === "scalable") {
          // Auto-parse Scalable Capital
          const parsed = parseScalableCapitalCSV(data);
          setTransactions(parsed);
          setStep(3); // Salta mapping — vai diretto a conferma
        } else {
          setStep(2); // Chiedi mapping colonne
        }
      },
      error: () => toast.error("Errore durante il parsing del CSV"),
    });
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

  // ─── Build generic preview ─────────────────────────────

  function buildGenericPreview() {
    if (!mapping.date || !mapping.name || !mapping.quantity || !mapping.pricePerUnit) {
      toast.error("Mappa almeno: data, nome, quantità, prezzo");
      return;
    }
    if (!defaultPlatform.trim()) {
      toast.error("Inserisci la piattaforma");
      return;
    }

    const parsed = parseGenericCSV(rawRows, mapping, defaultPlatform, defaultTxType, defaultInvType);
    setTransactions(parsed);
    setStep(3);
  }

  // ─── Import ────────────────────────────────────────────

  function handleImport() {
    const valid = transactions.filter((t) => t.valid);
    if (valid.length === 0) {
      toast.error("Nessuna transazione valida da importare");
      return;
    }

    importMutation.mutate({
      transactions: valid.map((t) => ({
        name: t.name,
        ticker: t.ticker,
        isin: t.isin,
        platform: t.platform,
        investmentType: t.type,
        txType: t.txType,
        quantity: t.quantity,
        pricePerUnit: t.pricePerUnit,
        fees: t.fees,
        date: t.date,
        notes: t.notes,
      })),
    });
  }

  // ─── Reset ────────────────────────────────────────────

  function handleClose() {
    setStep(1);
    setHeaders([]);
    setRawRows([]);
    setTransactions([]);
    setMapping({ date: "", txType: "", name: "", ticker: "", quantity: "", pricePerUnit: "", fees: "", notes: "" });
    setDefaultPlatform("");
    setDefaultTxType("buy");
    setDefaultInvType("etf");
    onClose();
  }

  const validTxs = transactions.filter((t) => t.valid);
  const invalidTxs = transactions.filter((t) => !t.valid);

  const steps = detectedFormat === "scalable"
    ? ["Carica file", "Conferma"]
    : ["Carica file", "Mappa colonne", "Conferma"];

  // ─── Render ────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa investimenti</DialogTitle>
        </DialogHeader>

        <StepIndicator
          current={detectedFormat === "scalable" && step === 3 ? 2 : step}
          steps={steps}
        />

        {/* ── Step 1: Upload ───────────────────────────── */}
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
              <p className="font-medium">Trascina il CSV qui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scalable Capital riconosciuto automaticamente.
                Qualsiasi altro CSV mappabile manualmente.
              </p>
            </div>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <FileText className="mr-2 h-4 w-4" />
              Scegli file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />

            {/* Hint formato Scalable */}
            <div className="w-full rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">💡 Come esportare da Scalable Capital:</p>
              <p>App → Portafoglio → Storico transazioni → Esporta CSV</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Mapping colonne (solo CSV generico) ─ */}
        {step === 2 && detectedFormat === "generic" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {rawRows.length} righe trovate. Mappa le colonne del CSV.
            </p>

            {/* Piattaforma + tipo default */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Piattaforma</label>
                <Input
                  placeholder="Es. DEGIRO"
                  value={defaultPlatform}
                  onChange={(e) => setDefaultPlatform(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipo asset default</label>
                <Select value={defaultInvType} onValueChange={(v) => setDefaultInvType(v as InvestmentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipo tx default</label>
                <Select value={defaultTxType} onValueChange={(v) => setDefaultTxType(v as TransactionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TX_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mappatura colonne — griglia 2×4 */}
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: "date",         label: "Data *",          required: true  },
                  { key: "name",         label: "Nome strumento *", required: true  },
                  { key: "quantity",     label: "Quantità *",       required: true  },
                  { key: "pricePerUnit", label: "Prezzo per unità *", required: true },
                  { key: "txType",       label: "Tipo transazione", required: false },
                  { key: "ticker",       label: "Ticker",           required: false },
                  { key: "fees",         label: "Commissioni",      required: false },
                  { key: "notes",        label: "Note",             required: false },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{label}</label>
                  <Select
                    value={mapping[key] ?? ""}
                    onValueChange={(v) => setMapping((prev) => ({ ...prev, [key]: v ?? "" }))}
                  >
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
              ))}
            </div>

            {/* Anteprima prime 3 righe */}
            {mapping.name && mapping.date && (
              <div className="overflow-hidden rounded-lg border">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Anteprima prime 3 righe
                </div>
                <div className="divide-y">
                  {rawRows.slice(0, 3).map((row, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-2 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">{row[mapping.date]}</span>
                      <span className="flex-1 truncate font-medium">{row[mapping.name]}</span>
                      <span className="tabular-nums">{row[mapping.quantity]}</span>
                      <span className="tabular-nums text-muted-foreground">@ {row[mapping.pricePerUnit]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Indietro</Button>
              <Button onClick={buildGenericPreview}>Avanti</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Conferma ─────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            {/* Badge formato rilevato */}
            {detectedFormat === "scalable" && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Formato Scalable Capital rilevato automaticamente</span>
              </div>
            )}

            {/* Riepilogo */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{validTxs.length} transazioni valide</span>
              </div>
              {invalidTxs.length > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{invalidTxs.length} righe con errori (saltate)</span>
                </div>
              )}
              {/* Conteggio posizioni che verranno create */}
              {(() => {
                const uniqueKeys = new Set(validTxs.map((t) => `${t.name}||${t.platform}`));
                return (
                  <div className="text-sm text-muted-foreground">
                    {uniqueKeys.size} {uniqueKeys.size === 1 ? "posizione" : "posizioni"} coinvolte
                  </div>
                );
              })()}
            </div>

            {/* Preview transazioni */}
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <div className="divide-y">
                {transactions.map((tx, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 text-sm",
                      !tx.valid && "opacity-50 bg-destructive/5"
                    )}
                  >
                    {tx.valid ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{tx.name}</span>
                        {tx.ticker && (
                          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-xs font-mono text-primary">
                            {tx.ticker}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{tx.platform}</span>
                        <span>·</span>
                        <span>{formatDate(tx.date)}</span>
                        {tx.error && (
                          <span className="text-red-500">{tx.error}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className={cn("text-xs font-semibold", TX_TYPE_COLORS[tx.txType])}>
                        {tx.txType.toUpperCase()}
                      </span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {tx.quantity % 1 === 0 ? tx.quantity.toFixed(0) : tx.quantity.toFixed(4)} ×{" "}
                        {formatCurrency(tx.pricePerUnit)}
                      </span>
                      {tx.fees > 0 && (
                        <span className="text-xs text-orange-500">
                          fee {formatCurrency(tx.fees)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(detectedFormat === "scalable" ? 1 : 2)}
              >
                Indietro
              </Button>
              <Button
                onClick={handleImport}
                disabled={validTxs.length === 0 || importMutation.isPending}
              >
                {importMutation.isPending
                  ? "Importazione..."
                  : `Importa ${validTxs.length} transazioni`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
