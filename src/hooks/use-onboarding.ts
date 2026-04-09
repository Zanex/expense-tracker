import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

const STORAGE_KEY = "expense_tracker_onboarding_dismissed";

export function useOnboarding() {
  const { data: categories, isLoading } = api.category.getAll.useQuery();

  // ─── Hydration-safe localStorage read ────────────────
  // Non leggere localStorage durante SSR — causa mismatch.
  // useState(true) come valore iniziale sicuro (wizard nascosto),
  // poi useEffect aggiorna dopo il mount solo lato client.
  const [isDismissed, setIsDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    setMounted(true);
  }, []);

  // Prima del mount non mostrare nulla per evitare flash
  const shouldShow =
    mounted &&
    !isLoading &&
    !isDismissed &&
    (categories?.length ?? 0) === 0;

  return { shouldShow, isLoading };
}