import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";

export const forStrategy = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const edits = await ctx.db.query("planDrafts").withIndex("by_strategy_index", q => q.eq("strategyId", strategyId)).take(3);
    return { canEdit: ["owner", "admin", "editor"].includes(role), edits: edits.filter(e => e.orgId === org._id).map(e => ({ index: e.workIndex, body: e.body, revision: e.revision, updatedAt: e.updatedAt })) };
  },
});

export const save = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), index: v.number(), expectedRevision: v.number(), body: v.string() },
  handler: async (ctx, { slug, strategyId, index, expectedRevision, body }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const plan = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    if (!Number.isInteger(index) || index < 0 || index > 2 || !plan.expert?.preparedWork?.[index]) throw appError("NOT_FOUND", "This prepared draft is not in this plan.");
    if (!body.trim() || body.length > 20_000) throw appError("INVALID", "Keep the draft between 1 and 20,000 characters.");
    const prior = await ctx.db.query("planDrafts").withIndex("by_strategy_index", q => q.eq("strategyId", strategyId).eq("workIndex", index)).unique();
    if ((prior?.revision ?? 0) !== expectedRevision) throw appError("INVALID", "Someone saved a newer draft. Your text is still here; compare it before saving again.");
    const edit = { orgId: org._id, strategyId, goalId: plan.goalId, workIndex: index, body, revision: expectedRevision + 1, updatedBy: user._id, updatedAt: Date.now() };
    if (prior) await ctx.db.patch(prior._id, edit); else await ctx.db.insert("planDrafts", edit);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "plan_draft.saved", subjectType: "strategy", subjectId: strategyId, summary: "Saved a private draft edit. The original plan, its approval, and external accounts are unchanged." });
    return { revision: edit.revision };
  },
});

/** Saved draft text and its goal remain retrievable outside the chat or plan currently on screen. */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const plans = await ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", org._id)).order("desc").take(51);
    const edits = await ctx.db.query("planDrafts").withIndex("by_org_updated", q => q.eq("orgId", org._id)).order("desc").take(101);
    const seen = new Set<string>();
    const rows = [];
    for (const plan of plans.slice(0, 50)) {
      const saved = edits.filter(e => e.strategyId === plan._id);
      if (seen.has(plan.goalId) && !saved.length) continue;
      seen.add(plan.goalId);
      if (!plan.expert?.preparedWork?.length) continue;
      const goal = await ctx.db.get(plan.goalId);
      if (goal?.orgId !== org._id) continue;
      if (goal.status === "archived" && !saved.length) continue;
      rows.push({ strategyId: plan._id, goal: goal.statement, createdAt: plan.createdAt,
        work: plan.expert.preparedWork.map((w, index) => ({ title: w.title, index, edited: saved.some(e => e.workIndex === index) })) });
    }
    // An older edited plan may sit outside the recent-plan window.
    const included = new Set(rows.map(r => r.strategyId));
    for (const edit of edits.slice(0, 100)) {
      if (included.has(edit.strategyId)) continue;
      const plan = await ctx.db.get(edit.strategyId);
      if (plan?.orgId !== org._id || !plan.expert?.preparedWork?.length) continue;
      const goal = await ctx.db.get(plan.goalId);
      if (goal?.orgId !== org._id) continue;
      included.add(plan._id);
      rows.push({ strategyId: plan._id, goal: goal.statement, createdAt: plan.createdAt, work: plan.expert.preparedWork.map((w, index) => ({ title: w.title, index, edited: edits.some(e => e.strategyId === plan._id && e.workIndex === index) })) });
    }
    return { rows, limited: plans.length > 50 || edits.length > 100 };
  },
});
