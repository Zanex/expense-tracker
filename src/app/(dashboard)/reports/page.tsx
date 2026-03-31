"use client";

import { MonthlyTrend } from "~/components/charts/monthly-trend";
import { HistoricTable } from "~/components/reports/historic-table";
import { getCurrentMonth, getCurrentYear } from "~/lib/utils";

export default function ReportsPage() {
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Report</h1>
        <p className="text-sm text-muted-foreground">
          Analisi storica delle tue spese.
        </p>
      </div>

      {/* Grafico ultimi 12 mesi */}
      <MonthlyTrend
        month={currentMonth}
        year={currentYear}
        months={12}
      />

      {/* Tabella storica */}
      <HistoricTable months={12} />
    </div>
  );
}
