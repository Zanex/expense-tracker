"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    _count: { expenses: number };
  };
  onEdit: (id: string) => void;
}

// ─── Component ───────────────────────────────────────────

export function CategoryCard({ category, onEdit }: CategoryCardProps) {
  const utils = api.useUtils();

  const deleteMutation = api.category.delete.useMutation({
    onSuccess: async () => {
      await utils.category.getAll.invalidate();
      toast.success("Categoria eliminata");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
      {/* Info categoria */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.icon ?? "📁"}</span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ backgroundColor: category.color ?? "#6366f1" }}
            >
              {category.name}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {category._count.expenses === 0
              ? "Nessuna spesa"
              : `${category._count.expenses} ${category._count.expenses === 1 ? "spesa" : "spese"}`}
          </span>
        </div>
      </div>

      {/* Azioni */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(category.id)}
        >
          <Pencil className="h-4 w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              />
            }
          >
            <Trash2 className="h-4 w-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare la categoria?</AlertDialogTitle>
              <AlertDialogDescription>
                {category._count.expenses > 0
                  ? `Questa categoria ha ${category._count.expenses} spese collegate e non può essere eliminata.`
                  : `Stai per eliminare "${category.name}". Questa azione non è reversibile.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              {category._count.expenses === 0 && (
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate({ id: category.id })}
                >
                  Elimina
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}