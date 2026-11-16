import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertSameOrg } from "./tenancy";

/** One indexed latest record per test: busy alternatives cannot crowd out the others. */
export async function latestBusinessModelTests(ctx: QueryCtx, orgId: Id<"organizations">, runId: Id<"workflowRuns">) {
  assertSameOrg(await ctx.db.get(runId), orgId, "business model check");
  const rows = await Promise.all((["deciding", "grounded", "adjacent", "bold"] as const).map(target =>
    ctx.db.query("businessModelTests").withIndex("by_run_target", q => q.eq("runId", runId).eq("target", target)).order("desc").first(),
  ));
  return rows.flatMap(row => row && row.orgId === orgId ? [row] : []);
}
