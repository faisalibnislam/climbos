import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canonicalJson, sha256Hex } from "../../shared/policy";
import { factFreshness } from "../../shared/agents/factFreshness";
import type { BusinessModelEvidence } from "../../shared/agents/businessModelFreshness";
import { focusedGoal } from "./goals";

interface Inputs {
  org: Doc<"organizations">; business: Doc<"businesses"> | null; facts: Doc<"businessFacts">[];
  brand: Doc<"brandProfiles"> | null; goal: Doc<"goals"> | null;
  revenueRows: Doc<"revenueEvents">[]; pipelineDeals: Doc<"deals">[]; marketChanges: Doc<"competitorChanges">[];
}

/** Hash the same bounded workspace evidence used by the check; never store raw billing/customer data in the run. */
export async function businessModelEvidenceHashes(input: Inputs, now: number): Promise<BusinessModelEvidence["hashes"]> {
  const { org, business: b, brand, goal } = input;
  const sorted = <T extends { _id: string }>(rows: T[]) => [...rows].sort((a, b) => a._id.localeCompare(b._id));
  const material = {
    workspace: { id: org._id, name: org.name, currency: org.currency, timezone: org.timezone, contentLanguage: org.contentLanguage },
    business: b ? { id: b._id, name: b.name, summary: b.summary, discoveryBrief: b.discoveryBrief, industryBusinessTypeId: b.industryBusinessTypeId, website: b.website, socialUrls: b.socialUrls, businessType: b.businessType, currency: b.currency, timezone: b.timezone, lifecycleStage: b.lifecycleStage, funnel: b.funnel, acquisition: b.acquisition, unitEconomics: b.unitEconomics, customerData: b.customerData, insights: b.insights } : null,
    facts: sorted(input.facts.filter(f => f.reviewState === "confirmed" || f.reviewState === "edited")).map(f => ({ id: f._id, statement: f.statement, category: f.category, confidence: f.confidence, provenance: f.provenance, verifiedAt: f.verifiedAt ?? f.updatedAt, updatedAt: f.updatedAt, reviewSuggested: factFreshness(f.category, f.updatedAt, now, f.verifiedAt ?? f.updatedAt).reviewSuggested })),
    brand: brand ? { voice: brand.voice, toneWords: brand.toneWords, colors: brand.colors, doNots: brand.doNots, approvedExamples: brand.approvedExamples, learnedRules: brand.learnedRules, socialHumor: brand.socialHumor, socialTrendPolicy: brand.socialTrendPolicy } : null,
    goal: goal ? { id: goal._id, kind: goal.kind, kinds: goal.kinds, statement: goal.statement, horizonDays: goal.horizonDays, deadline: goal.deadline, monthlyAdBudgetMinor: goal.monthlyAdBudgetMinor, currency: goal.currency, target: goal.target, priorCycleReview: goal.priorCycleReview } : null,
    billing: { partial: input.revenueRows.length > 10_000, rows: sorted(input.revenueRows.filter(r => !r.isFixture)).map(({ _creationTime: _c, ingestedAt: _at, ...row }) => row) },
    pipeline: { partial: input.pipelineDeals.length > 2_000, rows: sorted(input.pipelineDeals).map(({ _creationTime: _c, ...row }) => row) },
    competitors: sorted(input.marketChanges).map(({ _creationTime: _c, ...row }) => row),
  };
  const entries = await Promise.all(Object.entries(material).map(async ([key, value]) => [key, await sha256Hex(canonicalJson(value))] as const));
  return Object.fromEntries(entries) as BusinessModelEvidence["hashes"];
}

/** Owner review uses the same query bounds as jobContext. Reads only; no provider/model calls. */
export async function currentBusinessModelEvidence(ctx: QueryCtx, org: Doc<"organizations">, now: number) {
  const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
  const [facts, brand, goal, revenueRows, pipelineDeals, marketChanges] = await Promise.all([
    business ? ctx.db.query("businessFacts").withIndex("by_business", q => q.eq("businessId", business._id)).take(200) : [],
    business ? ctx.db.query("brandProfiles").withIndex("by_business", q => q.eq("businessId", business._id)).first() : null,
    focusedGoal(ctx, org),
    ctx.db.query("revenueEvents").withIndex("by_org_occurred", q => q.eq("orgId", org._id).lte("occurredAt", now)).order("desc").take(10_001),
    ctx.db.query("deals").withIndex("by_org_updated", q => q.eq("orgId", org._id)).order("desc").take(2_001),
    ctx.db.query("competitorChanges").withIndex("by_org_at", q => q.eq("orgId", org._id)).order("desc").take(8),
  ]);
  return businessModelEvidenceHashes({ org, business, facts, brand, goal, revenueRows, pipelineDeals, marketChanges }, now);
}
