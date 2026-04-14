import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { toNumber } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────

function formatDateCsv(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/** Escapa un valore per CSV — aggiunge virgolette se contiene virgola/newline */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvRow(values: string[]): string {
  return values.map(escapeCsv).join(",");
}

// ─── Route Handler ────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Params
  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const monthNum = month ? parseInt(month) : null;
  const yearNum = year ? parseInt(year) : null;

  const dateFilter =
    monthNum && yearNum
      ? {
          gte: new Date(yearNum, monthNum - 1, 1),
          lt: new Date(yearNum, monthNum, 1),
        }
      : undefined;

  // Fetch spese
  const expenses = await db.expense.findMany({
    where: {
      userId: session.user.id,
      ...(dateFilter && { date: dateFilter }),
    },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  if (expenses.length === 0) {
    return NextResponse.json(
      { error: "Nessuna spesa trovata per il periodo selezionato" },
      { status: 404 }
    );
  }

  // ─── Costruisce il CSV ────────────────────────────────

  const header = buildCsvRow([
    "Data",
    "Descrizione",
    "Categoria",
    "Icona",
    "Importo (€)",
    "Ricorrente",
  ]);

  const rows = expenses.map((e) =>
    buildCsvRow([
      formatDateCsv(e.date),
      e.description,
      e.category.name,
      e.category.icon ?? "",
      toNumber(e.amount).toFixed(2).replace(".", ","), // formato italiano
      e.isRecurring ? "Sì" : e.recurringParentId ? "Auto" : "No",
    ])
  );

  // Riga totale in fondo
  const total = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const totaleRow = buildCsvRow([
    "",
    "TOTALE",
    "",
    "",
    total.toFixed(2).replace(".", ","),
    "",
  ]);

  const csv = [header, ...rows, "", totaleRow].join("\r\n");

  // BOM UTF-8 — necessario per Excel su Windows
  const bom = "\uFEFF";
  const csvWithBom = bom + csv;

  // Filename
  const periodLabel =
    monthNum && yearNum
      ? `${String(monthNum).padStart(2, "0")}-${yearNum}`
      : "export";
  const filename = `spese-${periodLabel}.csv`;

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}