import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Admin-controlled cost display. Everyone sees credits unless an operator
 * enabled real API cost for that user; only then do queries add the
 * provider-billed cost (`providerMicros`) to what they return. Billing is
 * unchanged either way: granted users are still charged in credits.
 */
export async function showsApiCost(ctx: Ctx, userId: Id<"users"> | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const grant = await ctx.db.query("costDisplayGrants").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  return grant?.enabled === true;
}

/** What providers billed for a run; runs from before it was tracked fall back to what was charged. */
export function runProviderMicros(run: Pick<Doc<"workflowRuns">, "actualMicros" | "providerMicros">): number {
  return run.providerMicros ?? run.actualMicros;
}

/** What the provider billed for one usage event (absent = same as the credit charge). */
export function eventProviderMicros(e: Pick<Doc<"usageEvents">, "costMicros" | "providerMicros">): number {
  return e.providerMicros ?? e.costMicros;
}
