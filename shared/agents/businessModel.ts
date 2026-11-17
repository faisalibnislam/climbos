import { StrategicLandscapeSchema, STRATEGIC_LANDSCAPE_TASK, emptyStrategicLandscape, lintStrategicLandscape, strategicLandscapeContext } from "./strategicLandscape";
import { referenceEvidenceBasis, type FactEvidenceBasis } from "./evidenceKind";
import type { BusinessModelFreshness } from "./businessModelFreshness";
import { z } from "zod";
import type { LintIssue } from "./types";
import { repeatPurchaseSummary, type CohortPayment } from "../attribution/cohorts";
import { pipelineOutcomes, type PipelineDeal } from "../growth/pipeline";

/**
 * Business model check: is the way this business makes money holding up against its market, and which
 * alternative models are worth a small test? The verdict is the model's labelled judgment (owner decision,
 * 2026-10-25); code supplies first-party signals, checks references, and never acts on the result.
 */

const LEVEL = z.enum(["low", "medium", "high"]);
const PRICING = z.enum(["one_time", "subscription", "usage", "retainer", "commission", "freemium", "mixed", "unknown"]);
const BASIS = z.enum(["owner_report", "measured", "research", "site_claim", "inference"]);

export const BusinessModelCheckSchema = z.object({
  currentModel: z.object({
    summary: z.string().min(8).max(400),
    whoPays: z.string().min(2).max(200),
    whatTheyBuy: z.string().min(2).max(240),
    pricingStructure: PRICING,
    salesMotion: z.enum(["self_serve", "sales_led", "marketplace", "referral", "retail", "mixed", "unknown"]),
    delivery: z.string().min(2).max(240),
    evidenceRefs: z.array(z.string()).max(6),
  }),
  marketSignals: z.array(z.object({
    dimension: z.enum(["demand", "pricing_pressure", "substitutes", "customer_behavior", "distribution", "cost_structure", "regulation_platform", "technology"]),
    direction: z.enum(["headwind", "tailwind", "neutral", "unknown"]),
    finding: z.string().min(8).max(360),
    basis: BASIS,
    evidenceRefs: z.array(z.string()).max(4),
    /** Date the evidence describes (YYYY-MM-DD), when the source states one. */
    observedAt: z.string().max(10).optional(),
    limitation: z.string().min(4).max(240),
  })).max(8),
  verdict: z.object({
    status: z.enum(["model_holding", "watch", "at_risk", "insufficient_evidence"]),
    confidence: LEVEL,
    reasoning: z.string().min(8).max(600),
    whatWouldChangeIt: z.string().min(8).max(300),
  }),
  alternatives: z.array(z.object({
    mode: z.enum(["grounded", "adjacent", "bold"]),
    name: z.string().min(2).max(100),
    modelChange: z.string().min(8).max(400),
    mechanism: z.string().min(8).max(400),
    assetsUsed: z.string().min(4).max(300),
    whoPays: z.string().min(2).max(200),
    pricingStructure: PRICING,
    conventionChallenged: z.string().min(4).max(300),
    evidenceBasis: z.enum(["established_practice", "evidence_supported_inference", "speculative_hypothesis"]),
    evidenceRefs: z.array(z.string()).max(4),
    /** Analogy only; never evidence about the target business. */
    precedentIds: z.array(z.string().regex(/^CP-\d{3}$/)).max(2).optional(),
    assumptions: z.array(z.string().min(1).max(220)).max(6),
    risks: z.array(z.string().min(1).max(220)).max(6),
    unitEconomicsInputs: z.array(z.object({
      input: z.string().min(2).max(100),
      value: z.string().min(1).max(100),
      basis: z.enum(["owner_report", "measured", "research", "assumption", "unknown"]),
      /** Optional when reading historical checks; required by lint for asserted evidence. */
      evidenceRefs: z.array(z.string()).max(4).optional(),
    })).max(6),
    whatPersists: z.string().min(4).max(240),
    smallestTest: z.object({
      test: z.string().min(8).max(400),
      successSignal: z.string().min(4).max(240),
      stopCondition: z.string().min(4).max(240),
      maxCostOrTime: z.string().min(2).max(160),
    }),
    novelty: LEVEL,
    evidenceStrength: LEVEL,
    businessFit: LEVEL,
    feasibility: LEVEL,
    risk: LEVEL,
  })).length(3),
  recommendation: z.object({
    decision: z.enum(["persist", "adjust", "test_a_pivot", "insufficient_evidence"]),
    rationale: z.string().min(8).max(500),
    decidingTest: z.string().min(8).max(400),
    recommendedAlternative: z.enum(["grounded", "adjacent", "bold"]).optional(),
  }),
  /** Spec §4.1: fit of up to three customer segments, each dimension with its own basis. Optional for checks saved before 2026-10-26. */
  segmentFit: z.array(z.object({
    segment: z.string().min(2).max(160),
    dimensions: z.array(z.object({
      dimension: z.enum(["problem_severity", "willingness_to_pay", "reachability", "serviceability"]),
      level: z.enum(["low", "medium", "high", "unknown"]),
      basis: BASIS,
      evidenceRefs: z.array(z.string()).max(4),
      note: z.string().min(4).max(240),
    })).length(4),
  })).max(3).optional(),
  strategicLandscape: StrategicLandscapeSchema.optional(),
  unknowns: z.array(z.string().min(1).max(240)).max(8),
});
/** New generation requires coverage; historical saved reports remain readable. */
export const BusinessModelGenerationSchema = BusinessModelCheckSchema.extend({ strategicLandscape: StrategicLandscapeSchema });
export type BusinessModelCheck = z.infer<typeof BusinessModelCheckSchema>;

export const BUSINESS_MODEL_TASK = `BUSINESS MODEL CHECK: Describe how this business currently makes money (who pays, for what, pricing structure, sales motion, delivery) using only supplied facts and pages read in this run. Then judge whether that model is holding up against how its market is moving: list market signals (demand, pricing pressure, substitutes, customer behavior, distribution, cost structure, platform or regulatory change, technology), each with direction, basis, references, the date the evidence describes (observedAt, YYYY-MM-DD), and its limitation. A research signal with no stated date must say "undated" in its limitation. Rate up to three customer segments in segmentFit, each once on problem severity, willingness to pay, reachability and serviceability, with level (low, medium, high or unknown), basis and references; high willingness to pay needs payment or pricing evidence. Use the FIRST-PARTY MODEL SIGNALS block as calculated observations from the specified records; preserve every coverage limit, unknown and owner-report label. Do not turn incomplete imports, heuristic flags or competitor activity into proof of business decline. Never contradict or recompute the supplied arithmetic. Give a verdict (holding, watch, at risk, or insufficient evidence) with your confidence, reasoning, and what would change it; it is shown to the owner as your judgment. Match every market-signal, segment-fit and economic-input evidence label to the recorded source class of every cited reference. An owner report about analytics is still owner_report; a published source is research or site_claim, never measured. Split differently sourced observations or label their interpretation inference. Missing provenance stays unknown. A website, competitor activity, or a trend article alone does not prove a model is outdated, and an absence of data is not decline. Propose exactly three alternative business models: one grounded (established practice), one adjacent (an evidence-supported stretch), one bold (may lack any precedent; do not drop it for being novel, low-evidence, or not yet executable). For each: the model change, mechanism, existing assets it reuses, who pays and how, the convention it challenges, assumptions, risks, unit-economics inputs (state each as owner-reported, measured, research, assumption, or unknown; never invent a figure; owner_report, measured and research inputs must cite evidenceRefs for their specific input, not just the overall alternative), what stays the same, and the smallest reversible test with success signal, stop condition, and maximum cost or time. Keep novelty, evidence strength, fit, feasibility, and risk separate. Finish with persist, adjust, test a pivot, or insufficient evidence, the single test that would decide it, and the recommended alternative when testing a pivot. Nothing here authorizes changing prices, offers, or operations.\n\n${STRATEGIC_LANDSCAPE_TASK}`;

const REF = /^fact:(\d+)$/i;
const citeKey = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // A fragment locates text on the same page; path/query case and scheme can identify different pages.
    url.hash = "";
    return url.href;
  } catch { return null; }
};

function realEvidenceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Structural and evidence integrity; the verdict itself is the model's labelled judgment and is not gated. */
export function lintBusinessModelCheck(out: BusinessModelCheck, ctx: { factCount: number; readUrls: string[]; factEvidenceBases?: readonly FactEvidenceBasis[]; precedentIds?: string[] }): LintIssue[] {
  const issues: LintIssue[] = [];
  const read = new Set(ctx.readUrls.map(citeKey).filter((key): key is string => key !== null));
  const checkRefs = (refs: string[], path: string) => {
    for (const ref of refs) {
      const fact = REF.exec(ref.trim());
      const url = citeKey(ref);
      const ok = fact ? Number(fact[1]) < ctx.factCount : url !== null && read.has(url);
      if (!ok) issues.push({ severity: "error", rule: "citation", message: `"${ref.slice(0, 80)}" isn't a supplied fact (fact:0–${Math.max(0, ctx.factCount - 1)}) or a page read in this run.`, path });
    }
  };
  const checkBasis = (basis: string, refs: string[], path: string, basisField = "basis", refsField = "evidenceRefs") => {
    if (["inference", "assumption", "unknown"].includes(basis)) return;
    if (!refs.length) {
      issues.push({ severity: "error", rule: "citation", message: `A ${basis.replace("_", " ")} finding needs its own supplied evidence reference. Otherwise keep the input unknown or label the interpretation as inference.`, path: `${path}.${refsField}` });
      return;
    }
    const expected: FactEvidenceBasis = basis === "owner_report" ? "owner_reported" : basis === "measured" ? "measured" : "source_reported";
    if (refs.some(ref => {
      const fact = REF.exec(ref.trim());
      const reference = fact ? `fact:${fact[1]}` : citeKey(ref);
      return referenceEvidenceBasis(reference, ctx.factEvidenceBases, [...read]) !== expected;
    })) issues.push({ severity: "error", rule: "evidence_basis", message: "Match the evidence label to every cited source's recorded provenance. An owner report or published claim is not independently measured evidence; missing provenance stays unknown. Split differently sourced findings or label an interpretation as inference.", path: `${path}.${basisField}` });
  };
  if (out.strategicLandscape) {
    checkRefs(out.strategicLandscape.scopeEvidenceRefs, "strategicLandscape.scopeEvidenceRefs");
    checkBasis(out.strategicLandscape.scopeBasis, out.strategicLandscape.scopeEvidenceRefs, "strategicLandscape", "scopeBasis", "scopeEvidenceRefs");
    issues.push(...lintStrategicLandscape(out.strategicLandscape, out.marketSignals));
  }
  checkRefs(out.currentModel.evidenceRefs, "currentModel.evidenceRefs");
  out.marketSignals.forEach((s, i) => {
    checkRefs(s.evidenceRefs, `marketSignals[${i}].evidenceRefs`);
    checkBasis(s.basis, s.evidenceRefs, `marketSignals[${i}]`);
    if (s.basis === "research" && !s.observedAt && !/\b(?:undated|no (?:stated |publication )?date|not dated|date (?:is )?unknown)\b/i.test(s.limitation)) issues.push({ severity: "error", rule: "market_signal_date", message: "A research signal needs the date its evidence describes, or a limitation that says it is undated.", path: `marketSignals[${i}].observedAt` });
    if (s.observedAt !== undefined && !realEvidenceDate(s.observedAt)) issues.push({ severity: "error", rule: "market_signal_date", message: "Use a real calendar date in YYYY-MM-DD form for the evidence date, or leave it out and explain that it is undated.", path: `marketSignals[${i}].observedAt` });
  });
  (out.segmentFit ?? []).forEach((seg, i) => {
    const dims = seg.dimensions.map((d) => d.dimension).sort().join(",");
    if (dims !== "problem_severity,reachability,serviceability,willingness_to_pay") issues.push({ severity: "error", rule: "segment_fit", message: `Rate "${seg.segment}" once each on problem severity, willingness to pay, reachability and serviceability.`, path: `segmentFit[${i}].dimensions` });
    seg.dimensions.forEach((d, j) => {
      const path = `segmentFit[${i}].dimensions[${j}]`;
      checkRefs(d.evidenceRefs, `${path}.evidenceRefs`);
      checkBasis(d.basis, d.evidenceRefs, path);
      if (d.dimension === "willingness_to_pay" && d.level === "high" && d.basis === "inference") issues.push({ severity: "error", rule: "segment_fit", message: "High willingness to pay needs evidence of payment or pricing, not inference. Use unknown or a lower level.", path: `${path}.level` });
    });
  });
  const modes = out.alternatives.map((a) => a.mode).sort().join(",");
  if (modes !== "adjacent,bold,grounded") issues.push({ severity: "error", rule: "business_model", message: "Give exactly one grounded, one adjacent and one bold alternative.", path: "alternatives" });
  out.alternatives.forEach((a, i) => {
    for (const id of a.precedentIds ?? []) if (!ctx.precedentIds?.includes(id)) issues.push({ severity: "error", rule: "citation", message: `Precedent ${id} was not retrieved for this check. Remove it or use a supplied case as an analogy only.`, path: `alternatives[${i}].precedentIds` });
    checkRefs(a.evidenceRefs, `alternatives[${i}].evidenceRefs`);
    if (a.evidenceBasis !== "speculative_hypothesis" && a.mode !== "bold" && !a.evidenceRefs.length) issues.push({ severity: "warn", rule: "business_model", message: `"${a.name}" claims ${a.evidenceBasis.replace(/_/g, " ")} without a reference.`, path: `alternatives[${i}].evidenceRefs` });
    a.unitEconomicsInputs.forEach((u, j) => {
      const path = `alternatives[${i}].unitEconomicsInputs[${j}]`;
      checkRefs(u.evidenceRefs ?? [], `${path}.evidenceRefs`);
      checkBasis(u.basis, u.evidenceRefs ?? [], path);
      if (u.basis === "unknown" && /\d/.test(u.value)) issues.push({ severity: "error", rule: "invented_fact", message: `"${u.input}" is marked unknown but gives a number.`, path: `alternatives[${i}].unitEconomicsInputs[${j}].value` });
    });
  });
  if (out.recommendation.decision === "test_a_pivot" && !out.recommendation.recommendedAlternative) issues.push({ severity: "error", rule: "business_model", message: "Name which alternative to test when recommending a pivot test.", path: "recommendation.recommendedAlternative" });
  return issues;
}

export interface OwnerModelSignal {
  key: "revenue_trend" | "repeat_purchase" | "win_rate" | "loss_reasons" | "lifecycle_stage" | "competitor_changes";
  label: string;
  direction: "headwind" | "tailwind" | "neutral" | "unknown";
  basis: "calculated" | "owner_report";
  detail: string;
}

const DAY = 86_400_000;

/**
 * First-party signals computed in code for the check (stated thresholds; unknown when data is thin).
 * Revenue: net same-currency revenue, last 90 days vs the 90 before (±15% is a direction, not a cause).
 */
export function ownerModelSignals(input: {
  nowMs: number;
  currency: string | null;
  revenueEvents: readonly CohortPayment[];
  deals: readonly PipelineDeal[];
  lifecycleStage?: string | null;
  competitorChanges90d: number;
  /** True when bounded reads omitted records; not evidence of business decline. */
  revenuePartial?: boolean;
  /** The descending read reached earlier than both comparison periods; does not verify import completeness. */
  revenueReadCoversComparison?: boolean;
  pipelinePartial?: boolean;
  competitorChangesPartial?: boolean;
}): OwnerModelSignal[] {
  const out: OwnerModelSignal[] = [];
  const billingCoverage = "Imported records do not verify coverage of every account or period; this is not a full-business diagnosis.";
  const pipelineCoverage = input.pipelinePartial ? " Only the 2,000 most recently updated deals were loaded; totals and proportions are partial." : " Owner-recorded stages are not independently verified sales results.";
  const revenueEvents: CohortPayment[] = [];
  let billingIssue: string | null = null;
  const identities = new Map<string, { signature: string; currency: string }>();
  for (const event of input.revenueEvents) {
    if (!Number.isSafeInteger(event.occurredAt) || event.occurredAt < 0 || event.occurredAt > 8.64e15) {
      if (event.currency === input.currency) billingIssue = "Imported billing dates are invalid.";
      continue;
    }
    if (event.occurredAt > input.nowMs) continue;
    const key = JSON.stringify([event.source, event.sourceEventId]);
    const signature = JSON.stringify([event.currency, event.occurredAt, event.customerRef ?? null, event.orderRef ?? null, event.amountMinor, event.refundedMinor, event.kind]);
    const previous = identities.get(key);
    if (event.source?.trim() && event.sourceEventId?.trim()) {
      if (previous && previous.signature !== signature && (event.currency === input.currency || previous.currency === input.currency)) billingIssue = "Imported billing history contains conflicting copies of the same event.";
      if (previous) continue;
      identities.set(key, { signature, currency: event.currency });
    }
    if (event.currency !== input.currency) continue;
    if (!event.source?.trim() || !event.sourceEventId?.trim()) billingIssue = "Imported billing source identities are missing; duplicate events cannot be resolved.";
    if (!Number.isSafeInteger(event.amountMinor) || !Number.isSafeInteger(event.refundedMinor) || event.refundedMinor < 0 || (event.kind === "refund" ? event.refundedMinor !== 0 : event.amountMinor < 0 || event.refundedMinor > event.amountMinor)) billingIssue = "Imported billing amounts are invalid.";
    revenueEvents.push(event);
  }
  const net = (from: number, to: number) => revenueEvents
    .filter(e => e.occurredAt >= from && e.occurredAt < to)
    .reduce((sum, event) => {
      const next = sum + (event.kind === "refund" ? -Math.abs(event.amountMinor) : event.amountMinor - event.refundedMinor);
      if (!Number.isSafeInteger(next)) throw new RangeError("Unsafe billing total");
      return next;
    }, 0);
  let recent = 0, prior = 0;
  if (!billingIssue) {
    try {
      recent = net(input.nowMs - 90 * DAY, input.nowMs);
      prior = net(input.nowMs - 180 * DAY, input.nowMs - 90 * DAY);
      if (!Number.isSafeInteger(recent - prior)) throw new RangeError("Unsafe billing comparison");
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      billingIssue = "Imported billing totals exceed safe minor-unit arithmetic; the comparison is unsafe.";
    }
  }
  const earliest = revenueEvents.filter((e) => e.currency === input.currency).reduce((m, e) => Math.min(m, e.occurredAt), Infinity);
  if (!input.currency) {
    out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "calculated", detail: "Business currency is unknown. Confirm the reporting currency before comparing revenue; do not combine currencies or assume an exchange rate." });
  } else if (billingIssue) {
    out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "calculated", detail: `${billingIssue} Reconcile the source records before using revenue or repeat-purchase signals. ${billingCoverage}` });
  } else if (input.revenuePartial && !input.revenueReadCoversComparison) {
    out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "calculated", detail: `Loaded billing history is truncated to at most 10,000 records. A 90-day comparison is withheld because omitted records may change it. Check complete same-currency records for both 90-day periods. ${billingCoverage}` });
  } else if (earliest <= input.nowMs - 180 * DAY) {
    if (prior > 0) {
      const change = (recent - prior) / prior;
      out.push({ key: "revenue_trend", label: "Revenue, last 90 days vs the 90 before", direction: change <= -0.15 ? "headwind" : change >= 0.15 ? "tailwind" : "neutral", basis: "calculated", detail: `${change >= 0 ? "+" : ""}${Math.round(change * 100)}% net ${input.currency.toUpperCase()} revenue (imported records; seasonality not removed). Direction uses a ±15% change heuristic, not a validated decline or growth threshold.${input.revenuePartial ? " Older history was truncated, but both comparison periods fit within the bounded read." : ""} ${billingCoverage}` });
    } else out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "calculated", detail: `No positive revenue in the earlier 90-day window to compare with. ${billingCoverage}` });
  } else out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "calculated", detail: `Loaded same-currency records do not span 180 days. Check coverage before comparing two 90-day periods. ${billingCoverage}` });

  const repeat = input.currency && !billingIssue ? repeatPurchaseSummary(revenueEvents, { currency: input.currency, nowMs: input.nowMs, windowsDays: [90] }).windows[0] : undefined;
  if (repeat && repeat.eligible >= 20) out.push({ key: "repeat_purchase", label: "Customers who reordered within 90 days", direction: "unknown", basis: "calculated", detail: `${repeat.repeated}/${repeat.eligible} (${Math.round((repeat.rate ?? 0) * 100)}%); no benchmark is assumed, so direction is left to the evidence. First order means first in loaded history, not necessarily first ever.${input.revenuePartial ? " History is truncated; the eligible customers and repeat rate may change with a complete import." : ""} ${billingCoverage}` });

  const p = pipelineOutcomes(input.deals, { nowMs: input.nowMs, partial: input.pipelinePartial });
  const closed = p.won + p.lost;
  const incompletePipeline = p.partial || p.closedWithoutCloseTime > 0 || p.invalidCloseTime > 0;
  const dateCoverage = ` Close dates missing for ${p.closedWithoutCloseTime} and invalid/future for ${p.invalidCloseTime} loaded decisions; edits do not establish decision dates.`;
  if (closed >= 10 || incompletePipeline) out.push({ key: "win_rate", label: "Owner-recorded win rate (365 days)", direction: "unknown", basis: "owner_report", detail: p.winRate === null ? `Win rate unknown: ${p.won} won and ${p.lost} lost have valid close dates in the loaded window.${dateCoverage}${pipelineCoverage}` : `${p.won} won of ${closed} closed (${Math.round(p.winRate * 100)}%).${pipelineCoverage}` });
  const recorded = p.lossReasonDealCount;
  if (recorded >= 5) {
    const modelLoss = p.modelRiskLossDeals;
    out.push({ key: "loss_reasons", label: "Recorded loss reasons pointing at the model (another option, no need, price)", direction: incompletePipeline ? "unknown" : modelLoss / recorded >= 0.4 ? "headwind" : "neutral", basis: "owner_report", detail: `${modelLoss} of ${recorded} lost deals with recorded reasons mention at least one of these factors; multiple reasons on one deal count once; ${p.lossReasonNotRecorded} lost deals have no recorded reason. The 40% flag is a review heuristic, not proof that the business model caused losses.${dateCoverage}${pipelineCoverage}` });
  }
  if (input.lifecycleStage === "decline") out.push({ key: "lifecycle_stage", label: "Owner-reported business stage", direction: "headwind", basis: "owner_report", detail: "The owner reports decline (a concern to check, not a diagnosis)." });
  if (input.competitorChanges90d > 0) out.push({ key: "competitor_changes", label: "Monitored competitor changes (90 days)", direction: "unknown", basis: "calculated", detail: `${input.competitorChanges90d} change summaries in the loaded sample (at most eight), not a complete market count${input.competitorChangesPartial ? "; older summaries may be omitted" : ""}; read them for direction. Competitor activity does not establish customer demand.` });
  return out;
}

export function ownerModelSignalsBrief(signals: readonly OwnerModelSignal[]): string {
  if (!signals.length) return "FIRST-PARTY MODEL SIGNALS: none available (no imported revenue, pipeline, stage or competitor history). Treat first-party trends as unknown.";
  return `FIRST-PARTY MODEL SIGNALS (computed by ClimbOS from this workspace's records; thresholds are stated, not business facts; imported-record calculations are not independently verified or complete business evidence): ${signals.map((s) => `${s.label}: ${s.detail} [${s.direction}, ${s.basis === "calculated" ? "calculated from loaded records" : "owner-reported"}]`).join("; ")}.`;
}

/** The latest saved check as context for later strategy runs; its verdict stays labelled as a model judgment. */
export function businessModelPlanContext(check: BusinessModelCheck | null | undefined, completedAt?: number, freshness?: BusinessModelFreshness | null): string {
  if (!check) return "";
  if (freshness && freshness.status !== "unchanged") {
    return `HISTORICAL BUSINESS MODEL CHECK (AI judgment; not current evidence): ${freshness.reason} Do not reuse its verdict as a current demand or viability constraint. Past hypotheses (not current recommendations): ${check.alternatives.map(a => `${a.mode}: ${a.name}`).join("; ")}. Keep all three available for reassessment; assess the current business independently. A new check needs the owner's normal metered start; this notice authorizes no work.`;
  }
  const date = completedAt ? new Date(completedAt).toISOString().slice(0, 10) : "unknown date";
  const alt = (mode: "grounded" | "adjacent" | "bold") => check.alternatives.find((a) => a.mode === mode);
  return `LATEST BUSINESS MODEL CHECK (${date}; AI judgment for owner review, not a verified finding): verdict ${check.verdict.status.replace(/_/g, " ")} (${check.verdict.confidence} confidence); recommendation ${check.recommendation.decision.replace(/_/g, " ")}; deciding test: ${check.recommendation.decidingTest} Alternatives: grounded "${alt("grounded")?.name ?? "none"}", adjacent "${alt("adjacent")?.name ?? "none"}", bold "${alt("bold")?.name ?? "none"}". Consider these when choosing plays, keep the bold option visible, and don't treat the verdict as proof of decline or permission to change the offer.${strategicLandscapeContext(check.strategicLandscape)}`;
}

/** Labelled demo output for fixtures and the test double: no real-business claims, honest unknowns. */
export function demoBusinessModelCheck(businessName: string): BusinessModelCheck {
  const alt = (mode: "grounded" | "adjacent" | "bold", name: string, modelChange: string, conventionChallenged: string): BusinessModelCheck["alternatives"][number] => ({
    mode, name, modelChange, mechanism: "Demo mechanism: changes how and when customers pay, to test whether it fits real buyers.", assetsUsed: "Demo data: existing customers and current offer", whoPays: "Demo data: current customers", pricingStructure: mode === "grounded" ? "subscription" : mode === "adjacent" ? "retainer" : "usage",
    conventionChallenged, evidenceBasis: "speculative_hypothesis", evidenceRefs: [], assumptions: ["Demo data: customers would consider a different way to pay."], risks: ["Demo data: could confuse existing customers."],
    unitEconomicsInputs: [{ input: "Price under the new model", value: "unknown until tested", basis: "unknown" }], whatPersists: "Demo data: the same product and team",
    smallestTest: { test: "Demo data: describe the option to five existing customers and ask whether they would choose it.", successSignal: "Demo data: two of five ask how to start", stopCondition: "Demo data: none of five are interested", maxCostOrTime: "Two hours of owner time" },
    novelty: mode === "bold" ? "high" : mode === "adjacent" ? "medium" : "low", evidenceStrength: "low", businessFit: "medium", feasibility: "medium", risk: mode === "bold" ? "high" : "low",
  });
  return {
    currentModel: { summary: `Demo data: ${businessName} is shown with a placeholder model; this is not an analysis of a real business.`, whoPays: "Demo data: customers", whatTheyBuy: "Demo data: the current offer", pricingStructure: "unknown", salesMotion: "unknown", delivery: "Demo data: unknown", evidenceRefs: [] },
    marketSignals: [{ dimension: "demand", direction: "unknown", finding: "Demo data: no market evidence was read for this example.", basis: "inference", evidenceRefs: [], limitation: "No sources were read in demo mode." }],
    verdict: { status: "insufficient_evidence", confidence: "low", reasoning: "Demo data: there is no real evidence to judge the model.", whatWouldChangeIt: "Real revenue, retention, pipeline and market evidence." },
    alternatives: [
      alt("grounded", "Demo: recurring plan", "Offer the current service as a recurring plan.", "Customers buy one job at a time."),
      alt("adjacent", "Demo: done-with-you package", "Package expertise into a fixed-scope programme.", "Value is delivered only as hands-on work."),
      alt("bold", "Demo: pay for results", "Charge only when an agreed outcome is reached.", "Customers pay for effort rather than results."),
    ],
    recommendation: { decision: "insufficient_evidence", rationale: "Demo data: run the check on a real workspace with evidence.", decidingTest: "Demo data: ask five customers how they would prefer to pay." },
    strategicLandscape: emptyStrategicLandscape(),
    unknowns: ["Demo data: real revenue trend", "Demo data: willingness to pay under another model"],
  };
}

export interface BusinessModelTestRecord {
  target: "deciding" | "grounded" | "adjacent" | "bold";
  testState: "not_started" | "designed" | "run" | "observed";
  outcomeNote?: string;
  outcomeEvidence: "measured" | "owner_reported" | "unknown";
  outcome?: "met" | "missed" | "unclear" | "not_run";
  ownerDecision: "undecided" | "keep_current_model" | "keep_testing" | "adopt_alternative" | "drop_alternative";
  createdAt: number;
}

/** The original proposal is immutable run output; mode alone is not a hypothesis identity. */
export function businessModelTestSubject(check: BusinessModelCheck, target: BusinessModelTestRecord["target"]) {
  if (target === "deciding") return { name: "Deciding test", test: check.recommendation.decidingTest, successSignal: null, stopCondition: null };
  const matches = check.alternatives.filter(a => a.mode === target);
  const alternative = matches.length === 1 ? matches[0] : null;
  return alternative ? { name: alternative.name, test: alternative.smallestTest.test, successSignal: alternative.smallestTest.successSignal, stopCondition: alternative.smallestTest.stopCondition } : null;
}

/** Latest owner-recorded test per target (records newest first; ties keep input order), for later checks and plans; notes are returned for an untrusted wrapper. */
export function businessModelTestsBrief(records: readonly BusinessModelTestRecord[]): { summary: string; notes: string[] } {
  const latest = new Map<string, BusinessModelTestRecord>();
  for (const r of [...records].sort((a, b) => b.createdAt - a.createdAt)) if (!latest.has(r.target)) latest.set(r.target, r);
  if (!latest.size) return { summary: "", notes: [] };
  const rows = [...latest.values()];
  return {
    summary: `OWNER-RECORDED BUSINESS MODEL TESTS (latest per test; owner-reported, not verified): ${rows.map((r) => `${r.target}: ${r.testState.replace(/_/g, " ")}, evidence ${r.outcomeEvidence.replace(/_/g, " ")}, decision ${r.ownerDecision.replace(/_/g, " ")}, outcome ${r.outcome?.replace(/_/g, " ") ?? "not recorded"}`).join("; ")}. Assess the latest report against its audience, metric, observation window and evidence quality before changing the earlier judgment. A reported result is not automatic proof, and an unrun test is not evidence either way.`,
    notes: rows.filter((r) => r.outcomeNote?.trim()).map((r) => `${r.target}: ${r.outcomeNote!.trim().slice(0, 300)}`),
  };
}
