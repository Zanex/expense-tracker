"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { formatCurrency, formatDate, toNumber } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import { Search, Receipt, Tag, ArrowRight, X, Command } from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

type ResultItem =
  | { type: "expense"; id: string; description: string; amount: number; date: Date; categoryName: string; categoryColor: string | null; categoryIcon: string | null }
  | { type: "category"; id: string; name: string; icon: string | null; color: string | null };

// ─── Hook: keyboard shortcut ─────────────────────────────

function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}

// ─── Command Palette Component ───────────────────────────

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, 200);

  // Query spese
  const { data: expenseData } = api.expense.getAll.useQuery(
    { search: debouncedQuery, page: 1, limit: 5 },
    { enabled: open && debouncedQuery.length >= 2 }
  );

  // Query categorie
  const { data: categories } = api.category.getAll.useQuery(undefined, {
    enabled: open,
  });

  // Costruisce i risultati
  const results: ResultItem[] = [];

  if (debouncedQuery.length >= 2) {
    // Spese che matchano
    expenseData?.expenses.forEach((e) => {
      results.push({
        type: "expense",
        id: e.id,
        description: e.description,
        amount: toNumber(e.amount),
        date: e.date,
        categoryName: e.category.name,
        categoryColor: e.category.color,
        categoryIcon: e.category.icon,
      });
    });
  }

  // Categorie filtrate per nome
  const filteredCategories = (categories ?? []).filter(
    (c) =>
      debouncedQuery.length < 2 ||
      c.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );
  filteredCategories.slice(0, 3).forEach((c) => {
    results.push({
      type: "category",
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    });
  });

  // Reset active index quando cambiano i risultati
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  // Focus input quando apre
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Navigazione tastiera tra risultati
  const handleSelect = useCallback((item: ResultItem) => {
    setOpen(false);
    if (item.type === "expense") {
      router.push(`/expenses?search=${encodeURIComponent(item.description)}`);
    } else {
      router.push(`/categories`);
    }
  }, [router, setOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIndex]) {
        handleSelect(results[activeIndex]!);
      }
    },
    [results, activeIndex, handleSelect]
  );

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cerca spese, categorie..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        {/* Risultati */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && debouncedQuery.length >= 2 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nessun risultato per &quot;{debouncedQuery}&quot;
              </p>
            </div>
          )}

          {results.length === 0 && debouncedQuery.length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Inizia a scrivere per cercare...
            </div>
          )}

          {/* Sezione spese */}
          {results.some((r) => r.type === "expense") && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2">
                <Receipt className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Spese
                </span>
              </div>
              {results
                .filter((r): r is Extract<ResultItem, { type: "expense" }> => r.type === "expense")
                .map((item, idx) => {
                  const globalIdx = idx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        activeIndex === globalIdx
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-white"
                        style={{ backgroundColor: item.categoryColor ?? "#6366f1" }}
                      >
                        {item.categoryIcon ?? "📁"}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {item.description}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.categoryName} · {formatDate(item.date)}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Sezione categorie */}
          {results.some((r) => r.type === "category") && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Categorie
                </span>
              </div>
              {results
                .filter((r): r is Extract<ResultItem, { type: "category" }> => r.type === "category")
                .map((item, idx) => {
                  const globalIdx = results.filter((r) => r.type === "expense").length + idx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        activeIndex === globalIdx
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <span className="text-lg">{item.icon ?? "📁"}</span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-sm font-medium text-white"
                        style={{ backgroundColor: item.color ?? "#6366f1" }}
                      >
                        {item.name}
                      </span>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer shortcut hint */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1 py-0.5">↑↓</kbd>
              naviga
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1 py-0.5">↵</kbd>
              apri
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Command className="h-3 w-3" />K per aprire
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Trigger Button (per l'header) ───────────────────────

export function CommandPaletteTrigger() {

  // Triggera l'apertura simulando Cmd+K
  function handleClick() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <button
      onClick={handleClick}
      className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Cerca...</span>
      <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 text-xs">
        ⌘K
      </kbd>
    </button>
  );
}