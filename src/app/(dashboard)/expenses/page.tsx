import { type Metadata } from "next";
import { ExpenseList } from "~/components/expenses/expense-list";

export const metadata: Metadata = {
  title: "Spese — Expense Tracker",
};

export default function ExpensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Spese</h1>
        <p className="text-sm text-muted-foreground">
          Tieni traccia di tutte le tue uscite.
        </p>
      </div>
      <ExpenseList />
    </div>
  );
}