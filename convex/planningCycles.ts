import { focusedGoal } from "./lib/goals";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
const lengthV = v.union(v.literal(14), v.literal(30), v.literal(90));
export const view = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const goal = await focusedGoal(ctx, org);
    return { canEdit: ["owner", "admin", "editor"].includes(role), goal: goal ? { id: goal._id, statement: goal.statement, lengthDays: goal.horizonDays, startedAt: goal.cycleStartedAt ?? goal.createdAt, priorReview: goal.priorCycleReview ?? null } : null };
  },
});
export const history = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { slug, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const result = await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "archived")).order("desc").paginate({ ...paginationOpts, numItems: Math.min(12, paginationOpts.numItems) });
    return { ...result, page: result.page.map((g) => ({ id: g._id, statement: g.statement, lengthDays: g.horizonDays, startedAt: g.cycleStartedAt ?? g.createdAt, closedAt: g.cycleClosedAt ?? null, review: g.cycleReview ?? null, closure: g.cycleClosure ?? "earlier_plan" })) };
  },
});
async function activeGoal(ctx: MutationCtx, slug: string, expectedGoalId: Id<"goals">) {
  const access = await requireOrgAccess(ctx, { slug }, "edit");
  const goal = assertSameOrg(await ctx.db.get(expectedGoalId), access.org._id, "goal");
  if (goal.status !== "active") throw appError("INVALID", "The cycle changed in another window. Review the current cycle first.");
  return { ...access, goal };
}
async function nextGoal(ctx: MutationCtx, goal: Doc<"goals">, userId: Id<"users">, lengthDays: 14 | 30 | 90, mode: "length_changed" | "reviewed", review?: NonNullable<Doc<"goals">["cycleReview"]>) {
  const now = Date.now();
  const { _id, _creationTime: _creation, cycleReview: _review, cycleClosedAt: _closed, cycleClosure: _closure, ...base } = goal;
  await ctx.db.patch(_id, { status: "archived", cycleClosedAt: now, cycleClosure: mode, ...(review ? { cycleReview: review } : {}) });
  const id = await ctx.db.insert("goals", { ...base, previousGoalId: _id, horizonDays: lengthDays, status: "active", createdBy: userId, createdAt: now, cycleStartedAt: mode === "length_changed" ? goal.cycleStartedAt ?? goal.createdAt : now, ...(review ? { priorCycleReview: { ...review, goalId: _id } } : {}) });
  const org = await ctx.db.get(goal.orgId);
  if (!org?.focusedGoalId || org.focusedGoalId === goal._id) await ctx.db.patch(goal.orgId, { focusedGoalId: id });
  return id;
}
export const changeLength = mutation({
  args: { slug: v.string(), expectedGoalId: v.id("goals"), lengthDays: lengthV },
  handler: async (ctx, args) => {
    const { org, user, goal } = await activeGoal(ctx, args.slug, args.expectedGoalId);
    if (goal.horizonDays === args.lengthDays) return goal._id;
    const id = await nextGoal(ctx, goal, user._id, args.lengthDays, "length_changed");
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "planning_cycle.length_changed", subjectType: "goal", subjectId: id, summary: `Changed execution window to ${args.lengthDays} days. Budget and target retained; a refreshed plan needs review.` });
    return id;
  },
});
export const continueCycle = mutation({
  args: { slug: v.string(), expectedGoalId: v.id("goals"), lengthDays: lengthV, summary: v.string(), carryForward: v.string(), evidenceBasis: v.union(v.literal("measured"), v.literal("owner_reported"), v.literal("unknown")), evidenceNote: v.string() },
  handler: async (ctx, args) => {
    const { org, user, goal } = await activeGoal(ctx, args.slug, args.expectedGoalId);
    const summary = args.summary.trim(), carryForward = args.carryForward.trim(), evidenceNote = args.evidenceNote.trim();
    if (summary.length < 4 || carryForward.length < 4 || evidenceNote.length < 4 || Math.max(summary.length, carryForward.length, evidenceNote.length) > 1600) throw appError("INVALID", "Add a short review, what to carry forward, and the evidence or what remains unknown (4–1600 characters each).");
    const review = { summary, carryForward, evidenceBasis: args.evidenceBasis, evidenceNote, createdAt: Date.now(), createdBy: user._id };
    const id = await nextGoal(ctx, goal, user._id, args.lengthDays, "reviewed", review);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "planning_cycle.continued", subjectType: "goal", subjectId: id, summary: `Saved the cycle review and started a ${args.lengthDays}-day cycle. No plan generated or external work started.` });
    return id;
  },
});
