import { lintRefusedOutreach } from "../shared/agents/contactPolicy";
import { validateResearchUrl } from "../shared/integrations/website";
import { sha256Hex } from "../shared/policy";
import { audit } from "./lib/audit";
import { ensureAccountForOwner } from "./lib/accounts";
import { createOnboardingPeriod } from "./lib/periods";
/** Local evaluation import only. No provider calls, synthetic business rows or external writes. */
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { StrategyV2Schema, PlaysOutputSchema, FocusedStrategySchema } from "../shared/agents/specs";
import { withForecasts } from "../shared/agents/economics";
import { agentQuality, planQuality } from "../shared/agents/quality";
import { buildPlanEvidence } from "../shared/agents/evidence";
import { BUILT_IN_ROUTE } from "../shared/ai/modelChoice";
import { currentRateVersion } from "../shared/economics";
import type { Id } from "./_generated/dataModel";
import type { Assessment } from "../shared/agents/types";

export function requireLocalResearch(env: Record<string, string | undefined> = process.env) {
  if (env.CLIMBOS_LOCAL_REAL_RESEARCH !== "true" || env.SITE_URL !== "http://127.0.0.1:3430" || env.CLIMBOS_FAKE_LLM) throw new Error("Real-research import is available only on the dedicated loopback workspace.");
}

/** Removes the commercial workspace-count restriction for this authorized local evaluation owner. */
export const enableWorkspaceTesting = internalMutation({
  args: { ownerEmail: v.string() },
  handler: async (ctx, { ownerEmail }) => {
    requireLocalResearch();
    const owner = await ctx.db.query("users").filter(q => q.eq(q.field("email"), ownerEmail)).first();
    if (!owner || owner.isAnonymous) throw new Error("Sign in as the local evaluation owner first.");
    const account = await ctx.db.query("accounts").withIndex("by_owner", q => q.eq("ownerUserId", owner._id)).first();
    if (!account) throw new Error("Local evaluation account missing.");
    const period = await ctx.db.query("usagePeriods").withIndex("by_account_period", q => q.eq("accountId", account._id).eq("periodKey", "onboarding")).first();
    if (!period || (period.walletCapMicros !== 6_000_000 && !account.localWorkspaceTesting)) throw new Error("The existing owner-authorized local AI allowance is required; this operation does not create or increase it.");
    const workspace = await ctx.db.query("organizations").withIndex("by_account", q => q.eq("accountId", account._id)).first();
    if (!workspace) throw new Error("Create the local evaluation workspace first.");
    await ctx.db.patch(account._id, { localWorkspaceTesting: true });
    await audit(ctx, { orgId: workspace._id, actorType: "operator", actorId: owner._id, action: "local_testing.workspaces_enabled", summary: "Removed the business-count restriction for this local evaluation owner. No subscription, credits, provider keys, or external permissions changed." });
    return { enabled: true, aiBudgetChanged: false };
  },
});

export const prepare = internalMutation({
  args: { ownerEmail: v.string(), name: v.string(), website: v.string(), acquisitionType: v.string(), key: v.string(), horizonDays: v.number(), input: v.string(), costMicros: v.number(), phases: v.string(), summary: v.string() },
  handler: async (ctx, args) => {
    requireLocalResearch();
    const approvedSites: Record<string, string> = { Macloving: "https://macloving.app/", Livoform: "https://livoform.com/", Folevi: "https://folevi.com/" };
    if (approvedSites[args.name] !== args.website) throw new Error("Only the three owner-requested public businesses may be imported here.");
    if (![14, 30, 90].includes(args.horizonDays) || !Number.isSafeInteger(args.costMicros) || args.costMicros < 0 || args.costMicros > 100_000_000) throw new Error("Invalid research import bounds.");
    const owner = await ctx.db.query("users").filter((q) => q.eq(q.field("email"), args.ownerEmail)).first();
    if (!owner) throw new Error("Sign in to the local app before importing real research.");
    if (!["desktop_app", "b2b_saas"].includes(args.acquisitionType)) throw new Error("Invalid local research classification.");
    const accountId = await ensureAccountForOwner(ctx, owner, "Local real-business evaluation");
    const slug = `real-${args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    let org = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    const now = Date.now();
    if (!org) {
      const id = await ctx.db.insert("organizations", { name: args.name, slug, kind: "customer", accountId, createdBy: owner._id, timezone: "UTC", currency: "USD", onboardingStep: "done", scheduledSpecialistsEnabled: false, competitorWatchEnabled: false, competitorResearchRefreshDays: 0, createdAt: now });
      org = await ctx.db.get(id);
      await ctx.db.insert("memberships", { orgId: id, userId: owner._id, role: "owner", status: "active", createdAt: now });
      await ctx.db.insert("businesses", { orgId: id, name: args.name, website: args.website, socialUrls: [], businessType: args.acquisitionType === "desktop_app" ? "other" : "saas", acquisition: { types: [args.acquisitionType], typesSource: "inferred", dims: {}, updatedAt: now }, summary: args.summary, currency: "USD", timezone: "UTC", researchStatus: "partial", successEvents: [], createdAt: now, updatedAt: now });
    }
    if (!org || org.kind !== "customer" || org.createdBy !== owner._id) throw new Error("The import destination does not belong to this local owner.");
    if (!org.accountId) await ctx.db.patch(org._id, { accountId });
    await createOnboardingPeriod(ctx, org._id, accountId);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw new Error("Missing real business.");
    if (!business.acquisition || business.acquisition.typesSource === "inferred") await ctx.db.patch(business._id, { businessType: args.acquisitionType === "desktop_app" ? "other" : "saas", acquisition: { ...(business.acquisition ?? { dims: {} }), types: [args.acquisitionType], typesSource: "inferred", updatedAt: now } });
    let goal = await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active")).first();
    if (goal && goal.horizonDays !== args.horizonDays) {
      if (goal.previousGoalId || goal.statement !== "Find a useful, repeatable way to earn more paying customers") throw new Error("The owner changed the cycle; import a matching plan instead of overwriting it.");
      const {_id,_creationTime: _creation,cycleReview: _review,cycleClosedAt: _closed,cycleClosure: _closure,...base} = goal;
      await ctx.db.patch(_id,{status:"archived",cycleClosedAt:now,cycleClosure:"length_changed"});
      const goalId=await ctx.db.insert("goals",{...base,previousGoalId:_id,horizonDays:args.horizonDays,status:"active",createdAt:now,cycleStartedAt:now});
      goal=await ctx.db.get(goalId);
    }
    if (!goal) await ctx.db.insert("goals", { orgId: org._id, businessId: business._id, kind: "more_customers", statement: "Find a useful, repeatable way to earn more paying customers", horizonDays: args.horizonDays, monthlyAdBudgetMinor: 0, currency: "USD", status: "active", cycleStartedAt: now, createdBy: owner._id, createdAt: now });
    const priorRun = (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(100)).find((r) => r.input === args.input);
    if (priorRun) {
      const saved = (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", org._id)).order("desc").take(100)).find((s) => s.runId === priorRun._id);
      return { runId: priorRun._id, strategyId: saved?.goalId === goal?._id ? saved?._id ?? null : null, slug };
    }
    const phases = JSON.parse(args.phases) as { label: string; model: string; costMicros: number; status: string }[];
    const runId = await ctx.db.insert("workflowRuns", { orgId: org._id, kind: "strategy", engine: "v2", title: `${args.horizonDays}-day plan for ${args.name}`, status: "verified", input: args.input, roles: ["ceo", "cmo"], estimateMicros: args.costMicros, actualMicros: args.costMicros, providerMicros: args.costMicros, rateVersionId: currentRateVersion().id, entitlementVersionId: "local-owner-authorized-ai-evaluation", routingVersionId: BUILT_IN_ROUTE.policy!, modelRoute: BUILT_IN_ROUTE, budget: { modelSteps: phases.length, researchTools: 0, repairs: 0 }, used: { modelSteps: phases.length, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner._id, createdAt: now, updatedAt: now, finishedAt: now });
    for (const [index, phase] of phases.entries()) await ctx.db.insert("workflowSteps", { orgId: org._id, runId, index, kind: "model", role: "cmo", label: phase.label, status: phase.status === "completed" ? "succeeded" : "uncertain", idempotencyKey: `${args.key}:${index}`, attempt: 1, provider: "anthropic", model: phase.model, costMicros: phase.costMicros, startedAt: now, finishedAt: now });
    return { runId, strategyId: null, slug };
  },
});

export const importPlan = internalAction({
  args: { payload: v.string() },
  handler: async (ctx, { payload }): Promise<{ slug: string; strategyId: Id<"strategies">; runId: Id<"workflowRuns"> }> => {
    requireLocalResearch();
    if (payload.length > 850_000) throw new Error("Research import too large.");
    const data = JSON.parse(payload);
    const plan = StrategyV2Schema.parse(data.plan);
    const plays = PlaysOutputSchema.parse(data.plays);
    if (!Array.isArray(data.sources) || data.sources.some((s: { url?: unknown }) => typeof s.url !== "string" || !String(s.url).startsWith("https://"))) throw new Error("Public source index required.");
    const prepared = await ctx.runMutation(internal.localResearch.prepare, { ownerEmail: data.ownerEmail, name: data.name, website: data.website, acquisitionType: data.acquisitionType, key: data.key, horizonDays: data.horizonDays, input: JSON.stringify({ localResearchKey: data.key, horizonDays: data.horizonDays, sourceHash: data.sourceHash }), costMicros: data.costMicros, phases: JSON.stringify(data.phases), summary: `Public website research for ${data.name}; published product claims have not been independently tested. Performance, customer demand, owner time and marketing budget are unknown. USD is the evaluation display currency. No ad spending is authorized.` });
    if (prepared.strategyId) return { ...prepared, strategyId: prepared.strategyId };
    const quality = planQuality([
      agentQuality("growth_plays", data.playsAssessment as Assessment | null, data.playsRounds ?? 1, data.sources.length),
      agentQuality("growth_strategy", data.planAssessment as Assessment | null, data.planRounds ?? 1, data.sources.length),
    ], [], { economicsMissing: true, unknowns: ["Actual customer demand and conversion", "Owner time and marketing budget", "Contribution margin and retention"] });
    const forecast = withForecasts({ ...plays, economics: { ...plays.economics, currency: "USD" } });
    const evidence = buildPlanEvidence({ skillIds: ["growth-plays", "growth-strategy"], models: { route: BUILT_IN_ROUTE }, currency: "USD", goal: { statement: "Find a repeatable way to earn paying customers", horizonDays: data.horizonDays, monthlyAdBudget: 0 }, facts: [], insights: data.brief ?? "Public-source research only; no customer results supplied.", research: [{ agentId: "growth_plays", notes: data.researchNotes, sources: data.sources }] });
    const strategyId = await ctx.runMutation(internal.jobWrites.saveStrategy, { runId: prepared.runId, factIds: [], evidence: JSON.stringify(evidence), strategy: JSON.stringify({ ...plan, plays: forecast.plays, economics: forecast.economics, preparedWork: plays.preparedWork, strategyExploration: plays.strategyExploration, strategicDirection: plays.strategicDirection, webSources: data.sources, quality }) });
    if (!strategyId) throw new Error("The real plan was not saved.");
    return { slug: prepared.slug, runId: prepared.runId, strategyId };
  },
});

/** This is an owner-authorized development budget, not a fabricated subscription or business metric. */
export const setEvaluationBudget = internalMutation({
  args: { ownerEmail: v.string(), allocationMicros: v.number() },
  handler: async (ctx, { ownerEmail, allocationMicros }) => {
    requireLocalResearch();
    if (allocationMicros !== 10_000_000) throw new Error("This local allocation is capped at the reserved $10.");
    const owner = await ctx.db.query("users").filter((q) => q.eq(q.field("email"), ownerEmail)).first();
    if (!owner) throw new Error("Local owner missing.");
    const accountId = await ensureAccountForOwner(ctx, owner, "Local real-business evaluation");
    const orgs = await ctx.db.query("organizations").withIndex("by_account", (q) => q.eq("accountId", accountId)).take(10);
    const org = orgs.find((o) => o.slug.startsWith("real-") && o.kind === "customer");
    if (!org || orgs.some((o) => !o.slug.startsWith("real-") || o.kind !== "customer")) throw new Error("Budget must belong only to the local real-research workspaces.");
    const periodId = await createOnboardingPeriod(ctx, org._id, accountId);
    const period = await ctx.db.get(periodId);
    // Keep headroom for the engine’s bounded per-run overage; the outer ledger holds the full $10.
    const walletCeilingMicros = 6_000_000;
    if (period && period.walletCapMicros > walletCeilingMicros) throw new Error("A larger evaluation allowance is already active; use the cumulative budget extension script.");
    if (!period || period.walletSpentMicros + period.walletReservedMicros > walletCeilingMicros) throw new Error("Allocation is below existing committed usage.");
    // Set a fixed lifetime ceiling. Repeating this call never replenishes spent credits.
    await ctx.db.patch(periodId, { walletCapMicros: walletCeilingMicros });
    if (period.walletCapMicros !== walletCeilingMicros) await audit(ctx, { orgId: org._id, actorType: "operator", actorId: owner._id, action: "local_research.budget_allocated", summary: "Reserved $10 inside the owner-authorized AI evaluation budget; local account credit ceiling $6 with overage headroom. No subscription or business performance data created." });
    return { allocatedMicros: allocationMicros, ceilingMicros: walletCeilingMicros, spentMicros: period.walletSpentMicros, reservedMicros: period.walletReservedMicros, workspaces: orgs.map((o) => o.slug) };
  },
});

/** Operator-only, loopback-only extension after the cumulative ledger reserves the funds. */
export const increaseEvaluationBudget = internalMutation({
  args: { ownerEmail: v.string(), allocationMicros: v.number(), authorization: v.string() },
  handler: async (ctx, { ownerEmail, allocationMicros, authorization }) => {
    requireLocalResearch();
    if (!Number.isSafeInteger(allocationMicros) || allocationMicros < 10_000_000 || allocationMicros > 100_000_000 || allocationMicros % 1_000_000 !== 0 || authorization !== `local-convex-total-${allocationMicros}`) throw new Error("Invalid cumulative evaluation allocation.");
    const owner = await ctx.db.query("users").filter(q => q.eq(q.field("email"), ownerEmail)).first();
    if (!owner || owner.isAnonymous) throw new Error("Local evaluation owner missing.");
    const account = await ctx.db.query("accounts").withIndex("by_owner", q => q.eq("ownerUserId", owner._id)).first();
    if (!account?.localWorkspaceTesting) throw new Error("Existing owner-authorized local evaluation account required.");
    const org = await ctx.db.query("organizations").withIndex("by_account", q => q.eq("accountId", account._id)).first();
    const period = await ctx.db.query("usagePeriods").withIndex("by_account_period", q => q.eq("accountId", account._id).eq("periodKey", "onboarding")).first();
    if (!org || !period) throw new Error("Existing local evaluation wallet missing.");
    const ceilingMicros = allocationMicros * 3 / 5;
    if (ceilingMicros < period.walletCapMicros || ceilingMicros < period.walletSpentMicros + period.walletReservedMicros) throw new Error("Cannot reduce existing evaluation commitments.");
    if (ceilingMicros > period.walletCapMicros) {
      await ctx.db.patch(period._id, { walletCapMicros: ceilingMicros });
      await audit(ctx, { orgId: org._id, actorType: "operator", actorId: owner._id, action: "local_research.budget_extended", summary: `Owner authorized continued AI quality work: ${authorization}. Cumulative local allocation ${allocationMicros}; wallet ceiling ${ceilingMicros}. Existing usage and holds preserved. No subscription or publishing permission changed.` });
    }
    return { allocatedMicros: allocationMicros, ceilingMicros, spentMicros: period.walletSpentMicros, reservedMicros: period.walletReservedMicros };
  },
});

/** Append a verified public-source correction locally; keep earlier AI drafts and charges. */
export const recordResearchUpdate = internalMutation({
  args: { ownerEmail: v.string(), slug: v.string(), website: v.optional(v.string()), notes: v.string(), sources: v.array(v.object({ url: v.string(), title: v.optional(v.string()), productPitchPolicy: v.optional(v.object({ status: v.literal("refused"), evidence: v.string() })) })) },
  handler: async (ctx, args) => {
    requireLocalResearch();
    if (args.notes.length > 30000 || !args.sources.length || args.sources.length > 50 || args.sources.some(source => !validateResearchUrl(source.url).ok)) throw new Error("Invalid local public-research correction.");
    const owner = await ctx.db.query("users").filter(q => q.eq(q.field("email"), args.ownerEmail)).first();
    const org = await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", args.slug)).unique();
    if (!owner || !org || org.createdBy !== owner._id || org.kind !== "customer") throw new Error("The local research destination does not belong to this owner.");
    const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
    const expectedSite: Record<string, string> = { "real-macloving": "https://macloving.app/", "real-livoform": "https://livoform.com/", "real-folevi": "https://folevi.com/" };
    if (!expectedSite[args.slug]) {
      const account = await ctx.db.query("accounts").withIndex("by_owner", q => q.eq("ownerUserId", owner._id)).first();
      if (!account?.localWorkspaceTesting || org.accountId !== account._id) throw new Error("An authorized local evaluation workspace is required.");
    }
    if (!business?.website || business.website !== (args.website ?? expectedSite[args.slug]) || !validateResearchUrl(business.website).ok) throw new Error("The research no longer matches this business website.");
    const cacheKey = await sha256Hex(JSON.stringify({ website: business.website, notes: args.notes, sources: args.sources }));
    const prior = await ctx.db.query("researchCache").withIndex("by_org_key", q => q.eq("orgId", org._id).eq("cacheKey", cacheKey)).first();
    if (!prior) await ctx.db.insert("researchCache", { orgId: org._id, businessWebsite: business.website, cacheKey, agentId: "growth_strategy", modelKey: "public-source-review", notes: args.notes, sources: args.sources, createdAt: Date.now(), retrievedAt: Date.now(), expiresAt: Date.now() + 6 * 3600000 });
    const corrected = [];
    for (const plan of await ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", org._id)).order("desc").take(50)) {
      if (!plan.expert) continue;
      const issues = lintRefusedOutreach(plan.expert.preparedWork, { task: "Recheck retrieved contact policy", brief: "New first-party source evidence, not business performance or execution permission.", facts: [], precomputedResearch: { notes: args.notes, sources: args.sources } });
      if (!issues.length || plan.expert.quality?.fixes?.some(fix => fix.rule === "contact_policy")) continue;
      const previous = plan.expert.quality ?? planQuality([]);
      const reviewed = planQuality(previous.agents, issues, { unknowns: previous.unknowns, conflicts: previous.conflicts });
      await ctx.db.patch(plan._id, { expert: { ...plan.expert, quality: { ...reviewed, state: "failed", reasons: [...new Set([...previous.reasons, ...reviewed.reasons])], hard: [...new Set([...previous.hard, ...reviewed.hard])], fixes: [...(previous.fixes ?? []), ...(reviewed.fixes ?? [])].slice(0, 20) } } });
      corrected.push(plan._id);
    }
    if (!prior || corrected.length) await audit(ctx, { orgId: org._id, actorType: "operator", actorId: owner._id, action: "local_research.source_corrected", summary: `Saved inspected public-source research. ${corrected.length} earlier draft(s) blocked by an explicit outreach refusal; original text and paid receipts retained.` });
    return { reused: Boolean(prior), corrected };
  },
});

/** Import an already-paid real focused result; never generate the same drafts twice. */
export const importFocusedPlan = internalAction({
  args: { payload: v.string() },
  handler: async (ctx, { payload }): Promise<{ slug: string; strategyId: Id<"strategies">; runId: Id<"workflowRuns"> }> => {
    requireLocalResearch();
    if (payload.length > 200000) throw new Error("Focused research import too large.");
    const data = JSON.parse(payload);
    const plan = FocusedStrategySchema.parse(data.plan);
    if (!Array.isArray(data.sources) || data.sources.length > 60 || data.sources.some((source: { url: string }) => !validateResearchUrl(source.url).ok)) throw new Error("A valid public source index is required.");
    const prepared = await ctx.runMutation(internal.localResearch.prepare, { ownerEmail: data.ownerEmail, name: data.name, website: data.website, acquisitionType: data.acquisitionType, key: data.key, horizonDays: data.horizonDays, input: JSON.stringify({ localResearchKey: data.key, planStyle: "focused", sourceHash: data.sourceHash }), costMicros: data.costMicros, phases: JSON.stringify(data.phases), summary: `Public research for ${data.name}. Source-reported claims, not tested capabilities or measured demand. Business economics and owner capacity are unknown.` });
    if (prepared.strategyId) return { ...prepared, strategyId: prepared.strategyId };
    const quality = planQuality([agentQuality("growth_strategy", data.assessment as Assessment | null, data.rounds ?? 1, data.sources.length)], lintRefusedOutreach(plan.preparedWork, { task: "Recheck explicit source restrictions", brief: "Previously paid public-source result", facts: [], precomputedResearch: { notes: data.researchNotes, sources: data.sources } }), { unknowns: ["Actual buyer demand", "Owner capacity", "Contribution and retained customer value"] });
    const evidence = buildPlanEvidence({ skillIds: ["owner-brevity", "focused-growth-strategy"], models: { route: BUILT_IN_ROUTE }, currency: "USD", goal: { statement: "Find a repeatable way to earn paying customers", horizonDays: data.horizonDays, monthlyAdBudget: 0 }, facts: [], insights: data.brief ?? "Public-source research only", research: [{ agentId: "growth_strategy", notes: data.researchNotes, sources: data.sources }] });
    const strategyId = await ctx.runMutation(internal.jobWrites.saveStrategy, { runId: prepared.runId, factIds: [], evidence: JSON.stringify(evidence), strategy: JSON.stringify({ ...plan, quality, webSources: data.sources }) });
    if (!strategyId) throw new Error("The focused plan was not saved.");
    return { slug: prepared.slug, runId: prepared.runId, strategyId };
  },
});
