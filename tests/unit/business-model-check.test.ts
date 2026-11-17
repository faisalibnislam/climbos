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

  it.each(["owner_as_measured", "source_as_measured", "missing_provenance", "mixed_sources", "uncited_owner", "segment_as_measured", "economics_without_source"])("rejects unsupported business-model evidence: %s", kind => {
    const output = check();
    const source = "https://rival.example/plans";
    output.marketSignals = [{ ...output.marketSignals[0], basis: "measured", evidenceRefs: ["fact:0"] }];
    if (kind === "source_as_measured") output.marketSignals[0].evidenceRefs = [source];
    if (kind === "mixed_sources") output.marketSignals[0].evidenceRefs = ["fact:1", "fact:0"];
    if (kind === "uncited_owner") output.marketSignals[0] = { ...output.marketSignals[0], basis: "owner_report", evidenceRefs: [] };
    if (kind === "segment_as_measured") { output.marketSignals = []; output.segmentFit = [{ segment: "Homeowners", dimensions: ["problem_severity", "willingness_to_pay", "reachability", "serviceability"].map(dimension => ({ dimension: dimension as NonNullable<BusinessModelCheck["segmentFit"]>[number]["dimensions"][number]["dimension"], level: "medium", basis: "measured", evidenceRefs: ["fact:0"], note: "Owner reports analytics usage." })) }]; }
    if (kind === "economics_without_source") { output.marketSignals = []; output.alternatives[0].unitEconomicsInputs = [{ input: "Plan price", value: "$49", basis: "owner_report" }]; }
    const issues = lintBusinessModelCheck(output, { factCount: 2, readUrls: [source], factEvidenceBases: kind === "missing_provenance" ? undefined : ["owner_reported", "measured"] });
    expect(issues.some(issue => issue.severity === "error" && ["evidence_basis", "citation"].includes(issue.rule))).toBe(true);
  });

  it("keeps correctly sourced reports and uncertain creative economics distinct", () => {
    const output = check();
    output.marketSignals = [
      { ...output.marketSignals[0], basis: "owner_report", evidenceRefs: ["FACT:0"] },
      { ...output.marketSignals[0], basis: "measured", evidenceRefs: ["fact:1"] },
      { ...output.marketSignals[0], basis: "site_claim", evidenceRefs: ["fact:2"] },
      { ...output.marketSignals[0], basis: "inference", evidenceRefs: ["fact:0", "https://rival.example/plans"] },
    ];
    output.alternatives[0].unitEconomicsInputs = [{ input: "Current price", value: "$49", basis: "owner_report", evidenceRefs: ["fact:0"] }];
    output.alternatives[1].unitEconomicsInputs = [{ input: "Quoted competitor price", value: "$89", basis: "research", evidenceRefs: ["https://rival.example/plans"] }];
    output.alternatives[2].unitEconomicsInputs = [{ input: "Proposed model price", value: "Owner must choose a test price", basis: "unknown" }];
    expect(lintBusinessModelCheck(output, { factCount: 3, factEvidenceBases: ["owner_reported", "measured", "source_reported"], readUrls: ["https://rival.example/plans"] })).toEqual([]);
    output.alternatives[0].unitEconomicsInputs[0].basis = "measured";
    expect(lintBusinessModelCheck(output, { factCount: 3, factEvidenceBases: ["owner_reported", "measured", "source_reported"], readUrls: ["https://rival.example/plans"] })).toEqual(expect.arrayContaining([expect.objectContaining({ path: "alternatives[0].unitEconomicsInputs[0].basis", rule: "evidence_basis" })]));
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

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "", "tomorrow"])("rejects impossible or malformed evidence date %s", observedAt => {
    const output = check(); output.marketSignals[0].observedAt = observedAt;
    expect(lintBusinessModelCheck(output, { factCount: 1, readUrls: ["https://rival.example/plans"] })).toEqual(expect.arrayContaining([expect.objectContaining({ rule: "market_signal_date", severity: "error" })]));
  });

  it("accepts a real leap date without claiming that the date was supported by a source", () => {
    const output = check(); output.marketSignals[0].observedAt = "2024-02-29";
    expect(lintBusinessModelCheck(output, { factCount: 1, readUrls: ["https://rival.example/plans"] })).toEqual([]);
  });

  it.each([
    ["https://RIVAL.example/Plans?offer=A", true],
    ["https://rival.example/Plans?offer=A#pricing", true],
    ["https://rival.example/plans?offer=A", false],
    ["https://rival.example/Plans?offer=a", false],
    ["http://rival.example/Plans?offer=A", false],
    ["https://www.rival.example/Plans?offer=A", false],
    ["https://rival.example/Plans/?offer=A", false],
  ])("preserves source identity for %s", (url, valid) => {
    const output = check(); output.marketSignals[0].evidenceRefs = [url];
    const issues = lintBusinessModelCheck(output, { factCount: 1, readUrls: ["https://rival.example/Plans?offer=A"] });
    expect(issues.some(issue => issue.rule === "citation")).toBe(!valid);
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
    expect(s.find((x) => x.key === "loss_reasons")).toMatchObject({ direction: "headwind", basis: "owner_report", detail: expect.stringContaining("3 of 6 lost deals with recorded reasons mention at least one of these factors;") });
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
    expect(signals.map(s => s.key)).toEqual(["revenue_trend", "win_rate"]);
    expect(signals.find(s => s.key === "win_rate")).toMatchObject({ direction: "unknown", detail: expect.stringContaining("invalid/future for 12 loaded decisions") });
    expect(signals[0].direction).toBe("unknown");
  });

  it("does not turn undated or truncated sales records into a numeric win rate or model-loss diagnosis", () => {
    const deals = Array.from({ length: 12 }, () => ({ stage: "lost" as const, source: "manual", createdAt: now - 60 * DAY, updatedAt: now, lostAt: now - DAY, lostReason: "price" as const }));
    for (const input of [{ deals, pipelinePartial: true }, { deals: [...deals, { ...deals[0], lostAt: undefined }], pipelinePartial: false }]) {
      const signals = ownerModelSignals({ nowMs: now, currency: "USD", revenueEvents: [], competitorChanges90d: 0, ...input });
      expect(signals.find(s => s.key === "win_rate")?.detail).toContain("unknown");
      expect(signals.find(s => s.key === "win_rate")?.detail).not.toContain("(0%)");
      expect(signals.find(s => s.key === "loss_reasons")?.direction).toBe("unknown");
    }
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

describe("overlapping reported losses", () => {
  it("uses distinct deals rather than reason mentions for the review heuristic", () => {
    const deals = Array.from({ length: 5 }, (_, i) => ({ stage: "lost" as const, source: "manual", createdAt: now - DAY, updatedAt: now, lostAt: now, lostReasons: i === 0 ? ["price" as const, "no_need" as const, "chose_competitor" as const] : ["timing" as const] }));
    const input = { nowMs: now, currency: "USD", revenueEvents: [], deals, competitorChanges90d: 0 };
    const signal = ownerModelSignals(input).find(s => s.key === "loss_reasons");
    expect(signal).toMatchObject({ direction: "neutral", detail: expect.stringContaining("1 of 5 lost deals") });
    expect(signal?.detail).toContain("multiple reasons on one deal count once");
    expect(ownerModelSignals({ ...input, deals: deals.slice(0, 1) }).find(s => s.key === "loss_reasons")).toBeUndefined();
  });
});
