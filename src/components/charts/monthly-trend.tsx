"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/utils";
import { ChartSkeleton } from "~/components/ui/skeletons";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ─── Types ────────────────────────────────────────────────

interface MonthlyTrendProps {
  month: number;
  year: number;
  months?: number;  // quanti mesi mostrare (default 6)
}

// ─── Custom Tooltip ───────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === undefined) return null;

  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{formatCurrency(value)}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export function MonthlyTrend({ month, year, months = 6 }: MonthlyTrendProps) {
  const { data, isLoading } = api.report.getMonthlyTrend.useQuery({
    month,
    year,
    months,
  });

  if (isLoading) return <ChartSkeleton />;

  const hasData = data?.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Andamento ultimi {months} mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !hasData ? (
          <EmptyState
            icon={BarChart2}
            title="Nessun dato"
            description="Nessuna spesa registrata nel periodo selezionato."
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} barSize={32}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`
                }
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5" }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    // Mese selezionato evidenziato, gli altri più chiari
                    fill={
                      entry.month === month && entry.year === year
                        ? "#6366f1"
                        : "#c7d2fe"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
