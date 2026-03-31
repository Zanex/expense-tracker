"use client";

import { useMonthFilter } from "~/hooks/use-month-filter";
import { MonthFilterControl } from "~/components/dashboard/month-filter";
import { KpiGrid } from "~/components/dashboard/kpi-grid";
import { ExpensesByCategory } from "~/components/charts/expenses-by-category";
import { MonthlyTrend } from "~/components/charts/monthly-trend";

export default function DashboardPage() {
  const filter = useMonthFilter();

  return (
    <div className="flex flex-col gap-6">
      {/* Header con filtro mese */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Panoramica delle tue spese.
          </p>
        </div>
        <MonthFilterControl filter={filter} />
      </div>

      {/* KPI cards */}
      <KpiGrid month={filter.month} year={filter.year} />

      {/* Grafici */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ExpensesByCategory month={filter.month} year={filter.year} />
        <MonthlyTrend month={filter.month} year={filter.year} months={6} />
      </div>
    </div>
  );
}