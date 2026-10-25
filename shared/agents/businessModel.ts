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
    assumptions: z.array(z.string().min(1).max(220)).max(6),
    risks: z.array(z.string().min(1).max(220)).max(6),
    unitEconomicsInputs: z.array(z.object({
      input: z.string().min(2).max(100),
      value: z.string().min(1).max(100),
      basis: z.enum(["owner_report", "measured", "research", "assumption", "unknown"]),
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
  unknowns: z.array(z.string().min(1).max(240)).max(8),
});
export type BusinessModelCheck = z.infer<typeof BusinessModelCheckSchema>;

export const BUSINESS_MODEL_TASK = `BUSINESS MODEL CHECK: Describe how this business currently makes money (who pays, for what, pricing structure, sales motion, delivery) using only supplied facts and pages read in this run. Then judge whether that model is holding up against how its market is moving: list market signals (demand, pricing pressure, substitutes, customer behavior, distribution, cost structure, platform or regulatory change, technology), each with direction, basis, references, the date the evidence describes when stated, and its limitation. Use the FIRST-PARTY MODEL SIGNALS block as computed facts; never contradict or recompute them. Give a verdict (holding, watch, at risk, or insufficient evidence) with your confidence, reasoning, and what would change it; it is shown to the owner as your judgment. A website, competitor activity, or a trend article alone does not prove a model is outdated, and an absence of data is not decline. Propose exactly three alternative business models: one grounded (established practice), one adjacent (an evidence-supported stretch), one bold (may lack any precedent; do not drop it for being novel, low-evidence, or not yet executable). For each: the model change, mechanism, existing assets it reuses, who pays and how, the convention it challenges, assumptions, risks, unit-economics inputs (state each as owner-reported, measured, research, assumption, or unknown; never invent a figure), what stays the same, and the smallest reversible test with success signal, stop condition, and maximum cost or time. Keep novelty, evidence strength, fit, feasibility, and risk separate. Finish with persist, adjust, test a pivot, or insufficient evidence, the single test that would decide it, and the recommended alternative when testing a pivot. Nothing here authorizes changing prices, offers, or operations.`;

const REF = /^fact:(\d+)$/i;
const citeKey = (url: string) => url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

/** Structural and evidence integrity; the verdict itself is the model's labelled judgment and is not gated. */
export function lintBusinessModelCheck(out: BusinessModelCheck, ctx: { factCount: number; readUrls: string[] }): LintIssue[] {
  const issues: LintIssue[] = [];
  const read = new Set(ctx.readUrls.map(citeKey));
  const checkRefs = (refs: string[], path: string) => {
    for (const ref of refs) {
      const fact = REF.exec(ref.trim());
      const ok = fact ? Number(fact[1]) < ctx.factCount : /^https?:\/\//i.test(ref.trim()) && read.has(citeKey(ref));
      if (!ok) issues.push({ severity: "error", rule: "citation", message: `"${ref.slice(0, 80)}" isn't a supplied fact (fact:0–${Math.max(0, ctx.factCount - 1)}) or a page read in this run.`, path });
    }
  };
  checkRefs(out.currentModel.evidenceRefs, "currentModel.evidenceRefs");
  out.marketSignals.forEach((s, i) => {
    checkRefs(s.evidenceRefs, `marketSignals[${i}].evidenceRefs`);
    if ((s.basis === "research" || s.basis === "site_claim" || s.basis === "measured") && !s.evidenceRefs.length) issues.push({ severity: "error", rule: "citation", message: `A ${s.basis.replace("_", " ")} signal needs a fact or page reference, or label it inference.`, path: `marketSignals[${i}].evidenceRefs` });
    if (s.observedAt && !/^\d{4}-\d{2}-\d{2}$/.test(s.observedAt)) issues.push({ severity: "error", rule: "business_model", message: "Use YYYY-MM-DD for the evidence date, or leave it out.", path: `marketSignals[${i}].observedAt` });
  });
  const modes = out.alternatives.map((a) => a.mode).sort().join(",");
  if (modes !== "adjacent,bold,grounded") issues.push({ severity: "error", rule: "business_model", message: "Give exactly one grounded, one adjacent and one bold alternative.", path: "alternatives" });
  out.alternatives.forEach((a, i) => {
    checkRefs(a.evidenceRefs, `alternatives[${i}].evidenceRefs`);
    if (a.evidenceBasis !== "speculative_hypothesis" && a.mode !== "bold" && !a.evidenceRefs.length) issues.push({ severity: "warn", rule: "business_model", message: `"${a.name}" claims ${a.evidenceBasis.replace(/_/g, " ")} without a reference.`, path: `alternatives[${i}].evidenceRefs` });
    a.unitEconomicsInputs.forEach((u, j) => {
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
  basis: "measured" | "owner_report";
  detail: string;
}

const DAY = 86_400_000;

/**
 * First-party signals computed in code for the check (stated thresholds; unknown when data is thin).
 * Revenue: net same-currency revenue, last 90 days vs the 90 before (±15% is a direction, not a cause).
 */
export function ownerModelSignals(input: {
  nowMs: number;
  currency: string;
  revenueEvents: readonly CohortPayment[];
  deals: readonly PipelineDeal[];
  lifecycleStage?: string | null;
  competitorChanges90d: number;
}): OwnerModelSignal[] {
  const out: OwnerModelSignal[] = [];
  const net = (from: number, to: number) => input.revenueEvents
    .filter((e) => e.currency === input.currency && e.occurredAt >= from && e.occurredAt < to)
    .reduce((s, e) => s + (e.kind === "refund" ? -Math.abs(e.amountMinor) : e.amountMinor - e.refundedMinor), 0);
  const earliest = input.revenueEvents.filter((e) => e.currency === input.currency).reduce((m, e) => Math.min(m, e.occurredAt), Infinity);
  if (earliest <= input.nowMs - 180 * DAY) {
    const recent = net(input.nowMs - 90 * DAY, input.nowMs);
    const prior = net(input.nowMs - 180 * DAY, input.nowMs - 90 * DAY);
    if (prior > 0) {
      const change = (recent - prior) / prior;
      out.push({ key: "revenue_trend", label: "Revenue, last 90 days vs the 90 before", direction: change <= -0.15 ? "headwind" : change >= 0.15 ? "tailwind" : "neutral", basis: "measured", detail: `${change >= 0 ? "+" : ""}${Math.round(change * 100)}% net ${input.currency.toUpperCase()} revenue (imported records; seasonality not removed).` });
    } else out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "measured", detail: "No positive revenue in the earlier 90-day window to compare with." });
  } else out.push({ key: "revenue_trend", label: "Revenue trend", direction: "unknown", basis: "measured", detail: "Less than 180 days of imported revenue history." });

  const repeat = repeatPurchaseSummary(input.revenueEvents, { currency: input.currency, nowMs: input.nowMs, windowsDays: [90] }).windows[0];
  if (repeat && repeat.eligible >= 20) out.push({ key: "repeat_purchase", label: "Customers who reordered within 90 days", direction: "unknown", basis: "measured", detail: `${repeat.repeated}/${repeat.eligible} (${Math.round((repeat.rate ?? 0) * 100)}%); no benchmark is assumed, so direction is left to the evidence.` });

  const p = pipelineOutcomes(input.deals, { nowMs: input.nowMs });
  const closed = p.won + p.lost;
  if (closed >= 10) out.push({ key: "win_rate", label: "Owner-recorded win rate (365 days)", direction: "unknown", basis: "owner_report", detail: `${p.won} won of ${closed} closed (${Math.round((p.winRate ?? 0) * 100)}%).` });
  const recorded = p.lossReasons.reduce((s, r) => s + r.count, 0);
  if (recorded >= 5) {
    const modelLoss = p.lossReasons.filter((r) => r.reason === "chose_competitor" || r.reason === "no_need" || r.reason === "price").reduce((s, r) => s + r.count, 0);
    out.push({ key: "loss_reasons", label: "Recorded loss reasons pointing at the model (another option, no need, price)", direction: modelLoss / recorded >= 0.4 ? "headwind" : "neutral", basis: "owner_report", detail: `${modelLoss} of ${recorded} recorded loss reasons.` });
  }
  if (input.lifecycleStage === "decline") out.push({ key: "lifecycle_stage", label: "Owner-reported business stage", direction: "headwind", basis: "owner_report", detail: "The owner reports decline (a concern to check, not a diagnosis)." });
  if (input.competitorChanges90d > 0) out.push({ key: "competitor_changes", label: "Monitored competitor changes (90 days)", direction: "unknown", basis: "measured", detail: `${input.competitorChanges90d} recorded change summaries; read them for direction.` });
  return out;
}

export function ownerModelSignalsBrief(signals: readonly OwnerModelSignal[]): string {
  if (!signals.length) return "FIRST-PARTY MODEL SIGNALS: none available (no imported revenue, pipeline, stage or competitor history). Treat first-party trends as unknown.";
  return `FIRST-PARTY MODEL SIGNALS (computed by ClimbOS from this workspace's records; thresholds are stated, not business facts): ${signals.map((s) => `${s.label}: ${s.detail} [${s.direction}, ${s.basis === "measured" ? "measured" : "owner-reported"}]`).join("; ")}.`;
}

/** The latest saved check as context for later strategy runs; its verdict stays labelled as a model judgment. */
export function businessModelPlanContext(check: BusinessModelCheck | null | undefined, completedAt?: number): string {
  if (!check) return "";
  const date = completedAt ? new Date(completedAt).toISOString().slice(0, 10) : "unknown date";
  const alt = (mode: "grounded" | "adjacent" | "bold") => check.alternatives.find((a) => a.mode === mode);
  return `LATEST BUSINESS MODEL CHECK (${date}; AI judgment for owner review, not a verified finding): verdict ${check.verdict.status.replace(/_/g, " ")} (${check.verdict.confidence} confidence); recommendation ${check.recommendation.decision.replace(/_/g, " ")}; deciding test: ${check.recommendation.decidingTest} Alternatives: grounded "${alt("grounded")?.name ?? "none"}", adjacent "${alt("adjacent")?.name ?? "none"}", bold "${alt("bold")?.name ?? "none"}". Consider these when choosing plays, keep the bold option visible, and don't treat the verdict as proof of decline or permission to change the offer.`;
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
    unknowns: ["Demo data: real revenue trend", "Demo data: willingness to pay under another model"],
  };
}

export interface BusinessModelTestRecord {
  target: "deciding" | "grounded" | "adjacent" | "bold";
  testState: "not_started" | "designed" | "run" | "observed";
  outcomeNote?: string;
  outcomeEvidence: "measured" | "owner_reported" | "unknown";
  ownerDecision: "undecided" | "keep_current_model" | "keep_testing" | "adopt_alternative" | "drop_alternative";
  createdAt: number;
}

/** Latest owner-recorded test per target (records newest first; ties keep input order), for later checks and plans; notes are returned for an untrusted wrapper. */
export function businessModelTestsBrief(records: readonly BusinessModelTestRecord[]): { summary: string; notes: string[] } {
  const latest = new Map<string, BusinessModelTestRecord>();
  for (const r of [...records].sort((a, b) => b.createdAt - a.createdAt)) if (!latest.has(r.target)) latest.set(r.target, r);
  if (!latest.size) return { summary: "", notes: [] };
  const rows = [...latest.values()];
  return {
    summary: `OWNER-RECORDED BUSINESS MODEL TESTS (latest per test; owner-reported, not verified): ${rows.map((r) => `${r.target}: ${r.testState.replace(/_/g, " ")}, evidence ${r.outcomeEvidence.replace(/_/g, " ")}, decision ${r.ownerDecision.replace(/_/g, " ")}`).join("; ")}. Build on these results; an observed result outranks the earlier verdict, and an unrun test is not evidence either way.`,
    notes: rows.filter((r) => r.outcomeNote?.trim()).map((r) => `${r.target}: ${r.outcomeNote!.trim().slice(0, 300)}`),
  };
}
