"use client";

import { MonthlyTrend } from "~/components/charts/monthly-trend";
import { HistoricTable } from "~/components/reports/historic-table";
import { ExportButton } from "~/components/reports/export-button";
import { AnnualComparison } from "~/components/reports/annual-comparison";
import { getCurrentMonth, getCurrentYear } from "~/lib/utils";

export default function ReportsPage() {
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report</h1>
          <p className="text-sm text-muted-foreground">
            Analisi storica delle tue spese.
          </p>
        </div>
        <ExportButton
          month={currentMonth}
          year={currentYear}
          label="Esporta mese corrente"
        />
      </div>

      {/* Grafico andamento 12 mesi */}
      <MonthlyTrend
        month={currentMonth}
        year={currentYear}
        months={12}
      />

      {/* Confronto annuale YoY */}
      <AnnualComparison />

      {/* Tabella storica */}
      <HistoricTable months={12} />
    </div>
  );
}
