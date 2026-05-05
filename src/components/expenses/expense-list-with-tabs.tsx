"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ExpenseList } from "./expense-list";
import { RecurringExpenseList } from "./recurring-expense-list";
import { cn } from "~/lib/utils";
import { Receipt, RefreshCw } from "lucide-react";

// ─── Tab types ────────────────────────────────────────────

type Tab = "all" | "recurring";

// ─── Component ───────────────────────────────────────────

export function ExpenseListWithTabs({ month, year }: { month?: number; year?: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Conta le ricorrenze attive per il badge
  const { data: recurring } = api.expense.getRecurring.useQuery();
  const recurringCount = recurring?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        <TabButton
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          icon={<Receipt className="h-4 w-4" />}
          label="Tutte le spese"
        />
        <TabButton
          active={activeTab === "recurring"}
          onClick={() => setActiveTab("recurring")}
          icon={<RefreshCw className="h-4 w-4" />}
          label="Ricorrenti"
          badge={recurringCount > 0 ? recurringCount : undefined}
        />
      </div>

      {/* Content */}
      {activeTab === "all" ? <ExpenseList month={month} year={year} /> : <RecurringExpenseList />}
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold",
            active
              ? "bg-primary text-primary-foreground"
              : "bg-muted-foreground/20 text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
