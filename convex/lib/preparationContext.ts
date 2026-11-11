import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { goalPlans } from "./goals";
import { StepWorkOutput, normalizeStepWork, type StepSource } from "../../shared/agents/stepWork";
import { validateResearchUrl } from "../../shared/integrations/website";

/** Capture existing work at enqueue time; a retry cannot silently consume a newer edit. */
export async function capturePlanPreparation(ctx: QueryCtx, orgId: Id<"organizations">, goalId: Id<"goals">) {
  const goal = await ctx.db.get(goalId);
  if (!goal || goal.orgId !== orgId) return null;
  const business = await ctx.db.get(goal.businessId);
  const plans = new Set((await goalPlans(ctx, orgId, goalId, 20)).map(plan => String(plan._id)));
  if (!business?.website || !plans.size) return null;
  const sameSite = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, "") === new URL(business.website!).hostname.replace(/^www\./, ""); } catch { return false; }
  };
  const rows = await ctx.db.query("planStepWork").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").take(20);
  const seen = new Set<string>(), drafts: { title: string; kind: string; body: string }[] = [];
  const sourceMap = new Map<string, StepSource>(), sourceWorkIds: string[] = [];
  const now = Date.now();
  for (const row of rows) {
    if (!plans.has(String(row.strategyId)) || row.goalId !== goalId || seen.has(row.stepKey) || !["ready", "needs_input"].includes(row.status) || !row.result || !row.website || !sameSite(row.website)) continue;
    try {
      const result = normalizeStepWork(StepWorkOutput.parse(JSON.parse(row.result)));
      const sources = (JSON.parse(row.sources ?? "[]") as StepSource[]).filter(source => source.status === "ok" && source.fetchedAt > now - 86_400_000 && source.fetchedAt <= now + 60_000 && validateResearchUrl(source.url).ok && typeof source.text === "string");
      if (!sources.length) continue;
      seen.add(row.stepKey); sourceWorkIds.push(String(row._id));
      const cited = new Set(result.evidence.map(entry => entry.url));
      for (const source of sources.sort((a, b) => Number(cited.has(b.url)) - Number(cited.has(a.url)))) if (!sourceMap.has(source.url)) sourceMap.set(source.url, { ...source, text: source.text.slice(0, 6500) });
      for (const [index, draft] of result.drafts.entries()) if (drafts.length < 3) drafts.push({ title: draft.title, kind: draft.kind, body: (row.edits.find(edit => edit.index === index)?.body ?? draft.body).slice(0, 4500) });
      if (sourceWorkIds.length === 3) break;
    } catch { /* Older malformed work is not evidence. */ }
  }
  if (!sourceMap.size) return null;
  const captured = { capturedAt: now, sourceWorkIds, sources: [...sourceMap.values()].slice(0, 8), drafts };
  while (JSON.stringify(captured).length > 60000 && captured.sources.length > 1) captured.sources.pop();
  return JSON.stringify(captured);
}
