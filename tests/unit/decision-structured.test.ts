import { describe, expect, it } from "vitest";
import { DECISION_FIELDS, lintDecision, type Decision } from "../../shared/agents/decision";
import { playsTask } from "../../shared/agents/planTasks";
import { planQuality } from "../../shared/agents/quality";
import { growthPlaysSpec, lintDecisionOptionChoice } from "../../shared/agents/specs";
import type { PlayLike } from "../../shared/agents/economics";

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

  it("the falsifier needs a number and a date", () => {
    expect(errors(decision({ falsifier: "If customers don't come back" })).map((i) => i.path)).toContain("decision.falsifier");
    expect(errors(decision({ falsifier: "Fewer than 10 reorders" })).map((i) => i.path)).toContain("decision.falsifier");
  });

  it("observations that are all inference are flagged", () => {
    const obs = decision().observations.map((o) => ({ ...o, source: "inference" as const }));
    expect(lintDecision(decision({ observations: obs }), plays).some((i) => i.severity === "warn" && i.path === "decision.observations")).toBe(true);
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

  it("flags a chosen option that breaches a confirmed monthly budget when another fits", () => {
    const issues = lintDecisionOptionChoice(decision({ options }), optionPlays, economics, { monthlyAdBudgetUsd: 1_000 });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("exceeds a confirmed budget");
  });

  it("does not score options whose alternatives have no measurable play mapping", () => {
    const nonComparable = options.map((option) => ({ ...option, plays: [] }));
    expect(lintDecisionOptionChoice(decision({ options: nonComparable }), optionPlays, economics)).toEqual([]);
  });
});

describe("flag wiring", () => {
  it("on: the plays schema requires a decision; off: the default schema is unchanged", () => {
    const on = growthPlaysSpec({ decisionContract: true }).schema;
    const off = growthPlaysSpec().schema;
    const base = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 0, grossMargin: 0, monthlyChurn: 0, basis: "", sources: { revenue: { source: "assumption", ref: "", quote: "" }, margin: { source: "assumption", ref: "", quote: "" }, churn: { source: "assumption", ref: "", quote: "" } } }, plays: [] };
    expect(on.safeParse(base).success).toBe(false);
    expect(on.safeParse({ ...base, decision: decision() }).success).toBe(true);
    expect(off.safeParse(base).success).toBe(true);
  });

  it("on: the task asks for the decision fields; off: it doesn't", () => {
    expect(playsTask({ scorecard: "", insights: "", decisionContract: true })).toContain(DECISION_FIELDS);
    expect(playsTask({ scorecard: "", insights: "" })).not.toContain("Fill decision");
  });

  it("on: the plays lint includes the decision checks", () => {
    const spec = growthPlaysSpec({ decisionContract: true });
    const out = { portfolioNote: "", economics: { revenuePerCustomerMonthUsd: 40, grossMargin: 0.6, monthlyChurn: 0.1, basis: "" }, plays: [] } as never;
    const input = { task: "", brief: "", facts: [] };
    expect(spec.lint?.(out, input).some((i) => i.rule === "decision")).toBe(true);
    expect(growthPlaysSpec().lint?.(out, input).some((i) => i.rule === "decision")).toBe(false);
  });
});
