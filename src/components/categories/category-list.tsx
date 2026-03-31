"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { CategoryCard } from "./category-card";
import { CategoryForm } from "./category-form";

// ─── Types ────────────────────────────────────────────────

interface CategoryListProps {
  externalCreateOpen?: boolean;
  onExternalCreateClose?: () => void;
}

// ─── Component ───────────────────────────────────────────

export function CategoryList({
  externalCreateOpen = false,
  onExternalCreateClose,
}: CategoryListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sincronizza apertura dialog da bottone esterno (header pagina)
  useEffect(() => {
    if (externalCreateOpen) {
      setEditingId(null);
      setDialogOpen(true);
    }
  }, [externalCreateOpen]);

  const { data: categories, isLoading } = api.category.getAll.useQuery();

  const { data: editingCategory } = api.category.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  // ─── Handlers ──────────────────────────────────────────

  function handleOpenEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingId(null);
    onExternalCreateClose?.();
  }

  // ─── Loading ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <>
      {!categories || categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nessuna categoria"
          description="Crea la tua prima categoria per iniziare a tracciare le spese."
          action={{
            label: "Nuova categoria",
            onClick: () => {
              setEditingId(null);
              setDialogOpen(true);
            },
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleOpenEdit}
            />
          ))}
        </div>
      )}

      {/* Dialog create / edit */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica categoria" : "Nuova categoria"}
            </DialogTitle>
          </DialogHeader>
          {editingId && !editingCategory ? (
            <div className="flex flex-col gap-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <CategoryForm
              category={editingCategory ?? undefined}
              onSuccess={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}