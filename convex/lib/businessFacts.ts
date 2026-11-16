import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** State filtering precedes the bound: retired history cannot hide current evidence. */
export async function activeBusinessFacts(ctx: QueryCtx, business: Doc<"businesses">, perState = 200, includePending = true) {
  const states = includePending ? ["confirmed", "edited", "needs_review"] as const : ["confirmed", "edited"] as const;
  const batches = await Promise.all(states.map(state => ctx.db.query("businessFacts")
    .withIndex("by_business_state_updated", q => q.eq("businessId", business._id).eq("reviewState", state))
    .order("desc").take(perState + 1)));
  return {
    facts: batches.flatMap(rows => rows.slice(0, perState)).filter(row => row.orgId === business.orgId).sort((a, b) => b.updatedAt - a.updatedAt || b._creationTime - a._creationTime),
    limited: batches.some(rows => rows.length > perState),
  };
}
