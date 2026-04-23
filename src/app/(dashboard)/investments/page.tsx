"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { InvestmentList } from "~/components/investments/investment-list";

export default function InvestmentsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investimenti</h1>
          <p className="text-sm text-muted-foreground">
            Traccia il tuo portafoglio in tempo reale.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo investimento
        </Button>
      </div>

      <InvestmentList
        externalCreateOpen={createOpen}
        onExternalCreateClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
