import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertSameOrg } from "./tenancy";
import { BusinessModelCheckSchema, businessModelTestsBrief, businessModelTestSubject } from "../../shared/agents/businessModel";
import type { Doc } from "../_generated/dataModel";

/** One indexed latest record per test: busy alternatives cannot crowd out the others. */
export async function latestBusinessModelTests(ctx: QueryCtx, orgId: Id<"organizations">, runId: Id<"workflowRuns">) {
  assertSameOrg(await ctx.db.get(runId), orgId, "business model check");
  const rows = await Promise.all((["deciding", "grounded", "adjacent", "bold"] as const).map(target =>
    ctx.db.query("businessModelTests").withIndex("by_run_target", q => q.eq("runId", runId).eq("target", target)).order("desc").first(),
  ));
  return rows.flatMap(row => row && row.orgId === orgId ? [row] : []);
}

export function parsedModelCheck(run: Doc<"workflowRuns"> | null) {
  if (!run || run.kind !== "business_model_check" || run.status !== "verified" || !run.output) return null;
  try { const parsed = BusinessModelCheckSchema.safeParse(JSON.parse(run.output)); return parsed.success ? parsed.data : null; } catch { return null; }
}

/** A bounded learning sample, with each report tied to its original proposal rather than today's mode label. */
export async function businessModelLearning(ctx: QueryCtx, orgId: Id<"organizations">, runs: readonly Doc<"workflowRuns">[]) {
  const summaries: string[] = [], notes: string[] = [];
  const reported = await ctx.db.query("workflowRuns").withIndex("by_org_kind_tested", q => q.eq("orgId", orgId).eq("kind", "business_model_check").gt("lastBusinessModelTestAt", 0)).order("desc").take(10);
  // Fallback covers recent legacy reports without the new timestamp. Full history remains paginated in the UI.
  const candidates = [...new Map([...reported, ...runs.slice(0, 10)].map(run => [run._id, run])).values()]
    .sort((a, b) => (b.lastBusinessModelTestAt ?? b.createdAt) - (a.lastBusinessModelTestAt ?? a.createdAt) || b._creationTime - a._creationTime);
  let included = 0;
  for (const run of candidates) {
    if (run.orgId !== orgId || run.isFixture) continue;
    const check = parsedModelCheck(run);
    if (!check) continue;
    const reports = (await latestBusinessModelTests(ctx, orgId, run._id)).filter(report => businessModelTestSubject(check, report.target) !== null);
    if (!reports.length) continue;
    included++;
    summaries.push(`Check ${run._id}, saved ${new Date(run.createdAt).toISOString()}: ${businessModelTestsBrief(reports).summary}`);
    for (const report of reports) {
      const subject = businessModelTestSubject(check, report.target);
      if (!subject) continue;
      notes.push(JSON.stringify({ checkId: run._id, checkCreatedAt: run.createdAt, reportId: report._id, reportedAt: report.createdAt,
        target: report.target, originalProposal: subject.name,
        testState: report.testState, outcome: report.outcome ?? "not_recorded", evidence: report.outcomeEvidence,
        ownerDecision: report.ownerDecision, note: report.outcomeNote?.slice(0, 600) ?? null,
        originalTest: subject.test, successSignal: subject.successSignal, stopCondition: subject.stopCondition,
      }));
    }
    if (included === 3) break;
  }
  return { summary: summaries.length ? `HISTORICAL BUSINESS MODEL LEARNING: latest report per original test from up to three reported checks, selected from the ten most recently reported checks plus the ten newest checks for legacy coverage; older history may be omitted. Match each result to its original proposal/test below, never to a newer idea merely because both are called grounded, adjacent or bold. Historical business context may have changed. Owner-selected measured evidence is not independently verified; missing outcomes stay unknown. Decisions to adopt/drop are owner preferences, not success/failure evidence. Not-run and unclear outcomes cannot establish effectiveness.\n${summaries.join("\n")}` : "", notes };
}
