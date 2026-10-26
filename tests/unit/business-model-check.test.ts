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
    expect(down.find((s) => s.key === "revenue_trend")).toMatchObject({ direction: "headwind", basis: "measured", detail: expect.stringContaining("-40%") });
    const thin = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [order(30, 12_000)], deals: [], competitorChanges90d: 0 });
    expect(thin.find((s) => s.key === "revenue_trend")).toMatchObject({ direction: "unknown" });
  });

  it("uses owner pipeline reasons and stage, and says when nothing is available", () => {
    const deals = Array.from({ length: 6 }, (_, i) => ({ stage: "lost" as const, source: "manual", createdAt: now - 60 * DAY, updatedAt: now - DAY, lostAt: now - DAY, lostReason: i < 3 ? "chose_competitor" as const : "timing" as const }));
    const s = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [], deals, lifecycleStage: "decline", competitorChanges90d: 2 });
    expect(s.find((x) => x.key === "loss_reasons")).toMatchObject({ direction: "headwind", basis: "owner_report", detail: "3 of 6 recorded loss reasons." });
    expect(s.find((x) => x.key === "lifecycle_stage")?.direction).toBe("headwind");
    expect(s.find((x) => x.key === "competitor_changes")?.detail).toContain("2 recorded change summaries");
    expect(ownerModelSignalsBrief([])).toContain("none available");
    expect(ownerModelSignalsBrief(s)).toContain("thresholds are stated, not business facts");
  });

  it("gives later plans the latest check as labelled judgment", () => {
    const text = businessModelPlanContext(check(), now);
    expect(text).toContain("AI judgment for owner review, not a verified finding");
    expect(text).toContain("verdict watch (medium confidence)");
    expect(text).toContain('bold "bold model"');
    expect(businessModelPlanContext(null)).toBe("");
  });
});
