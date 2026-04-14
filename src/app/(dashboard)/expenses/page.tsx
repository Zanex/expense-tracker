"use client";

import { useMonthFilter } from "~/hooks/use-month-filter";
import { MonthFilterControl } from "~/components/dashboard/month-filter";
import { ExpenseListWithTabs } from "~/components/expenses/expense-list-with-tabs";

export default function ExpensesPage() {
  const filter = useMonthFilter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Spese</h1>
          <p className="text-sm text-muted-foreground">
            Tieni traccia di tutte le tue uscite.
          </p>
        </div>
        <MonthFilterControl filter={filter} />
      </div>
      <ExpenseListWithTabs />
    </div>
  );
}