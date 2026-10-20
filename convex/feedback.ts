import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Specific owner feedback on a plan (cycle 2). "Wrong fact", "too expensive",
 * "can't implement", "already tried", "done, with this result" and "not
 * relevant" each mean something different, so each updates its own record
 * instead of becoming one thumbs-down.
 */

export const REASONS = ["wrong_fact", "too_expensive", "cannot_implement", "already_tried", "done", "not_relevant"] as const;
export type FeedbackReason = (typeof REASONS)[number];

export const REASON_LABEL: Record<FeedbackReason, string> = {
  wrong_fact: "Wrong business fact",
  too_expensive: "Too expensive",
  cannot_implement: "Can't implement",
  already_tried: "Already tried",
  done: "Done",
  not_relevant: "Not relevant",
};

/** How the next plan should treat each reason. */
const BRIEF_RULE: Record<FeedbackReason, string> = {
  wrong_fact: "the owner says it rests on a wrong fact; don't reuse that claim",
  too_expensive: "too expensive for the owner; cheaper or free alternatives only",
  cannot_implement: "the owner can't implement it; avoid or make ClimbOS do it",
  already_tried: "already tried; don't repeat without a clear change",
  done: "done",
  not_relevant: "not relevant to the owner; don't repeat",
};

export const give = mutation({
  args: {
    slug: v.string(),
    strategyId: v.id("strategies"),
    subjectKind: v.union(v.literal("play"), v.literal("channel"), v.literal("fact"), v.literal("plan")),
    subjectKey: v.string(),
    subjectLabel: v.string(),
    reason: v.union(...REASONS.map((r) => v.literal(r))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    assertSameOrg(await ctx.db.get(a.strategyId), org._id, "plan");
    const note = a.note?.trim().slice(0, 500) || undefined;
    if ((a.reason === "done" || a.reason === "already_tried") && !note) throw appError("INVALID", a.reason === "done" ? "Add what happened (the result)." : "Add what you tried and what happened.");
    // A wrong fact goes back to review, so plans stop using it until the owner confirms or edits it.
    if (a.reason === "wrong_fact" && a.subjectKind === "fact") {
      const fact = await ctx.db.get(a.subjectKey as Id<"businessFacts">);
      if (!fact || fact.orgId !== org._id) throw appError("NOT_FOUND", "That fact isn't in this workspace.");
      await ctx.db.patch(fact._id, { reviewState: "needs_review", updatedAt: Date.now(), updatedBy: user._id });
    }
    await ctx.db.insert("ownerFeedback", { orgId: org._id, strategyId: a.strategyId, subjectKind: a.subjectKind, subjectKey: a.subjectKey.slice(0, 200), subjectLabel: a.subjectLabel.slice(0, 200), reason: a.reason, ...(note ? { note } : {}), createdBy: user._id, createdAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "plan.feedback", subjectType: "strategy", subjectId: a.strategyId, summary: `${REASON_LABEL[a.reason]}: ${a.subjectLabel.slice(0, 80)}` });
  },
});

/** Feedback on one plan's parts, newest first (for the play and channel cards). */
export const forStrategy = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const rows = await ctx.db.query("ownerFeedback").withIndex("by_strategy", (q) => q.eq("strategyId", strategyId)).order("desc").take(100);
    return rows.map((r) => ({ id: r._id, subjectKind: r.subjectKind, subjectKey: r.subjectKey, reason: r.reason, note: r.note ?? null, createdAt: r.createdAt }));
  },
});

/** The owner's feedback as the next plan reads it. */
export async function feedbackBrief(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const rows = await ctx.db.query("ownerFeedback").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(20);
  if (!rows.length) return "";
  const done = rows.filter((r) => r.reason === "done");
  const rest = rows.filter((r) => r.reason !== "done");
  return [
    rest.length ? `OWNER FEEDBACK ON EARLIER PLANS (respect it):\n${rest.slice(0, 10).map((r) => `- ${r.subjectKind} "${r.subjectLabel}": ${BRIEF_RULE[r.reason]}${r.note ? ` (owner: ${r.note})` : ""}`).join("\n")}` : "",
    done.length ? `DONE BY THE OWNER (their reported result; not proof of cause):\n${done.slice(0, 6).map((r) => `- ${r.subjectKind} "${r.subjectLabel}": ${r.note}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
