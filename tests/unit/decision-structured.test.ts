import { describe, expect, it } from "vitest";
import { DECISION_FIELDS, DecisionSchema, lintDecision, type Decision } from "../../shared/agents/decision";
import { playsTask } from "../../shared/agents/planTasks";
import { planQuality } from "../../shared/agents/quality";
import { analyzeDecisionOptions, growthPlaysSpec, lintDecisionConstraintFit, lintDecisionOptionChoice } from "../../shared/agents/specs";
import { diagnose } from "../../shared/agents/diagnosis";
import { portfolioRange, type PlayLike } from "../../shared/agents/economics";

/** S5 (REQ-STRAT-01/02/04) behind decision_contract: the decision is structured and checked in code. */
const decision = (o: Partial<Decision> = {}): Decision => ({
  observations: [
    { observation: "About 40% of first-time customers never order again", source: "results" },
    { observation: "Site traffic grew 30% this quarter while orders stayed flat", source: "owner" },
  ],
  constraint: "retention",
  explanations: [
    { explanation: "First order disappoints", evidenceFor: "Reviews mention late delivery", evidenceAgainst: "Ratings average 4.6" },
    { explanation: "No reason to come back", evidenceFor: "No follow-up after the first order", evidenceAgainst: "" },
  ],
  limits: "We don't know why customers leave; no exit survey yet.",
  options: [
    { name: "Win back and keep first-time buyers", kind: "retention", plays: ["Win back lapsed customers"], chosen: true, whyNot: "" },
    { name: "Buy more traffic", kind: "acquisition", plays: [], chosen: false, whyNot: "More visitors leak out the same way; traffic is already up." },
  ],
  guidingPolicy: "Keep the customers we already win before paying for new ones.",
  focus: { primaryPlay: "Win back lapsed customers", supportingMove: "Ask recent buyers what blocked reorder", maintenanceWork: "Review reorder rate weekly" },
  falsifier: "Fewer than 10 of 300 lapsed customers reorder by day 21.",
  ...o,
});
const plays = [{ name: "Win back lapsed customers" }];
const errors = (d: Decision | undefined, p = plays) => lintDecision(d, p).filter((i) => i.severity === "error");

const measurablePlay = (name: string, weeklyReach: number, rate: number, monthlySpendUsd: number): PlayLike => ({
  name,
  kind: "bankable",
  unit: "customers",
  horizonDays: 30,
  model: { weeklyReach, steps: [{ name: "paid customers", rate }], monthlySpendUsd, ownerHoursPerWeek: 0 },
});

describe("structured decision (flagged)", () => {
  it("a retention decision that outranks acquisition, with a dated falsifier, passes", () => {
    expect(errors(decision())).toEqual([]);
  });

  it("missing decision is an error", () => {
    expect(errors(undefined)).toHaveLength(1);
  });

  it("needs competing explanations, not one story", () => {
    expect(errors(decision({ explanations: [decision().explanations[0]] })).map((i) => i.path)).toContain("decision.explanations");
  });

  it("exactly one option chosen; every loser says why it lost", () => {
    const opts = decision().options;
    expect(errors(decision({ options: opts.map((o) => ({ ...o, chosen: true })) })).some((i) => /choose exactly one/.test(i.message))).toBe(true);
    expect(errors(decision({ options: [opts[0], { ...opts[1], whyNot: " " }] })).map((i) => i.path)).toContain("decision.options[1].whyNot");
    expect(errors(decision({ options: [...opts, ...opts, opts[1]] })).some((i) => /compare 2 to 4/.test(i.message))).toBe(true);
  });

  it("a trivial decision may list one option (REQ-STRAT-02: no forced alternatives)", () => {
    expect(errors(decision({ options: [decision().options[0]] }))).toEqual([]);
  });

  it("the chosen option must name real plays; stray plays are flagged", () => {
    expect(errors(decision({ options: [{ ...decision().options[0], plays: ["Referral loop"] }] })).some((i) => /Referral loop/.test(i.message))).toBe(true);
    const warns = lintDecision(decision(), [...plays, { name: "TikTok tests" }]).filter((i) => i.severity === "warn");
    expect(warns.some((i) => /TikTok tests/.test(i.message))).toBe(true);
  });

  it("requires the strategic focus to name an exact primary play and concrete support and upkeep", () => {
    const issues = errors(decision({ focus: { primaryPlay: "Referral loop", supportingMove: " ", maintenanceWork: " " } }));
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(["decision.focus.primaryPlay", "decision.focus.supportingMove", "decision.focus.maintenanceWork"]));
  });

  it("the falsifier needs a number and a date", () => {
    expect(errors(decision({ falsifier: "If customers don't come back" })).map((i) => i.path)).toContain("decision.falsifier");
    expect(errors(decision({ falsifier: "Fewer than 10 reorders" })).map((i) => i.path)).toContain("decision.falsifier");
  });

  it("observations that are all inference are flagged", () => {
    const obs = decision().observations.map((o) => ({ ...o, source: "inference" as const }));
    expect(lintDecision(decision({ observations: obs }), plays).some((i) => i.severity === "warn" && i.path === "decision.observations")).toBe(true);
  });

  it("links strategic observations to only the supplied fact indexes and research URLs", () => {
    const linked = decision({ observations: [
      { observation: "Orders stayed flat", source: "owner", evidenceRefs: ["fact:0"] },
      { observation: "The pricing page lists a monthly plan", source: "site", evidenceRefs: ["https://example.com/pricing"] },
    ] });
    const issues = lintDecision(linked, plays, { factCount: 1, availableSourceUrls: ["https://www.example.com/pricing/"] });
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(DecisionSchema.safeParse(linked).success).toBe(true);
  });

  it("rejects fabricated or out-of-run decision references and flags missing provenance", () => {
    const linked = decision({ observations: [
      { observation: "Orders stayed flat", source: "owner", evidenceRefs: ["fact:4"] },
      { observation: "Competitor has a new offer", source: "research", evidenceRefs: ["https://not-read.example/offer"] },
      { observation: "Maybe the price is high", source: "owner" },
    ] });
    const issues = lintDecision(linked, plays, { factCount: 1, availableSourceUrls: ["https://example.com/pricing"] });
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(2);
    expect(issues.some((issue) => issue.severity === "warn" && issue.path === "decision.observations[2].evidenceRefs")).toBe(true);
  });

  it("decision findings are soft: the plan is provisional, not failed", () => {
    const q = planQuality([{ agentId: "growth_plays", shipped: false, gatesPassed: true, average: 8, rounds: 2, errors: { decision: 2 }, researchSources: 4 }]);
    expect(q.state).toBe("provisional");
  });
});

describe("deterministic comparison of decision options", () => {
  const economics = { revenuePerCustomerMonthUsd: 100, grossMargin: 1, monthlyChurn: 0, basis: "test" };
  const optionPlays = [measurablePlay("Volume", 1, 1, 10_000), measurablePlay("Efficient", 5, 1, 100)];
  const options = [
    { name: "Buy volume", kind: "acquisition" as const, plays: ["Volume"], chosen: true, whyNot: "" },
    { name: "Use the efficient channel", kind: "acquisition" as const, plays: ["Efficient"], chosen: false, whyNot: "Smaller reach." },
  ];

  it("flags a chosen option with lower modeled contribution than another feasible option", () => {
    const issues = lintDecisionOptionChoice(decision({ options }), optionPlays, economics);
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("decision_choice");
    expect(issues[0].message).toContain("lower modeled net contribution");
  });

  it("returns an auditable, explicitly uncalibrated calculation trace for mapped options", () => {
    const trace = analyzeDecisionOptions(decision({ options }), optionPlays, economics, { monthlyAdBudgetUsd: 1_000, horizonDays: 90 });
    expect(trace).toMatchObject({
      method: "seeded_joint_scenario_mean_v1",
      horizonDays: 90,
      currency: "USD",
      probabilityCalibrated: false,
      constraints: { monthlyAdBudgetUsd: 1_000 },
      options: [
        { name: "Buy volume", chosen: true, calculated: true, playNames: ["Volume"], customerRange: { p10: expect.any(Number), p50: expect.any(Number), p90: expect.any(Number) }, netContribution: expect.any(Number) },
        { name: "Use the efficient channel", chosen: false, calculated: true, playNames: ["Efficient"] },
      ],
    });
    const unavailable = analyzeDecisionOptions(decision({ options: options.map((option) => ({ ...option, plays: [] })) }), optionPlays, economics);
    expect(unavailable?.options[0]).toMatchObject({ calculated: false, unavailableReason: "No mapped plays", netContribution: null });
  });

  it("flags a chosen option that breaches a confirmed monthly budget when another fits", () => {
    const issues = lintDecisionOptionChoice(decision({ options }), optionPlays, economics, { monthlyAdBudgetUsd: 1_000 });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("exceeds a confirmed budget");
  });

  it("does not score options whose alternatives have no measurable play mapping", () => {
    const nonComparable = options.map((option) => ({ ...option, plays: [] }));
    expect(lintDecisionOptionChoice(decision({ options: nonComparable }), optionPlays, economics)).toEqual([]);
  });

  it("uses mean joint scenario outcomes instead of the middle scenario to compare ranged options", () => {
    const skewed = { ...measurablePlay("Skewed", 10, 1, 0), model: { ...measurablePlay("Skewed", 10, 1, 0).model!, weeklyReachLow: 1, weeklyReachHigh: 100 } };
    const steady = measurablePlay("Steady", 20, 1, 0);
    const rangedOptions = [
      { name: "Test the upside", kind: "acquisition" as const, plays: ["Skewed"], chosen: true, whyNot: "" },
      { name: "Take the steady path", kind: "acquisition" as const, plays: ["Steady"], chosen: false, whyNot: "Lower potential." },
    ];
    expect(lintDecisionOptionChoice(decision({ options: rangedOptions }), [skewed, steady], economics)).toEqual([]);
  });

  it("uses the P90 customer scenario when checking a confirmed delivery-capacity limit", () => {
    const ranged = measurablePlay("Ranged", 10, 1, 0);
    ranged.model = { ...ranged.model!, weeklyReachLow: 1, weeklyReachHigh: 1_000 };
    const steady = measurablePlay("Steady", 5, 1, 0);
    const rangedOptions = [
      { name: "Ranged option", kind: "acquisition" as const, plays: ["Ranged"], chosen: true, whyNot: "" },
      { name: "Steady option", kind: "acquisition" as const, plays: ["Steady"], chosen: false, whyNot: "Lower volume." },
    ];
    expect(portfolioRange({ economics, plays: [ranged] }, 30).p90).toBeGreaterThan(30);
    const issues = lintDecisionOptionChoice(decision({ options: rangedOptions }), [ranged, steady], economics, { newCustomersPerMonth: 30 });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("exceeds a confirmed budget, time or delivery limit");
  });

  it("fails when the structured decision contradicts a supported owner diagnosis", () => {
    const diagnosis = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    expect(diagnosis).toMatchObject({ constraint: "activation", status: "supported" });
    const issues = lintDecisionConstraintFit(decision({ constraint: "retention" }), [{ name: "Onboarding fix", mechanic: "Improve first value activation" }], diagnosis);
    expect(issues).toMatchObject([{ severity: "error", rule: "diagnosis_fit", path: "decision.constraint" }]);
  });

  it("warns when a model-selected constraint has no play that visibly addresses it", () => {
    const issues = lintDecisionConstraintFit(decision({ constraint: "retention" }), [{ name: "More traffic", mechanic: "Acquire new leads" }]);
    expect(issues).toMatchObject([{ severity: "warn", rule: "diagnosis_fit", path: "plays" }]);
  });
});

describe("flag wiring", () => {
  it("on: the plays schema requires a decision; off: the default schema is unchanged", () => {
    const on = growthPlaysSpec({ decisionContract: true }).schema;
    const off = growthPlaysSpec().schema;
    const option = { title: "Test an existing customer question", challengedConvention: "A business should only announce finished ideas.", whyConventionPersists: "This feels easier to control.", costOfBreaking: "Early feedback can expose an unfinished idea.", businessMechanism: "Invite a few customers to react to a low-cost concept.", businessAction: "Share one private mockup with a few eligible customers.", whyItCouldMatter: "The business may learn what buyers actually understand.", customerBehavior: "A buyer explains a use case or objection.", audienceOrCondition: "Only with customer permission.", evidenceBasis: "speculative_hypothesis", evidenceNote: "No business-specific outcome is known yet.", evidenceRefs: [], precedentIds: [], transferLogic: "No precedent is needed for this small direct test.", keyDifferences: "This is a small private customer test.", assumptions: [], uncertainties: ["Buyer interest is unknown."], risks: ["The concept may create an expectation."], costAndCapacity: "One hour, no spend.", novelty: "medium", evidenceStrength: "low", businessFit: "medium", feasibility: "high", risk: "low", reversibleTest: { method: "Show a mockup to two eligible customers.", metric: "Useful buyer feedback", duration: "One week", resourceLimit: "One hour", continueIf: "A buyer names a useful next step.", changeIf: "The idea is understood but not relevant.", stopIf: "No buyer finds it useful." } };
    const base = { portfolioNote: "", strategyExploration: { grounded: option, adjacent: option, bold: option }, economics: { revenuePerCustomerMonthUsd: 0, grossMargin: 0, monthlyChurn: 0, basis: "", sources: { revenue: { source: "assumption", ref: "", quote: "" }, margin: { source: "assumption", ref: "", quote: "" }, churn: { source: "assumption", ref: "", quote: "" } } }, plays: [] };
    expect(on.safeParse(base).success).toBe(false);
    expect(on.safeParse({ ...base, decision: decision() }).success).toBe(true);
    expect(off.safeParse(base).success).toBe(true);
  });

  it("on: the task asks for the decision fields; off: it doesn't", () => {
    expect(playsTask({ scorecard: "", insights: "", decisionContract: true })).toContain(DECISION_FIELDS);
    const defaultTask = playsTask({ scorecard: "", insights: "" });
    expect(defaultTask).not.toContain("Fill decision");
    expect(defaultTask).toContain("best-supported binding constraint");
    expect(defaultTask).toContain("Fixing the offer, conversion, retention or capacity can outrank new acquisition");
    expect(defaultTask).not.toContain("one bankable play, one or two creative-but-proven plays");
    expect(defaultTask).not.toContain("capped moonshot");
  });

  it("on: the plays lint includes the decision checks", () => {
    const spec = growthPlaysSpec({ decisionContract: true });
    const out = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 40, grossMargin: 0.6, monthlyChurn: 0.1, basis: "" }, plays: [] } as never;
    const input = { task: "", brief: "", facts: [] };
    expect(spec.lint?.(out, input).some((i) => i.rule === "decision")).toBe(true);
    expect(growthPlaysSpec().lint?.(out, input).some((i) => i.rule === "decision")).toBe(false);
  });
});
