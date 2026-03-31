"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// ─── Component ───────────────────────────────────────────

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log dell'errore in sviluppo
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Qualcosa è andato storto</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {process.env.NODE_ENV === "development"
            ? error.message
            : "Si è verificato un errore inaspettato. Riprova."}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Riprova
      </Button>
    </div>
  );
}