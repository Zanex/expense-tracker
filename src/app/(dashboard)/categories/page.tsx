"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CategoryList } from "~/components/categories/category-list";

export default function CategoriesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8 chaos-entrance">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorie</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci le categorie per organizzare le tue spese.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova categoria
        </Button>
      </div>

      <CategoryList
        externalCreateOpen={createOpen}
        onExternalCreateClose={() => setCreateOpen(false)}
      />
    </div>
  );
}