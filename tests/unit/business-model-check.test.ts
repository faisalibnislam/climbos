import { describe, expect, it } from "vitest";
import { BusinessModelCheckSchema, businessModelPlanContext, lintBusinessModelCheck, ownerModelSignals, ownerModelSignalsBrief, type BusinessModelCheck } from "../../shared/agents/businessModel";
import type { CohortPayment } from "../../shared/attribution/cohorts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25);

const alternative = (mode: "grounded" | "adjacent" | "bold", o: Partial<BusinessModelCheck["alternatives"][number]> = {}): BusinessModelCheck["alternatives"][number] => ({
  mode, name: `${mode} model`, modelChange: "Move from one-off jobs to a maintenance plan.", mechanism: "Predictable revenue from existing customers.", assetsUsed: "Existing customer list", whoPays: "Current homeowners", pricingStructure: "subscription",
  conventionChallenged: "Jobs are sold one at a time.", evidenceBasis: "speculative_hypothesis", evidenceRefs: [], assumptions: ["Customers want fewer emergencies"], risks: ["Low uptake"],
  unitEconomicsInputs: [{ input: "Monthly plan price", value: "unknown until tested", basis: "unknown" }], whatPersists: "Same crew and service area",
  smallestTest: { test: "Offer the plan to 20 past customers.", successSignal: "3 sign-ups", stopCondition: "Fewer than 1 sign-up", maxCostOrTime: "Two hours" },
  novelty: "medium", evidenceStrength: "low", businessFit: "high", feasibility: "high", risk: "low", ...o,
});
const check = (o: Partial<BusinessModelCheck> = {}): BusinessModelCheck => ({
  currentModel: { summary: "Homeowners pay per repair job, booked by phone.", whoPays: "Homeowners", whatTheyBuy: "Repairs", pricingStructure: "one_time", salesMotion: "referral", delivery: "On-site crew", evidenceRefs: ["fact:0"] },
  marketSignals: [{ dimension: "substitutes", direction: "headwind", finding: "Subscription home-care plans are offered by two local rivals.", basis: "research", evidenceRefs: ["https://rival.example/plans"], observedAt: "2026-10-01", limitation: "Two competitors only." }],
  verdict: { status: "watch", confidence: "medium", reasoning: "Rivals add plans; own revenue is flat.", whatWouldChangeIt: "A falling repeat rate." },
  alternatives: [alternative("grounded"), alternative("adjacent"), alternative("bold")],
  recommendation: { decision: "test_a_pivot", rationale: "A cheap test answers the question.", decidingTest: "Offer the plan to 20 past customers.", recommendedAlternative: "grounded" },
  unknowns: ["Willingness to pay for a plan"],
  ...o,
});

describe("business model check output", () => {
  it("accepts a well-formed check and requires exactly three alternatives", () => {
    expect(BusinessModelCheckSchema.safeParse(check()).success).toBe(true);
    expect(BusinessModelCheckSchema.safeParse(check({ alternatives: [alternative("grounded"), alternative("bold")] })).success).toBe(false);
    expect(lintBusinessModelCheck(check(), { factCount: 1, readUrls: ["https://rival.example/plans"] })).toEqual([]);
  });

  it("rejects invented references, uncited research signals, duplicate modes, numbers marked unknown, and a pivot test without a choice", () => {
    const bad = check({
      currentModel: { ...check().currentModel, evidenceRefs: ["fact:7"] },
      marketSignals: [{ ...check().marketSignals[0], evidenceRefs: [] }, { ...check().marketSignals[0], evidenceRefs: ["https://invented.example"] }],
      alternatives: [alternative("grounded"), alternative("grounded"), alternative("bold", { unitEconomicsInputs: [{ input: "Price", value: "$49", basis: "unknown" }] })],
      recommendation: { decision: "test_a_pivot", rationale: "Test it.", decidingTest: "Offer the plan to past customers." },
    });
    const rules = lintBusinessModelCheck(bad, { factCount: 1, readUrls: ["https://rival.example/plans"] }).filter((i) => i.severity === "error").map((i) => `${i.rule}@${i.path}`);
    expect(rules).toEqual(expect.arrayContaining([
      "citation@currentModel.evidenceRefs",
      "citation@marketSignals[0].evidenceRefs",
      "citation@marketSignals[1].evidenceRefs",
      "business_model@alternatives",
      "invented_fact@alternatives[2].unitEconomicsInputs[0].value",
      "business_model@recommendation.recommendedAlternative",
    ]));
  });

  it("checks segment fit: all four dimensions, cited non-inference ratings, and no inferred high willingness to pay", () => {
    const dim = (dimension: "problem_severity" | "willingness_to_pay" | "reachability" | "serviceability", o: Record<string, unknown> = {}) => ({ dimension, level: "medium" as const, basis: "inference" as const, evidenceRefs: [], note: "Judged from the service description.", ...o });
    const ok = { segment: "Homeowners with older boilers", dimensions: [dim("problem_severity", { basis: "owner_report", evidenceRefs: ["fact:0"] }), dim("willingness_to_pay"), dim("reachability"), dim("serviceability")] };
    const lint = (segmentFit: BusinessModelCheck["segmentFit"]) => lintBusinessModelCheck(check({ segmentFit }), { factCount: 1, readUrls: ["https://rival.example/plans"] }).filter((i) => i.rule === "segment_fit" || i.rule === "citation").map((i) => i.path);
    expect(BusinessModelCheckSchema.safeParse(check({ segmentFit: [ok] })).success).toBe(true);
    expect(lint([ok])).toEqual([]);
    expect(lint([{ ...ok, dimensions: [ok.dimensions[0], ok.dimensions[0], ok.dimensions[2], ok.dimensions[3]] }])).toContain("segmentFit[0].dimensions");
    expect(lint([{ ...ok, dimensions: [dim("problem_severity", { basis: "measured" }), dim("willingness_to_pay", { level: "high" }), ok.dimensions[2], ok.dimensions[3]] }])).toEqual(["segmentFit[0].dimensions[0].evidenceRefs", "segmentFit[0].dimensions[1].level"]);
    expect(lint(undefined)).toEqual([]);
  });

  it("requires a date on research signals unless the limitation says the source is undated", () => {
    const base = check().marketSignals[0];
    const lint = (signal: BusinessModelCheck["marketSignals"][number]) => lintBusinessModelCheck(check({ marketSignals: [signal] }), { factCount: 1, readUrls: ["https://rival.example/plans"] }).filter((i) => i.rule === "market_signal_date");
    expect(lint({ ...base, observedAt: undefined })).toHaveLength(1);
    expect(lint({ ...base, observedAt: undefined, limitation: "The rival page is undated." })).toEqual([]);
    expect(lint({ ...base, observedAt: undefined, basis: "inference", evidenceRefs: [] })).toEqual([]);
  });

  it("keeps a bold alternative without precedent and doesn't gate the verdict", () => {
    const issues = lintBusinessModelCheck(check({ verdict: { status: "at_risk", confidence: "low", reasoning: "Judgment call on thin evidence.", whatWouldChangeIt: "Any first-party trend." } }), { factCount: 1, readUrls: ["https://rival.example/plans"] });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("first-party model signals", () => {
  const order = (daysAgo: number, amountMinor: number, customerRef = `c${daysAgo}`): CohortPayment => ({ source: "stripe", customerRef, orderRef: `o${daysAgo}`, occurredAt: now - daysAgo * DAY, amountMinor, refundedMinor: 0, kind: "order", currency: "USD" });

  it("computes a revenue trend only with 180 days of history, using stated thresholds", () => {
    const down = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [order(180, 10_000), order(100, 10_000), order(30, 12_000)], deals: [], competitorChanges90d: 0 });
    expect(down.find((s) => s.key === "revenue_trend")).toMatchObject({ direction: "headwind", basis: "calculated", detail: expect.stringContaining("-40%") });
    const thin = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [order(30, 12_000)], deals: [], competitorChanges90d: 0 });
    expect(thin.find((s) => s.key === "revenue_trend")).toMatchObject({ direction: "unknown" });
  });

  it("uses owner pipeline reasons and stage, and says when nothing is available", () => {
    const deals = Array.from({ length: 6 }, (_, i) => ({ stage: "lost" as const, source: "manual", createdAt: now - 60 * DAY, updatedAt: now - DAY, lostAt: now - DAY, lostReason: i < 3 ? "chose_competitor" as const : "timing" as const }));
    const s = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [], deals, lifecycleStage: "decline", competitorChanges90d: 2 });
    expect(s.find((x) => x.key === "loss_reasons")).toMatchObject({ direction: "headwind", basis: "owner_report", detail: expect.stringContaining("3 of 6 recorded loss reasons;") });
    expect(s.find((x) => x.key === "lifecycle_stage")?.direction).toBe("headwind");
    expect(s.find((x) => x.key === "competitor_changes")?.detail).toContain("2 change summaries in the loaded sample");
    expect(ownerModelSignalsBrief([])).toContain("none available");
    expect(ownerModelSignalsBrief(s)).toContain("thresholds are stated, not business facts");
  });

  it("withholds revenue direction for a truncated comparison but preserves a fully read comparison window", () => {
    const input = { nowMs: now, currency: "USD", revenueEvents: [order(180, 10_000), order(100, 10_000), order(30, 12_000)], deals: [], competitorChanges90d: 0, revenuePartial: true };
    const partial = ownerModelSignals(input).find(s => s.key === "revenue_trend")!;
    expect(partial.direction).toBe("unknown");
    expect(partial.detail).toContain("comparison is withheld");
    expect(partial.detail).not.toContain("-40%");
    const completeWindow = ownerModelSignals({ ...input, revenueReadCoversComparison: true }).find(s => s.key === "revenue_trend")!;
    expect(completeWindow.detail).toContain("-40%");
    expect(completeWindow.detail).toContain("both comparison periods fit within the bounded read");
    expect(completeWindow.detail).toContain("do not verify coverage of every account or period");
    expect(completeWindow.detail).toContain("15%");
  });

  it("qualifies capped pipeline and repeat samples, missing loss reasons and competitor counts", () => {
    const revenueEvents = Array.from({ length: 20 }, (_, i) => order(200 + i, 100));
    const deals = Array.from({ length: 12 }, (_, i) => ({ stage: "lost" as const, source: "manual", createdAt: now - 60 * DAY, updatedAt: now - DAY, lostAt: now - DAY, ...(i < 6 ? { lostReason: "price" as const } : {}) }));
    const signals = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents, deals, competitorChanges90d: 8, revenuePartial: true, pipelinePartial: true, competitorChangesPartial: true });
    const loss = signals.find(s => s.key === "loss_reasons")!;
    expect(loss.direction).toBe("unknown");
    expect(loss.detail).toContain("6 lost deals have no recorded reason");
    expect(loss.detail).toContain("totals and proportions are partial");
    expect(signals.find(s => s.key === "win_rate")?.detail).toContain("2,000 most recently updated deals");
    expect(signals.find(s => s.key === "repeat_purchase")?.detail).toContain("History is truncated");
    expect(signals.find(s => s.key === "competitor_changes")?.detail).toContain("not a complete market count");
    expect(ownerModelSignalsBrief(signals)).toContain("calculated from loaded records");
  });

  it("does not treat future payments and future deal closes as observed results", () => {
    const revenueEvents = Array.from({ length: 20 }, (_, i) => order(-1, 100, `future-${i}`));
    const deals = Array.from({ length: 12 }, () => ({ stage: "lost" as const, source: "manual", createdAt: now - DAY, updatedAt: now, lostAt: now + DAY, lostReason: "price" as const }));
    const signals = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents, deals, competitorChanges90d: 0 });
    expect(signals.map(s => s.key)).toEqual(["revenue_trend"]);
    expect(signals[0].direction).toBe("unknown");
  });

  it("keeps non-monetary evidence when the business currency is unknown", () => {
    const signals = ownerModelSignals({ nowMs: now, currency: null, revenueEvents: [order(180, 10_000)], deals: [], lifecycleStage: "decline", competitorChanges90d: 2 });
    expect(signals.find(s => s.key === "revenue_trend")?.detail).toContain("Business currency is unknown");
    expect(signals.find(s => s.key === "lifecycle_stage")?.basis).toBe("owner_report");
    expect(signals.find(s => s.key === "competitor_changes")?.detail).toContain("2 change summaries");
  });

  it("limits analogy citations to the small retrieved set", () => {
    const output = check({ alternatives: [alternative("grounded", { precedentIds: ["CP-076"] }), alternative("adjacent"), alternative("bold")] });
    expect(lintBusinessModelCheck(output, { factCount: 0, readUrls: [] }).some((x) => x.rule === "citation")).toBe(true);
    expect(lintBusinessModelCheck(output, { factCount: 0, readUrls: [], precedentIds: ["CP-076"] }).filter((x) => x.path?.endsWith("precedentIds"))).toEqual([]);
  });

  it("gives later plans the latest check as labelled judgment", () => {
    const text = businessModelPlanContext(check(), now);
    expect(text).toContain("AI judgment for owner review, not a verified finding");
    expect(text).toContain("verdict watch (medium confidence)");
    expect(text).toContain('bold "bold model"');
    expect(businessModelPlanContext(null)).toBe("");
  });
});
