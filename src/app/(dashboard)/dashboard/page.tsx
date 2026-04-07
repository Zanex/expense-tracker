"use client";

import { useState } from "react";
import { useMonthFilter } from "~/hooks/use-month-filter";
import { useOnboarding } from "~/hooks/use-onboarding";
import { MonthFilterControl } from "~/components/dashboard/month-filter";
import { KpiGrid } from "~/components/dashboard/kpi-grid";
import { ExpensesByCategory } from "~/components/charts/expenses-by-category";
import { MonthlyTrend } from "~/components/charts/monthly-trend";
import { ExportButton } from "~/components/reports/export-button";
import { OnboardingWizard } from "~/components/onboarding/onboarding-wizard";
import { ChartErrorBoundary } from "~/components/ui/chart-error-boundary";
import { ErrorBoundary } from "~/components/ui/error-boundary";

export default function DashboardPage() {
  const filter = useMonthFilter();
  const { shouldShow } = useOnboarding();
  const [wizardVisible, setWizardVisible] = useState(true);

  const showWizard = shouldShow && wizardVisible;

  return (
    <div className="flex flex-col gap-6">
      {/* Header con filtro mese + export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Panoramica delle tue spese.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthFilterControl filter={filter} />
          <ExportButton
            month={filter.month}
            year={filter.year}
            label="PDF"
          />
        </div>
      </div>

      {/* Onboarding wizard — visibile solo al primo accesso */}
      {showWizard && (
        <OnboardingWizard onComplete={() => setWizardVisible(false)} />
      )}

      {/* KPI cards — fallback inline se crashano */}
      <ErrorBoundary className="h-32">
        <KpiGrid month={filter.month} year={filter.year} />
      </ErrorBoundary>

      {/* Grafici — ogni chart isolato */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartErrorBoundary title="Spese per categoria">
          <ExpensesByCategory month={filter.month} year={filter.year} />
        </ChartErrorBoundary>

        <ChartErrorBoundary title="Andamento mensile">
          <MonthlyTrend month={filter.month} year={filter.year} months={6} />
        </ChartErrorBoundary>
      </div>
    </div>
  );
}
