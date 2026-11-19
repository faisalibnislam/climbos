import { progressEligibility, type CustomerProgressRecord } from "../../shared/growth/customerProgress";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { appError } from "./tenancy";

/** A changed observation can hold or exit an existing entry, never authorize or send a step. */
export async function reconcileProgressJourneys(ctx: MutationCtx, orgId: Id<"organizations">, contactId: Id<"contacts">, progress: CustomerProgressRecord) {
  const entries = await ctx.db.query("journeyContacts").withIndex("by_org_contact", q => q.eq("orgId", orgId).eq("contactId", contactId)).take(21);
  if (entries.length > 20) throw appError("LIMIT_REACHED", "This contact's follow-up history needs review.");
  for (const entry of entries) {
    if (entry.status !== "active" && entry.status !== "held") continue;
    const journey = await ctx.db.get(entry.journeyId);
    if (!journey || journey.orgId !== orgId) continue;
    const result = progressEligibility(progress, journey.rule, Date.now());
    if (result.status !== "eligible") await ctx.db.patch(entry._id, { status: result.status === "different_progress" ? "exited" : "held", reason: result.status === "different_progress" ? "The reported progress or its definition changed." : "A recent matching progress report is needed.", updatedAt: Date.now() });
  }
}
