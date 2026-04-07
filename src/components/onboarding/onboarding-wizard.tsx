"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Sparkles, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ─── Categorie suggerite ──────────────────────────────────

const SUGGESTED_CATEGORIES = [
  { name: "Alimentari", icon: "🛒", color: "#22c55e" },
  { name: "Casa", icon: "🏠", color: "#3b82f6" },
  { name: "Trasporti", icon: "🚗", color: "#f97316" },
  { name: "Svago", icon: "🎭", color: "#a855f7" },
  { name: "Salute", icon: "💊", color: "#ef4444" },
  { name: "Abbigliamento", icon: "👔", color: "#ec4899" },
  { name: "Sport", icon: "🏋️", color: "#14b8a6" },
  { name: "Tecnologia", icon: "💻", color: "#6366f1" },
];

const STORAGE_KEY = "expense_tracker_onboarding_dismissed";

// ─── Types ────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
}

// ─── Component ───────────────────────────────────────────

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["Alimentari", "Casa", "Trasporti", "Svago"])
  );

  const utils = api.useUtils();

  const createBatch = api.category.createBatch.useMutation({
    onSuccess: async (result) => {
      await utils.category.getAll.invalidate();
      toast.success(
        result.created > 0
          ? `${result.created} categorie create!`
          : "Categorie già presenti."
      );
      localStorage.setItem(STORAGE_KEY, "true");
      onComplete();
    },
    onError: (err) => toast.error(err.message),
  });

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  }

  function handleCreate() {
    const toCreate = SUGGESTED_CATEGORIES.filter((c) =>
      selected.has(c.name)
    );
    if (toCreate.length === 0) {
      handleSkip();
      return;
    }
    createBatch.mutate(toCreate);
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Benvenuto in Expense Tracker!</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Inizia scegliendo le categorie che usi di più. Potrai aggiungerne
          altre o personalizzarle in qualsiasi momento.
        </p>
      </div>

      {/* Griglia categorie */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUGGESTED_CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat.name);
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => toggle(cat.name)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-all hover:scale-[1.02]",
                isSelected
                  ? "border-transparent shadow-md"
                  : "border-border bg-background hover:border-muted-foreground/30"
              )}
              style={
                isSelected
                  ? {
                      backgroundColor: `${cat.color}18`,
                      borderColor: cat.color,
                    }
                  : undefined
              }
            >
              {/* Checkmark */}
              {isSelected && (
                <span
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: cat.color }}
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}

              {/* Icona */}
              <span className="text-2xl">{cat.icon}</span>

              {/* Nome con badge colorato */}
              <span
                className="rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} categorie selezionate`
            : "Nessuna categoria selezionata"}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Salta per ora
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createBatch.isPending}
          >
            {createBatch.isPending
              ? "Creazione..."
              : selected.size > 0
                ? `Crea ${selected.size} categorie`
                : "Continua"}
          </Button>
        </div>
      </div>
    </div>
  );
}