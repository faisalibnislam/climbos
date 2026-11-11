import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { planTimeline } from "../shared/agents/planTimeline";

export const view = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const rows = await ctx.db.query("planTaskProgress").withIndex("by_strategy_task", q => q.eq("strategyId", strategyId)).take(500);
    return { canEdit: ["owner", "admin", "editor"].includes(role), rows: rows.filter(row => row.orgId === org._id).map(({ taskKey, taskText, completed, revision }) => ({ taskKey, taskText, completed, revision })) };
  },
});

export const save = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), taskKey: v.string(), expectedText: v.string(), expectedRevision: v.number(), completed: v.boolean() },
  handler: async (ctx, { slug, strategyId, taskKey, expectedText, expectedRevision, completed }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const plan = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const task = planTimeline(plan.expert).flatMap(step => step.tasks).find(task => task.key === taskKey);
    if (!task || task.text !== expectedText) throw appError("INVALID", "This step has changed. Refresh the plan before updating progress.");
    const prior = await ctx.db.query("planTaskProgress").withIndex("by_strategy_task", q => q.eq("strategyId", strategyId).eq("taskKey", taskKey)).unique();
    if (prior && prior.taskText === expectedText && prior.completed === completed) return { revision: prior.revision };
    if ((prior?.revision ?? 0) !== expectedRevision) throw appError("INVALID", "Someone updated this task. Refresh and try again.");
    const row = { orgId: org._id, strategyId, goalId: plan.goalId, taskKey, taskText: task.text, completed, revision: expectedRevision + 1, updatedBy: user._id, updatedAt: Date.now() };
    if (prior) await ctx.db.patch(prior._id, row); else await ctx.db.insert("planTaskProgress", row);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "plan_task.progress", subjectType: "strategy", subjectId: strategyId, summary: completed ? "Team marked a plan task done. No external action or business result is verified." : "Team reopened a plan task." });
    return { revision: row.revision };
  },
});
