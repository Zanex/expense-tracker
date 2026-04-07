import { api } from "~/trpc/react";

const STORAGE_KEY = "expense_tracker_onboarding_dismissed";

export function useOnboarding() {
  const { data: categories, isLoading } = api.category.getAll.useQuery();

  const isDismissed =
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY) === "true"
      : true;

  const shouldShow =
    !isLoading && !isDismissed && (categories?.length ?? 0) === 0;

  return { shouldShow, isLoading };
}