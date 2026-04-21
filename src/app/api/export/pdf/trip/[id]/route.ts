import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { ExpenseReport } from "~/components/reports/expense-report-pdf";
import { toNumber } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────

function fmt(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
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

  // Fetch viaggio — verifica ownership
  const trip = await db.trip.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!trip) {
    return NextResponse.json({ error: "Viaggio non trovato" }, { status: 404 });
  }

  // Fetch spese del viaggio
  const expenses = await db.expense.findMany({
    where: { userId: session.user.id, tripId: id },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  if (expenses.length === 0) {
    return NextResponse.json(
      { error: "Nessuna spesa trovata per questo viaggio" },
      { status: 404 }
    );
  }

  // Totale
  const totalAmount = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);

  // Breakdown per categoria
  const categoryMap = new Map<string, { name: string; icon: string; total: number }>();
  for (const e of expenses) {
    const existing = categoryMap.get(e.categoryId);
    if (existing) {
      existing.total += toNumber(e.amount);
    } else {
      categoryMap.set(e.categoryId, {
        name: e.category.name,
        icon: e.category.icon ?? "📁",
        total: toNumber(e.amount),
      });
    }
  }

  const categorySummary = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ name: c.name, icon: c.icon, total: fmt(c.total) }));

  // Label periodo
  const periodLabel = [
    trip.destination ?? trip.name,
    fmtDate(trip.startDate),
    trip.endDate ? `— ${fmtDate(trip.endDate)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Genera PDF
  const buffer = await renderToBuffer(
    createElement(ExpenseReport, {
      title: `Viaggio: ${trip.name}`,
      period: periodLabel,
      userEmail: session.user.email ?? "",
      totalAmount: fmt(totalAmount),
      expenseCount: expenses.length,
      expenses: expenses.map((e) => ({
        date: fmtDate(e.date),
        description: e.description,
        category: e.category.name,
        amount: fmt(toNumber(e.amount)),
      })),
      categorySummary,
    })
  );

  const slug = trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `viaggio-${slug}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}