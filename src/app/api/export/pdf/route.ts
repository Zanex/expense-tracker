import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { ExpenseReport } from "~/components/reports/expense-report-pdf";
import { toNumber } from "~/lib/utils";

// ─── Helpers ─────────────────────────────────────────────

function formatCurrencyPdf(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDatePdf(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
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

  // Build date filter
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

  // Aggregazioni
  const totalAmount = expenses.reduce(
    (sum, e) => sum + toNumber(e.amount),
    0
  );

  // Riepilogo per categoria
  const categoryMap = new Map<
    string,
    { name: string; icon: string; total: number }
  >();
  for (const expense of expenses) {
    const key = expense.categoryId;
    const existing = categoryMap.get(key);
    if (existing) {
      existing.total += expense.amount.toNumber();
    } else {
      categoryMap.set(key, {
        name: expense.category.name,
        icon: expense.category.icon ?? "📁",
        total: expense.amount.toNumber(),
      });
    }
  }

  const categorySummary = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
      name: c.name,
      icon: c.icon,
      total: formatCurrencyPdf(c.total),
    }));

  // Periodo label
  const periodLabel =
    monthNum && yearNum
      ? new Date(yearNum, monthNum - 1, 1).toLocaleDateString("it-IT", {
          month: "long",
          year: "numeric",
        })
      : "Tutte le spese";

  // Genera PDF
  const buffer = await renderToBuffer(
    createElement(ExpenseReport, {
      title: "Report spese",
      period: periodLabel,
      userEmail: session.user.email ?? "",
      totalAmount: formatCurrencyPdf(totalAmount),
      expenseCount: expenses.length,
      expenses: expenses.map((e) => ({
        date: formatDatePdf(e.date),
        description: e.description,
        category: `${e.category.icon ?? "📁"} ${e.category.name}`,
        amount: formatCurrencyPdf(e.amount.toNumber()),
      })),
      categorySummary,
    })
  );

  // Filename
  const filename =
    monthNum && yearNum
      ? `spese-${String(monthNum).padStart(2, "0")}-${yearNum}.pdf`
      : "spese-export.pdf";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
