import type { BudgetSummary } from "@/types";
import { queryKeys, useBackend } from "@/utils/backend";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * useBudget — fetches budget summaries for all mandates and returns them as
 * a Map keyed by mandatId for O(1) lookup in list/detail views.
 *
 * Backend contract:
 *   actor.getBudgetSummaries() → Array<BudgetSummary>
 *   actor.getBudgetSummary(mandatId) → Result_15 (ok: BudgetSummary)
 *
 * The hook returns:
 *   - summaries: Map<string, BudgetSummary> keyed by mandatId
 *   - the raw array for iteration
 *   - loading / error flags from React Query
 *
 * Per the doNotBuild contract, this hook does NOT implement budget warning
 * e-mails — it only exposes the budget data for in-app display.
 */
export interface UseBudgetResult {
  summaries: Map<string, BudgetSummary>;
  list: BudgetSummary[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useBudget(): UseBudgetResult {
  const { actor, isLoading } = useBackend();

  const query = useQuery({
    queryKey: queryKeys.budgetSummaries(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBudgetSummaries();
    },
    enabled: !!actor && !isLoading,
  });

  const summaries = useMemo(() => {
    const map = new Map<string, BudgetSummary>();
    for (const s of query.data ?? []) {
      map.set(s.mandatId, s);
    }
    return map;
  }, [query.data]);

  return {
    summaries,
    list: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/**
 * useBudgetSummary — fetches a single mandate's budget summary.
 * Returns null while loading or if the mandate has no summary yet.
 */
export function useBudgetSummary(mandatId: string | null | undefined) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: mandatId ? queryKeys.budgetSummary(mandatId) : ["budgetSummary"],
    queryFn: async () => {
      if (!actor || !mandatId) return null;
      const res = await actor.getBudgetSummary(mandatId);
      if (res.__kind__ === "err") {
        throw new Error(res.err);
      }
      return res.ok;
    },
    enabled: !!actor && !isLoading && !!mandatId,
  });
}
