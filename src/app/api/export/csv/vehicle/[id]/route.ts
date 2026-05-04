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

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildRow(values: string[]): string {
  return values.map(escapeCsv).join(",");
}

// ─── Route Handler ────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verifica ownership veicolo
  const vehicle = await db.vehicle.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Veicolo non trovato" }, { status: 404 });
  }

  // Fetch tutte le spese del veicolo
  const expenses = await db.expense.findMany({
    where: { userId: session.user.id, vehicleId: id },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  if (expenses.length === 0) {
    return NextResponse.json(
      { error: "Nessuna spesa trovata per questo veicolo" },
      { status: 404 }
    );
  }

  // ─── Costruisce CSV ───────────────────────────────────

  const header = buildRow([
    "Data",
    "Tipo",
    "Descrizione",
    "Categoria",
    "Importo (€)",
    "Litri",
    "€/Litro",
    "Km",
    "Pieno completo",
  ]);

  const rows = expenses.map((e) => {
    const isRefuel = e.liters !== null;
    const liters = isRefuel ? toNumber(e.liters) : null;
    const amount = toNumber(e.amount);
    const pricePerLiter =
      liters && liters > 0
        ? (amount / liters).toFixed(3)
        : "";

    return buildRow([
      formatDateCsv(e.date),
      isRefuel ? "Rifornimento" : "Spesa",
      e.description,
      `${e.category.icon ?? ""} ${e.category.name}`.trim(),
      amount.toFixed(2).replace(".", ","),
      liters != null ? liters.toFixed(2).replace(".", ",") : "",
      pricePerLiter ? pricePerLiter.replace(".", ",") : "",
      e.kmAtRefuel != null ? String(e.kmAtRefuel) : "",
      e.fullTank === true ? "Sì" : e.fullTank === false ? "No" : "",
    ]);
  });

  // Righe totale separate per rifornimenti e spese
  const totalFuel = expenses
    .filter((e) => e.liters !== null)
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const totalExpenses = expenses
    .filter((e) => e.liters === null)
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const totalLiters = expenses
    .filter((e) => e.liters !== null)
    .reduce((sum, e) => sum + toNumber(e.liters), 0);

  const totaleCarburante = buildRow([
    "",
    "TOTALE CARBURANTE",
    "",
    "",
    totalFuel.toFixed(2).replace(".", ","),
    totalLiters.toFixed(2).replace(".", ","),
    "",
    "",
    "",
  ]);

  const totaleSpese = buildRow([
    "",
    "TOTALE SPESE",
    "",
    "",
    totalExpenses.toFixed(2).replace(".", ","),
    "",
    "",
    "",
    "",
  ]);

  const totaleGenerale = buildRow([
    "",
    "TOTALE GENERALE",
    "",
    "",
    (totalFuel + totalExpenses).toFixed(2).replace(".", ","),
    "",
    "",
    "",
    "",
  ]);

  const csv = [
    header,
    ...rows,
    "",
    totaleCarburante,
    totaleSpese,
    totaleGenerale,
  ].join("\r\n");

  // BOM UTF-8 per Excel su Windows
  const bom = "\uFEFF";
  const slug = vehicle.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `veicolo-${slug}.csv`;

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}