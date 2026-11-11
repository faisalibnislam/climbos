import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { focusedGoal } from "./lib/goals";
import { audit } from "./lib/audit";

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const selected = await focusedGoal(ctx, org);
    const goals = await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", org._id).eq("status", "active")).order("desc").take(21);
    return { selectedId: selected?._id ?? null, canEdit: ["owner", "admin", "editor"].includes(role), limited: goals.length > 20,
      goals: goals.slice(0, 20).map(g => ({ id: g._id, statement: g.statement, kind: g.kind, deadline: g.deadline ?? null })) };
  },
});

export const select = mutation({
  args: { slug: v.string(), goalId: v.id("goals") },
  handler: async (ctx, { slug, goalId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const goal = assertSameOrg(await ctx.db.get(goalId), org._id, "goal");
    if (goal.status !== "active") throw appError("INVALID", "This goal is in your history. Choose a current goal.");
    await ctx.db.patch(org._id, { focusedGoalId: goalId });
  },
});

/** Adding or editing a goal never starts AI work or changes an existing spending allowance. */
export const save = mutation({
  args: { slug: v.string(), goalId: v.optional(v.id("goals")), statement: v.string(), deadline: v.optional(v.string()) },
  handler: async (ctx, { slug, goalId, statement, deadline }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const clean = statement.trim();
    if (clean.length < 4 || clean.length > 300) throw appError("INVALID", "Describe your goal in 4–300 characters.");
    if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)) throw appError("INVALID", "Choose a valid deadline, or leave it open.");
    const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Add your business first.");
    let id = goalId;
    if (id) {
      const goal = assertSameOrg(await ctx.db.get(id), org._id, "goal");
      if (goal.status !== "active") throw appError("INVALID", "This goal has moved to history. Open a current goal.");
      await ctx.db.patch(id, { statement: clean, deadline: deadline || undefined, timingMode: "ai" });
    } else {
      const existing = await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", org._id).eq("status", "active")).take(20);
      if (existing.length >= 20) throw appError("INVALID", "You already have 20 current goals. Update one before adding another.");
      id = await ctx.db.insert("goals", { orgId: org._id, businessId: business._id, kind: "custom", statement: clean,
        // Retained as a financial modeling window for legacy readers, never presented as delivery timing.
        horizonDays: 90, timingMode: "ai", ...(deadline ? { deadline } : {}), monthlyAdBudgetMinor: 0, currency: business.currency,
        status: "active", createdBy: user._id, createdAt: Date.now() });
    }
    await ctx.db.patch(org._id, { focusedGoalId: id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: goalId ? "goal.updated" : "goal.added", subjectType: "goal", subjectId: id, summary: "Saved a goal. No AI job, publishing, or spending started." });
    return id;
  },
});
