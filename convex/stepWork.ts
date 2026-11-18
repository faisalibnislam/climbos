import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { can, canonicalJson, sha256Hex } from "../shared/policy";
import { planTimeline } from "../shared/agents/planTimeline";
import { shortOwnerReply } from "../shared/intake/interview";
import { StepWorkOutput, normalizeStepWork, validateStepWork, type StepSource } from "../shared/agents/stepWork";
import { validateResearchUrl } from "../shared/integrations/website";
import { createRunWithReservation, estimateRun } from "./engine";
import { STEP_WORK_STEPS } from "./lib/stepWork";
import { defaultModelRoute } from "./lib/modelRoute";
import { isModelKey, routeModelKey } from "../shared/ai/modelChoice";
import { currentRateVersion } from "../shared/economics";
import { focusedGoal, goalPlans } from "./lib/goals";

const ACTIVE = ["cost_reserved", "preparing", "executing"];
const hash = (value: unknown) => sha256Hex(canonicalJson(JSON.parse(JSON.stringify(value))));
export const home = query({ args: { slug: v.string() }, handler: async (ctx, { slug }) => {
  const { org } = await requireOrgAccess(ctx, { slug }, "view");
  const goal = await focusedGoal(ctx, org);
  const plans = await goalPlans(ctx, org._id, goal?._id);
  const selected = plans.find(plan => plan.status === "approved") ?? plans[0];
  if (!selected) return null;
  // Read the latest attempt per saved step, not a global slice that can hide
  // this plan or resurrect an earlier success behind a newer failure.
  const rows = await Promise.all(planTimeline(selected.expert).map(step =>
    ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", selected._id).eq("stepKey", step.key)).filter(q => q.eq(q.field("orgId"), org._id)).order("desc").first(),
  ));
  for (const work of rows.filter(row => row !== null).sort((a, b) => b._creationTime - a._creationTime)) {
    if (work.goalId !== selected.goalId || !["ready", "needs_input"].includes(work.status) || !work.result) continue;
    let result;
    try { result = StepWorkOutput.safeParse(JSON.parse(work.result)); } catch { continue; }
    if (!result.success) continue;
    const featured = result.data.drafts.find(draft => !["research", "analysis"].includes(draft.kind) && !/hold|unverified|unknown/i.test(draft.title)) ?? result.data.drafts[0];
    return { workId: work._id, strategyId: selected._id, stepKey: work.stepKey, title: featured?.title ?? work.stepTitle, summary: result.data.summary, stepTitle: work.stepTitle, needsAnswer: work.status === "needs_input" };
  }
  return null;
} });
async function snapshot(ctx: QueryCtx, orgId: Id<"organizations">, userId: Id<"users">, strategyId: Id<"strategies">, stepKey: string) {
  const strategy = assertSameOrg(await ctx.db.get(strategyId), orgId, "plan");
  const step = planTimeline(strategy.expert).find(step => step.key === stepKey);
  if (!step) throw appError("NOT_FOUND", "This step is not in the saved plan.");
  const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first();
  const goal = assertSameOrg(await ctx.db.get(strategy.goalId), orgId, "goal");
  const intake = await ctx.db.query("intakeConversations").withIndex("by_org_user", q => q.eq("orgId", orgId).eq("userId", userId)).first();
  const facts = business ? await ctx.db.query("businessFacts").withIndex("by_business", q => q.eq("businessId", business._id)).take(25) : [];
  const drafts = await ctx.db.query("planDrafts").withIndex("by_strategy_index", q => q.eq("strategyId", strategyId)).take(3);
  const evidence = await ctx.db.query("planEvidence").withIndex("by_strategy", q => q.eq("strategyId", strategyId)).first();
  let planResearch: unknown[] = [];
  try {
    const saved = evidence?.orgId === orgId ? JSON.parse(evidence.data) : null;
    if (Array.isArray(saved?.research)) planResearch = saved.research.slice(0, 2).map((item: { notes?: string; sources?: unknown[]; retrievedAt?: number }) => ({ notes: item.notes?.slice(0, 14000), sources: item.sources?.slice(0, 20), retrievedAt: item.retrievedAt, basis: "Saved public-source summary, not tested behavior, permission or verbatim page evidence. Re-read cited pages for new quotes." }));
  } catch { /* Legacy evidence is optional; retain the saved plan. */ }
  const context = JSON.stringify({ step, goal: goal.statement, business: business ? { name: business.name, website: business.website, summary: business.summary, discoveryBrief: business.discoveryBrief?.slice(0, 16000), unitEconomics: business.unitEconomics } : null, ownerDiscovery: intake?.profile, facts: facts.filter(fact => fact.orgId === orgId && fact.reviewState !== "rejected").map(fact => ({ statement: fact.statement, provenance: fact.provenance, reviewState: fact.reviewState })), plan: { summary: strategy.summary, focusedMove: strategy.expert?.focusedMove, preparedWork: strategy.expert?.preparedWork?.map((draft, i) => ({ ...draft, draft: (drafts.find(row => row.workIndex === i)?.body ?? draft.draft).slice(0, 8000) })) } }).slice(0, 60000);
  let savedContext: Record<string, unknown>;
  try { savedContext = JSON.parse(context); } catch { savedContext = { step, savedPlanContext: context }; }
  const preparedContext = JSON.stringify({ ...savedContext, planResearch });
  return { context: preparedContext, baseHash: await hash(preparedContext), step, stepFingerprint: await hash(step), website: business?.website, cachedSources: JSON.stringify(intake?.sources.filter(source => source.status === "ok").slice(0, 4) ?? []) };
}

export const quote = query({ args: { slug: v.string() }, handler: async (ctx, { slug }) => {
  const { org } = await requireOrgAccess(ctx, { slug }, "edit");
  if (org.kind === "demo") return { canPrepare: false, reason: "Open your own business to prepare new work. You can still explore saved demo drafts.", maxCostMicros: 0 };
  const route = await defaultModelRoute(ctx);
  return { canPrepare: true, reason: null, maxCostMicros: estimateRun(STEP_WORK_STEPS.map(step => ({ ...step, modelKey: step.modelKey && isModelKey(step.modelKey) ? routeModelKey(route, step.modelKey) : step.modelKey })), currentRateVersion().id, { repair: false }).costMicros };
} });

export const view = query({ args: { slug: v.string(), strategyId: v.id("strategies"), stepKey: v.string(), workId: v.optional(v.id("planStepWork")) }, handler: async (ctx, args) => {
  const { org, user, role } = await requireOrgAccess(ctx, { slug: args.slug }, "view");
  assertSameOrg(await ctx.db.get(args.strategyId), org._id, "plan");
  const latest = await ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", args.strategyId).eq("stepKey", args.stepKey)).filter(q => q.eq(q.field("orgId"), org._id)).order("desc").first();
  const work = args.workId ? await ctx.db.get(args.workId) : latest;
  if (!work || work.orgId !== org._id) return null;
  if (work.strategyId !== args.strategyId || work.stepKey !== args.stepKey) throw appError("FORBIDDEN", "This work belongs to another plan step.");
  const prior = await ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", args.strategyId).eq("stepKey", args.stepKey).lt("_creationTime", work._creationTime)).order("desc").first();
  const run = await ctx.db.get(work.runId);
  const status = work.status === "working" && (!run || !ACTIVE.includes(run.status)) ? "failed" : work.status;
  const current = await snapshot(ctx, org._id, user._id, args.strategyId, args.stepKey);
  return { id: work._id, status, historical: work._id !== latest?._id, previousId: prior?._id, stale: current.baseHash !== work.baseHash, phase: work.phase, result: work.result ? StepWorkOutput.parse(JSON.parse(work.result)) : null, sources: work.sources ? (JSON.parse(work.sources) as { url: string; title?: string; status: string }[]).map(({ url, title, status }) => ({ url, title, status })) : [], edits: work.edits, draftRevision: work.draftRevision, error: work.error ?? run?.userMessage, canEdit: can(role, "edit") };
} });
export const forStrategy = query({ args: { slug: v.string(), strategyId: v.id("strategies") }, handler: async (ctx, { slug, strategyId }) => {
  const { org } = await requireOrgAccess(ctx, { slug }, "view");
  const strategy = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
  const rows = await Promise.all(planTimeline(strategy.expert).map(async step => {
    const work = await ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", strategyId).eq("stepKey", step.key)).order("desc").first();
    if (!work || work.orgId !== org._id) return null;
    const run = await ctx.db.get(work.runId);
    return { stepKey: step.key, title: step.title, status: work.status === "working" && (!run || !ACTIVE.includes(run.status)) ? "failed" as const : work.status };
  }));
  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
} });

export const start = mutation({ args: { slug: v.string(), strategyId: v.id("strategies"), stepKey: v.string(), requestKey: v.string(), answer: v.optional(v.string()), refresh: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
  if (org.kind === "demo") throw appError("INVALID", "Open your own business to prepare real work.");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestKey) || (args.answer?.length ?? 0) > 2000) throw appError("INVALID", "Please try again with a shorter answer.");
  const duplicate = await ctx.db.query("planStepWork").withIndex("by_org_request", q => q.eq("orgId", org._id).eq("requestKey", args.requestKey)).unique();
  if (duplicate) {
    if (duplicate.createdBy !== user._id || duplicate.strategyId !== args.strategyId || duplicate.stepKey !== args.stepKey) throw appError("INVALID", "This request belongs to another step.");
    return { workId: duplicate._id, reused: true };
  }
  const data = await snapshot(ctx, org._id, user._id, args.strategyId, args.stepKey);
  const prior = await ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", args.strategyId).eq("stepKey", args.stepKey)).order("desc").first();
  const priorRun = prior ? await ctx.db.get(prior.runId) : null;
  if (prior && priorRun && ACTIVE.includes(priorRun.status)) return { workId: prior._id, reused: true };
  if (prior?.baseHash === data.baseHash && ["ready", "needs_input"].includes(prior.status) && !args.answer?.trim() && !args.refresh) return { workId: prior._id, reused: true };
  if (args.answer?.trim() && prior?.status !== "needs_input") throw appError("INVALID", "There is no unanswered question for this step.");
  const priorContent = prior?.result ? prior : (await ctx.db.query("planStepWork").withIndex("by_strategy_step", q => q.eq("strategyId", args.strategyId).eq("stepKey", args.stepKey)).order("desc").take(10)).find(row => row.result);
  const previous = priorContent?.result ? StepWorkOutput.parse(JSON.parse(priorContent.result)) : null;
  const answer = args.answer?.trim() ? `Question: ${previous?.ownerQuestion?.text ?? "Missing private context"}\nOwner answer: ${args.answer.trim()}\nThis is context, not approval to publish or spend.` : null;
  const answers = [...(priorContent?.baseHash === data.baseHash ? priorContent.answers : []), ...(answer ? [answer] : [])].slice(-4);
  const plan = (await ctx.db.get(args.strategyId))!;
  const runId = await createRunWithReservation(ctx, { org, kind: "plan_step_prepare", title: `Prepare: ${data.step.title}`.slice(0, 160), roles: ["coo"], input: { strategyId: args.strategyId, goalId: plan.goalId, stepKey: args.stepKey, stepFingerprint: data.stepFingerprint }, steps: STEP_WORK_STEPS, meters: { searchCalls: 2 }, createdBy: user._id, isFixture: false });
  const now = Date.now();
  const previousWork = previous ? JSON.stringify({ ...previous, drafts: previous.drafts.map((draft, index) => ({ ...draft, body: priorContent?.edits.find(edit => edit.index === index)?.body ?? draft.body })) }).slice(0, 20000) : undefined;
  const cachedSources = priorContent?.baseHash === data.baseHash && priorContent.sources ? priorContent.sources : data.cachedSources;
  const workId = await ctx.db.insert("planStepWork", { orgId: org._id, strategyId: args.strategyId, goalId: plan.goalId, createdBy: user._id, stepKey: args.stepKey, stepTitle: data.step.title, stepFingerprint: data.stepFingerprint, baseHash: data.baseHash, context: data.context, website: data.website, cachedSources, previousWork, answers, requestKey: args.requestKey, status: "working", runId, claimed: false, phase: "Checking what we already know…", edits: [], draftRevision: 0, createdAt: now, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.stepWorkActions.prepare, { workId });
  return { workId, reused: false };
} });

export const load = internalQuery({ args: { workId: v.id("planStepWork") }, handler: async (ctx, { workId }) => {
  const work = await ctx.db.get(workId); if (!work || work.status !== "working") return null;
  const run = await ctx.db.get(work.runId), org = await ctx.db.get(work.orgId), plan = await ctx.db.get(work.strategyId);
  const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", work.orgId).eq("userId", work.createdBy)).unique();
  if (!run || !ACTIVE.includes(run.status) || run.orgId !== work.orgId || !org || org.deletedAt || org.emergencyStop?.active || org.suspendedAt || !member || member.status !== "active" || !can(member.role, "edit") || !plan || plan.orgId !== work.orgId) return null;
  const step = planTimeline(plan.expert).find(step => step.key === work.stepKey);
  return step && await hash(step) === work.stepFingerprint ? { work, run } : null;
} });
export const ref = internalQuery({ args: { workId: v.id("planStepWork") }, handler: async (ctx, { workId }) => { const work = await ctx.db.get(workId); return work ? { runId: work.runId, status: work.status } : null; } });
export const claim = internalMutation({ args: { workId: v.id("planStepWork") }, handler: async (ctx, { workId }) => { const work = await ctx.db.get(workId); if (!work || work.claimed || work.status !== "working") return false; await ctx.db.patch(workId, { claimed: true }); return true; } });
export const noteAttempt = internalMutation({ args: { workId: v.id("planStepWork"), candidate: v.string(), notes: v.array(v.string()) }, handler: async (ctx, { workId, candidate, notes }) => { const work = await ctx.db.get(workId); if (work?.status === "working") await ctx.db.patch(workId, { candidate: candidate.slice(0, 100000), validationNotes: notes.map(note => note.slice(0, 1000)).slice(0, 20) }); } });
export const phase = internalMutation({ args: { workId: v.id("planStepWork"), text: v.string() }, handler: async (ctx, { workId, text }) => { const work = await ctx.db.get(workId); if (work?.status === "working") await ctx.db.patch(workId, { phase: text.slice(0, 120), updatedAt: Date.now() }); } });
export const finish = internalMutation({ args: { workId: v.id("planStepWork"), result: v.optional(v.string()), sources: v.optional(v.string()), error: v.optional(v.string()) }, handler: async (ctx, args) => {
  const work = await ctx.db.get(args.workId); if (!work || work.status !== "working") return false;
  const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", work.orgId).eq("userId", work.createdBy)).unique();
  const org = await ctx.db.get(work.orgId), plan = await ctx.db.get(work.strategyId), run = await ctx.db.get(work.runId);
  const step = plan ? planTimeline(plan.expert).find(step => step.key === work.stepKey) : null;
  if (!member || member.status !== "active" || !can(member.role, "edit") || !org || org.deletedAt || org.suspendedAt || org.emergencyStop?.active || !run || run.orgId !== work.orgId || !ACTIVE.includes(run.status) || !step || await hash(step) !== work.stepFingerprint) { await ctx.db.patch(work._id, { status: "failed", phase: undefined, error: "This step changed or access was removed.", updatedAt: Date.now() }); return false; }
  const result = args.result ? normalizeStepWork(StepWorkOutput.parse(JSON.parse(args.result))) : null;
  const sources = JSON.parse(args.sources ?? "[]") as StepSource[];
  if (!Array.isArray(sources) || sources.length > 12 || sources.some(source => !validateResearchUrl(source.url).ok || typeof source.text !== "string" || source.text.length > 12000)) throw appError("INVALID", "Research exceeded its source bounds.");
  if (result && validateStepWork(result, sources, work.context).length) throw appError("INVALID", "Prepared work failed its source checks.");
  await ctx.db.patch(work._id, { status: result ? result.ownerQuestion ? "needs_input" : "ready" : "failed", result: result ? JSON.stringify({ ...result, summary: shortOwnerReply(result.summary), ownerQuestion: result.ownerQuestion ? { ...result.ownerQuestion, text: shortOwnerReply(result.ownerQuestion.text) } : null }) : undefined, sources: args.sources, phase: undefined, error: args.error?.slice(0, 400), updatedAt: Date.now() });
  return true;
} });

export const saveDraft = mutation({ args: { slug: v.string(), workId: v.id("planStepWork"), index: v.number(), expectedRevision: v.number(), body: v.string() }, handler: async (ctx, args) => {
  const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
  const work = assertSameOrg(await ctx.db.get(args.workId), org._id, "prepared work");
  const result = work.result ? StepWorkOutput.parse(JSON.parse(work.result)) : null;
  if (!Number.isInteger(args.index) || !result?.drafts[args.index] || !args.body.trim() || args.body.length > 20000) throw appError("INVALID", "Choose a prepared draft and keep it under 20,000 characters.");
  if (work.draftRevision !== args.expectedRevision) throw appError("INVALID", "A newer edit was saved. Reopen this draft before saving your changes.");
  const revision = work.draftRevision + 1;
  await ctx.db.patch(work._id, { edits: [...work.edits.filter(edit => edit.index !== args.index), { index: args.index, body: args.body }], draftRevision: revision, updatedAt: Date.now() });
  await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "step_work.draft_saved", subjectType: "planStepWork", subjectId: work._id, summary: "Saved a private step draft edit; nothing published or marked done." });
  return { revision };
} });
