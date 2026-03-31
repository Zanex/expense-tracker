import { Skeleton } from "~/components/ui/skeleton";

// ─── Expense List Skeleton ────────────────────────────────

export function ExpenseListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Filtri skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Tabella skeleton */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category List Skeleton ───────────────────────────────

export function CategoryListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Cards Skeleton (per la Fase 2) ───────────────────

export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-white p-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Chart Skeleton (per la Fase 2) ──────────────────────

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}