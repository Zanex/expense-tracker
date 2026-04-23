/**
 * Parser CSV per importazione investimenti.
 * Scalable Capital: formato fisso auto-rilevato.
 * Generico: colonne mappate dall'utente.
 */

// ─── Types ────────────────────────────────────────────────

export type InvestmentType = "etf" | "stock" | "crypto" | "fund" | "bond" | "gold" | "cash";
export type TransactionType = "buy" | "sell" | "dividend" | "fee";

export interface ParsedTransaction {
  // Posizione
  name: string;
  ticker: string | null;
  isin: string | null;
  platform: string;
  type: InvestmentType;
  // Transazione
  txType: TransactionType;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  date: Date;
  notes: string | null;
  // Stato parsing
  valid: boolean;
  error?: string;
  // Riga raw per debug
  rawRow: Record<string, string>;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  detectedFormat: "scalable" | "generic";
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ColumnMapping {
  date: string;
  txType: string;
  name: string;
  ticker: string;
  quantity: string;
  pricePerUnit: string;
  fees: string;
  notes: string;
}

// ─── Scalable Capital Parser ──────────────────────────────

/**
 * Scalable Capital CSV export ha queste colonne (sep: ,):
 * Date,Type,ISIN,Name,Quantity,Price,Amount,Currency,Fee
 *
 * Esempi type: "Buy","Sell","Dividend","Saveback"
 */

const SCALABLE_TX_MAP: Record<string, TransactionType> = {
  "buy":        "buy",
  "sell":       "sell",
  "dividend":   "dividend",
  "saveback":   "buy",    // piano accumulo Scalable
  "interest":   "dividend",
  "fee":        "fee",
  "custody fee":"fee",
};

function guessInvestmentType(name: string, isin: string | null): InvestmentType {
  const n = name.toLowerCase();
  if (n.includes("etf") || n.includes("ishares") || n.includes("vanguard") ||
      n.includes("xtrackers") || n.includes("amundi") || n.includes("invesco")) return "etf";
  if (n.includes("bitcoin") || n.includes("ethereum") || n.includes("crypto") ||
      n.includes("xbt") || n.includes("btc") || n.includes("eth")) return "crypto";
  if (n.includes("bond") || n.includes("btp") || n.includes("bund") ||
      n.includes("treasury") || n.includes("obbligaz")) return "bond";
  if (n.includes("gold") || n.includes("oro") || n.includes("silver")) return "gold";
  if (isin?.startsWith("XS") || isin?.startsWith("DE0001")) return "bond";
  return "stock";
}

export function parseScalableCapitalCSV(rows: Record<string, string>[]): ParsedTransaction[] {
  return rows.map((row): ParsedTransaction => {
    try {
      // Normalizza chiavi (trim + lowercase)
      const r = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v?.trim() ?? ""])
      );

      const rawDate = r["date"] ?? r["booking date"] ?? r["value date"] ?? "";
      const rawType = (r["type"] ?? r["transaction type"] ?? "").toLowerCase();
      const name = r["name"] ?? r["description"] ?? r["instrument"] ?? "";
      const isin = r["isin"] ?? r["isin code"] ?? null;
      const ticker = r["ticker"] ?? r["symbol"] ?? null;
      const rawQty = r["quantity"] ?? r["shares"] ?? r["units"] ?? "0";
      const rawPrice = r["price"] ?? r["unit price"] ?? "0";
      const rawFees = r["fee"] ?? r["fees"] ?? r["commission"] ?? "0";

      // Parse data — supporta DD.MM.YYYY e YYYY-MM-DD
      let date: Date;
      if (rawDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        const [d, m, y] = rawDate.split(".");
        date = new Date(`${y!}-${m!}-${d!}`);
      } else {
        date = new Date(rawDate);
      }

      if (isNaN(date.getTime())) {
        throw new Error(`Data non valida: "${rawDate}"`);
      }

      // Parse numeri — Scalable usa punto come separatore decimale
      const parseNum = (s: string) => {
        const cleaned = s.replace(/[^\d.,-]/g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      };

      const quantity = Math.abs(parseNum(rawQty));
      const pricePerUnit = Math.abs(parseNum(rawPrice));
      const fees = Math.abs(parseNum(rawFees));

      const txType: TransactionType = SCALABLE_TX_MAP[rawType] ?? "buy";

      if (!name) throw new Error("Nome strumento mancante");
      if (quantity <= 0 && txType !== "fee") throw new Error("Quantità non valida");
      if (pricePerUnit <= 0 && txType !== "fee") throw new Error("Prezzo non valido");

      return {
        name,
        ticker: ticker || null,
        isin: isin || null,
        platform: "Scalable Capital",
        type: guessInvestmentType(name, isin || null),
        txType,
        quantity: txType === "fee" ? 1 : quantity,
        pricePerUnit: txType === "fee" ? fees : pricePerUnit,
        fees: txType === "fee" ? 0 : fees,
        date,
        notes: r["reference"] ?? r["notes"] ?? null,
        valid: true,
        rawRow: row,
      };
    } catch (err) {
      return {
        name: row["Name"] ?? row["name"] ?? "—",
        ticker: null,
        isin: null,
        platform: "Scalable Capital",
        type: "etf",
        txType: "buy",
        quantity: 0,
        pricePerUnit: 0,
        fees: 0,
        date: new Date(),
        notes: null,
        valid: false,
        error: err instanceof Error ? err.message : "Errore parsing",
        rawRow: row,
      };
    }
  });
}

// ─── Generic CSV Parser ───────────────────────────────────

const GENERIC_TX_MAP: Record<string, TransactionType> = {
  "buy": "buy", "acquisto": "buy", "compra": "buy", "carico": "buy",
  "sell": "sell", "vendita": "sell", "vendi": "sell", "scarico": "sell",
  "dividend": "dividend", "dividendo": "dividend", "dividendi": "dividend",
  "fee": "fee", "commissione": "fee", "spesa": "fee",
};

export function parseGenericCSV(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  defaultPlatform: string,
  defaultTxType: TransactionType,
  defaultInvestmentType: InvestmentType
): ParsedTransaction[] {
  return rows.map((row): ParsedTransaction => {
    try {
      const get = (col: string) => (col ? (row[col] ?? "") : "");

      const rawDate = get(mapping.date);
      const rawType = get(mapping.txType).toLowerCase();
      const name = get(mapping.name).trim();
      const ticker = get(mapping.ticker).trim() || null;
      const rawQty = get(mapping.quantity);
      const rawPrice = get(mapping.pricePerUnit);
      const rawFees = get(mapping.fees);
      const notes = get(mapping.notes) || null;

      // Parse data
      let date: Date;
      if (rawDate.match(/^\d{2}[/\-.]\d{2}[/\-.]\d{4}$/)) {
        const sep = rawDate.includes("/") ? "/" : rawDate.includes("-") ? "-" : ".";
        const parts = rawDate.split(sep);
        date = new Date(`${parts[2]!}-${parts[1]!.padStart(2, "0")}-${parts[0]!.padStart(2, "0")}`);
      } else {
        date = new Date(rawDate);
      }

      if (isNaN(date.getTime())) throw new Error(`Data non valida: "${rawDate}"`);

      // Parse numeri — gestisce sia punto che virgola come decimale
      const parseNum = (s: string) => {
        const cleaned = s.replace(/[^\d.,-]/g, "");
        const normalized = cleaned.includes(",") && !cleaned.includes(".")
          ? cleaned.replace(",", ".")
          : cleaned.replace(",", "");
        return parseFloat(normalized) || 0;
      };

      const quantity = Math.abs(parseNum(rawQty));
      const pricePerUnit = Math.abs(parseNum(rawPrice));
      const fees = Math.abs(parseNum(rawFees));
      const txType: TransactionType = GENERIC_TX_MAP[rawType] ?? defaultTxType;

      if (!name) throw new Error("Nome strumento mancante");
      if (quantity <= 0 && txType !== "fee") throw new Error("Quantità non valida");
      if (pricePerUnit <= 0 && txType !== "fee") throw new Error("Prezzo non valido");

      return {
        name,
        ticker,
        isin: null,
        platform: defaultPlatform,
        type: defaultInvestmentType,
        txType,
        quantity: txType === "fee" ? 1 : quantity,
        pricePerUnit: txType === "fee" ? fees : pricePerUnit,
        fees: txType === "fee" ? 0 : fees,
        date,
        notes,
        valid: true,
        rawRow: row,
      };
    } catch (err) {
      return {
        name: "—",
        ticker: null,
        isin: null,
        platform: defaultPlatform,
        type: defaultInvestmentType,
        txType: defaultTxType,
        quantity: 0,
        pricePerUnit: 0,
        fees: 0,
        date: new Date(),
        notes: null,
        valid: false,
        error: err instanceof Error ? err.message : "Errore parsing",
        rawRow: row,
      };
    }
  });
}

// ─── Format detector ──────────────────────────────────────

export function detectCSVFormat(headers: string[]): "scalable" | "generic" {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const scalableSignals = ["isin", "type", "quantity", "price", "name"];
  const matches = scalableSignals.filter((s) => lower.some((h) => h.includes(s)));
  return matches.length >= 3 ? "scalable" : "generic";
}
