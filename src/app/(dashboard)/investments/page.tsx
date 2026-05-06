"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "~/components/ui/button";
import { InvestmentList } from "~/components/investments/investment-list";
import { InvestmentImportDialog } from "~/components/investments/investment-import-dialog";

export default function InvestmentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8 animate-stagger">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investimenti</h1>
          <p className="text-sm text-muted-foreground">
            Traccia il tuo portafoglio in tempo reale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importa CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo investimento
          </Button>
        </div>
      </div>

      <InvestmentList
        externalCreateOpen={createOpen}
        onExternalCreateClose={() => setCreateOpen(false)}
      />

      <InvestmentImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
