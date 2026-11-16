import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assessDesignLearning } from "../../shared/growth/designLearning";

/** Resolve every reference in the workspace before exposing an outcome or using it in a prompt. */
export async function designLearningRecord(ctx: QueryCtx, orgId: Id<"organizations">, test: Doc<"experiments">, now = Date.now()) {
  const source = test.designSource;
  if (test.orgId !== orgId || !source) return null;
  const [page, run, strategy] = await Promise.all([ctx.db.get(source.pageId), ctx.db.get(source.runId), ctx.db.get(test.strategyId)]);
  if (!page || page.orgId !== orgId || !run || run.orgId !== orgId || run.kind !== "conversion_audit" || run.status !== "verified" || run.isFixture || !strategy || strategy.orgId !== orgId) return null;
  const goal = await ctx.db.get(strategy.goalId);
  if (!goal || goal.orgId !== orgId) return null;
  if (page.designCriticSource?.runId !== source.runId || page.designCriticSource.findingIndex !== source.findingIndex) return null;
  let finding: { observation?: string; directions?: { id?: string }[] } | undefined;
  try {
    const output = JSON.parse(run.output ?? "{}");
    if (Number.isSafeInteger(source.findingIndex) && source.findingIndex >= 0 && Array.isArray(output.designCritic?.findings)) finding = output.designCritic.findings[source.findingIndex];
  } catch { return null; }
  if (!finding || !Array.isArray(finding.directions) || !finding.directions.some(direction => direction?.id === page.designCriticSource!.directionId)) return null;
  const version = await ctx.db.query("landingPageVersions").withIndex("by_page_version", q => q.eq("pageId", page._id).eq("version", source.pageVersion)).first();
  if (version && version.orgId !== orgId) return null;
  const plan = version?.designMeasurementPlan ?? (page.version === source.pageVersion ? page.designMeasurementPlan : undefined);
  const measurementBound = plan?.appliesToVersion === source.pageVersion && plan.metric.trim() === test.primaryMetric.trim() && plan.decisionRule?.trim() === test.stoppingRule.trim();
  const publicationConfirmed = version?.publicationApprovedAt !== undefined || page.publishedVersion === source.pageVersion;
  const outcome = test.analyses?.at(-1);
  return {
    experimentId: test._id, runId: source.runId, findingIndex: source.findingIndex,
    pageId: page._id, pageVersion: source.pageVersion, title: version?.title ?? page.title,
    sourceUrl: page.designCriticSource.sourceUrl ?? null,
    direction: page.designCriticSource.directionName,
    region: page.designCriticSource.region ?? null,
    originalObservation: typeof finding.observation === "string" ? finding.observation : null,
    audience: test.population,
    objective: goal.statement,
    metric: outcome?.metric ?? test.primaryMetric,
    originalMetric: test.primaryMetric,
    successRule: outcome?.successRule ?? test.stoppingRule,
    originalSuccessRule: test.stoppingRule,
    originalResult: test.analyses?.find(analysis => !analysis.redefined)?.result ?? null,
    baseline: plan?.baseline ?? null,
    publicationConfirmed, publicationApprovedAt: version?.publicationApprovedAt ?? null,
    outcome: outcome ? (({ reviewedBy: _reviewedBy, ...publicOutcome }) => publicOutcome)(outcome) : null,
    deviations: (test.deviations ?? []).map(({ at, note }) => ({ at, note })),
    assessment: assessDesignLearning({ outcome, publicationConfirmed, publicationApprovedAt: version?.publicationApprovedAt, measurementBound, baselineRecorded: plan?.baseline.state === "recorded", method: test.method, metricType: test.primaryMetricType, preregisteredAt: test.preregisteredAt, deviations: test.deviations?.length ?? 0, now }),
  };
}

/** Bounded same-tenant context, explicitly separate from measured or causal business facts. */
export async function designLearningBrief(ctx: QueryCtx, orgId: Id<"organizations">, now = Date.now()) {
  const candidates = await ctx.db.query("experiments").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").take(101);
  const tests = candidates.slice(0, 100).filter(test => test.designSource && test.analyses?.length).sort((a, b) => b.analyses!.at(-1)!.reviewedAt - a.analyses!.at(-1)!.reviewedAt);
  const records = (await Promise.all(tests.slice(0, 20).map(test => designLearningRecord(ctx, orgId, test, now)))).filter(record => record !== null);
  if (!records.length) return "";
  const included: typeof records = [];
  let characters = 0;
  for (const record of records) {
    const size = JSON.stringify(record).length;
    // Never truncate a record halfway through its evidence limits.
    if (characters + size > 10_000) continue;
    included.push(record);
    characters += size;
  }
  return JSON.stringify({
    basis: "Workspace-member-recorded page outcomes. Source choices are reported, not independently verified. Publication metadata proves approval of a version, not traffic exposure or business impact.",
    scope: "At most 20 design results from the 100 most recently created workspace experiments, with a 10,000-character record budget; this is not exhaustive history.",
    truncated: candidates.length > 100 || tests.length > 20 || included.length < records.length,
    interpretation: "Observed or compared records can support an outcome-based inference. Other reports identify evidence gaps or test improvements, not winners or losers. All may help frame reversible tests; lack of evidence does not gate original ideas. Reports are not universal style rules, performance promises or execution permission.",
    records: included,
  });
}
