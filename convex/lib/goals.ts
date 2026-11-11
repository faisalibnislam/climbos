import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** One shared business, several goals. Switching focus never changes a running job's goal. */
export async function focusedGoal(ctx: Pick<QueryCtx, "db">, org: Pick<Doc<"organizations">, "_id" | "focusedGoalId">) {
  const selected = org.focusedGoalId ? await ctx.db.get(org.focusedGoalId) : null;
  if (selected?.orgId === org._id && selected.status === "active") return selected;
  return ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", org._id).eq("status", "active")).order("desc").first();
}

export async function runGoal(ctx: Pick<QueryCtx, "db">, run: Pick<Doc<"workflowRuns">, "orgId" | "input">) {
  let input: { goalId?: string; strategyId?: string } = {};
  try { const parsed = JSON.parse(run.input); if (parsed && typeof parsed === "object") input = parsed; } catch { /* Historical jobs may not have structured inputs. */ }
  const goalId = input.goalId ? ctx.db.normalizeId("goals", input.goalId) : null;
  if (goalId) {
    const goal = await ctx.db.get(goalId);
    return goal?.orgId === run.orgId ? goal : null;
  }
  const strategyId = input.strategyId ? ctx.db.normalizeId("strategies", input.strategyId) : null;
  if (strategyId) {
    const strategy = await ctx.db.get(strategyId);
    if (strategy?.orgId !== run.orgId) return null;
    const goal = await ctx.db.get(strategy.goalId);
    return goal?.orgId === run.orgId ? goal : null;
  }
  const org = await ctx.db.get(run.orgId);
  return org ? focusedGoal(ctx, org) : null;
}

export async function goalPlans(ctx: Pick<QueryCtx, "db">, orgId: Id<"organizations">, goalId: Id<"goals"> | undefined, limit = 10) {
  const plans: Doc<"strategies">[] = [];
  const seen = new Set<string>();
  // Revised goals retain their thread; unrelated goals never join this history.
  for (let id = goalId; id && seen.size < 50 && plans.length < limit;) {
    if (seen.has(id)) break;
    seen.add(id);
    const goal = await ctx.db.get(id);
    if (goal?.orgId !== orgId) break;
    plans.push(...await ctx.db.query("strategies").withIndex("by_org_goal", q => q.eq("orgId", orgId).eq("goalId", goal._id)).order("desc").take(limit - plans.length));
    id = goal.previousGoalId;
  }
  return plans.sort((a, b) => b.createdAt - a.createdAt || b.version - a.version).slice(0, limit);
}
