"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { TripList } from "~/components/trips/trip-list";

export default function TripsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Viaggi</h1>
          <p className="text-sm text-muted-foreground">
            Organizza le tue spese per viaggio.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo viaggio
        </Button>
      </div>

      <TripList
        externalCreateOpen={createOpen}
        onExternalCreateClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
