import { describe, expect, it } from "vitest";
import { CASE_SETS, CASES, MIXED_CASES, selectCases } from "../../bench/cases";
import { hardCheck, hardSection, withHardOverride, type HardCheck, type LintCase } from "../../bench/hard";
import { withForecasts } from "../../shared/agents/economics";

/** Items 12–13 of docs/growth-engine/library-gap-plan.md: case sets, and hard failures scored apart from the judge. */
describe("bench case sets", () => {
  it("the default and saas set are the unchanged B0 cases", () => {
    expect(selectCases(undefined)).toBe(CASES);
    expect(selectCases("saas").map((c) => c.id)).toEqual(["formkit", "meetrao", "involets", "taskeni", "folevi"]);
    expect(CASES.every((c) => c.type === "b2b_saas")).toBe(true);
  });

  it("mixed covers the six other business types, with a $0 and a ~$60 budget", () => {
    const mixed = selectCases("mixed");
    expect(mixed).toEqual(MIXED_CASES);
    expect(new Set(mixed.map((c) => c.type))).toEqual(new Set(["agency", "local_service", "local_food", "local_fitness", "b2c_app", "creator"]));
    expect(mixed.some((c) => c.monthlyAdBudget === 0)).toBe(true);
    expect(mixed.some((c) => c.monthlyAdBudget >= 40 && c.monthlyAdBudget <= 80)).toBe(true);
    for (const c of mixed) expect(c.goal.length > 10 && c.horizonDays > 0 && c.website.startsWith("https://")).toBe(true);
    expect(mixed.map((c) => c.id).filter((id) => CASES.some((s) => s.id === id))).toEqual([]);
  });

  it("sets and ids mix, keep order and drop duplicates", () => {
    expect(selectCases("all")).toEqual([...CASES, ...MIXED_CASES]);
    expect(selectCases("finch, formkit,finch").map((c) => c.id)).toEqual(["finch", "formkit"]);
    expect(selectCases("saas,saas,cfsbk").length).toBe(CASE_SETS.saas.length + 1);
  });

  it("an unknown name throws instead of silently running another set", () => {
    expect(() => selectCases("mixd")).toThrow(/Unknown case or set "mixd"/);
    expect(() => selectCases("formkit,fishwife")).toThrow(/fishwife/);
  });
});

// ---- fixture outputs (no network): one clean plan and the same plan breaking a hard check ----
const tag = { source: "assumption" as const, ref: "", quote: "" };
const planned = { source: "planned" as const, ref: "", quote: "" };
const lc: LintCase = {
  c: MIXED_CASES.find((c) => c.id === "cfsbk")!,
  brief: "BUSINESS: CrossFit South Brooklyn (https://crossfitsouthbrooklyn.com)\nGOAL: Get 20 new paying members in 60 days (horizon 60 days, ad budget 60 USD/month)",
  facts: ["The business has been operating since 2007.", "The community hosts the annual 'Fight Gone Bad' competition."],
  insights: "{}",
  scorecard: "",
};
const plays = withForecasts({
  portfolioNote: "One referral play the community can run now.",
  economics: { revenuePerCustomerMonthUsd: 200, grossMargin: 0.7, monthlyChurn: 0.05, basis: "assumption", sources: { revenue: tag, margin: tag, churn: tag } },
  plays: [
    {
      name: "Bring a friend Saturday",
      oneLiner: "Members bring a friend to a free Saturday class",
      kind: "bankable",
      audience: "Friends of current members",
      trigger: "Saturday community class",
      hook: "Train with me this Saturday",
      mechanic: "Member referral to a free class",
      assetUsed: "To build: a sign-up form for the Saturday class",
      route: "",
      funnel: ["Friends invited → attend: plan 40% [assumption, grade D]", "attend → join: plan 25% [assumption, grade D]"],
      unit: "new paying members",
      horizonDays: 60,
      confidence: "medium",
      biggestUnknown: "How many members invite someone",
      test: "4 Saturdays · $0",
      killIf: "Fewer than 2 joins after 4 Saturdays",
      scaleIf: "6+ joins after 4 Saturdays",
      scores: [5, 4, 4, 4, 3, 5, 5, 4],
      firstActionToday: "Build the Saturday sign-up form",
      climbosCanDo: "Drafts the invite and the form",
      model: { weeklyReach: 10, weeklyReachLow: 6, weeklyReachHigh: 14, reachSource: tag, steps: [{ name: "attend", rate: 0.4, low: 0.3, high: 0.5, ...tag }, { name: "join", rate: 0.25, low: 0.15, high: 0.35, ...tag }], monthlySpendUsd: 0, spendSource: planned, ownerHoursPerWeek: 2, hoursSource: planned },
    },
  ],
} as never) as unknown as { plays: { p50: number }[] };
const plan = (o: Record<string, unknown> = {}) => ({
  summary: "Referrals bring in new paying members by day 60 (estimate).",
  positioning: "A long-standing Brooklyn strength community.",
  audiences: [],
  channels: [{ name: "Member referrals", priority: 1, why: "Members already train together", dependsOn: [], measure: "joins", suggestedMonthlyAdSpend: 0 }],
  constraints: [],
  measurementPlan: "Count joins from the Saturday form each week.",
  firstActions: [],
  experiments: [],
  diagnosis: "Growth depends on word of mouth.",
  affordableCac: "Up to one month's fee (estimate).",
  notDoing: [],
  northStar: { metric: "New paying members", baseline: "unknown", target: `${Math.round(plays.plays[0].p50)} new paying members by day 60 (estimate)` },
  leadingIndicators: [],
  phases: [{ name: "Invite", days: "0–60", focus: "Members invite friends to the Saturday class." }],
  weekOneChecklist: ["Build the Saturday sign-up form"],
  risks: [],
  ...o,
});
const output = (o: Record<string, unknown> = {}) => ({ ...plan(o), ...plays, researchSources: [] });

describe("hard checks on saved outputs", () => {
  it("a clean fixture plan has no hard findings", () => {
    const h = hardCheck(output(), lc);
    expect(h.skipped).toBeUndefined();
    expect(h.findings).toEqual([]);
  });

  it("ad spend over the case budget is a hard budget failure on the final plan", () => {
    const h = hardCheck(output({ channels: [{ name: "Meta ads", priority: 1, why: "", dependsOn: [], measure: "", suggestedMonthlyAdSpend: 500 }] }), lc);
    expect(h.findings.some((f) => f.stage === "plan" && f.rule === "budget")).toBe(true);
    expect(h.rules.budget).toBe(1);
  });

  it("a North Star that contradicts the plays is a hard consistency failure", () => {
    const h = hardCheck(output({ northStar: { metric: "New paying members", baseline: "unknown", target: "400 new paying members by day 60" } }), lc);
    expect(h.rules.consistency).toBeGreaterThan(0);
  });

  it("scorecard rows saved in channels aren't linted as plan prose; the lost budget check is noted", () => {
    const rows = [{ name: "Member referrals", score: 76.9, status: "primary", why: "Fit 76.9 for a local gym" }];
    const h = hardCheck(output({ channels: rows }), lc);
    expect(h.findings).toEqual([]);
    expect(h.notes?.join(" ")).toMatch(/channel ad-spend budget check skipped/);
    // The arm's saved plan channels are checked instead.
    const live = hardCheck(output({ channels: rows }), lc, { notes: "", planChannels: [{ name: "Meta ads", priority: 1, why: "", dependsOn: [], measure: "", suggestedMonthlyAdSpend: 500 }] });
    expect(live.rules.budget).toBe(1);
  });

  it("an unsourced number in a play counts only when the research notes were saved", () => {
    const bad = { ...output(), plays: [{ ...(output().plays[0] as object), audience: "The 35,000 people who follow the gym" }] };
    const old = hardCheck(bad, lc);
    expect(old.findings).toEqual([]);
    expect(old.uncounted?.map((f) => f.rule)).toEqual(["invented_fact"]);
    expect(hardCheck(bad, lc, { notes: "" }).rules.invented_fact).toBe(1);
    expect(hardCheck(bad, lc, { notes: "Instagram: 35,000 followers" }).findings).toEqual([]);
  });

  it("outputs without plays (other tasks, the old engine) are skipped, not failed", () => {
    const h = hardCheck({ summary: "old schema" }, lc);
    expect(h.skipped).toMatch(/no plays/);
    expect(h.findings).toEqual([]);
  });
});

describe("hard failures override the judge", () => {
  const failed: HardCheck = { findings: [{ stage: "plan", rule: "budget", message: "over" }], rules: { budget: 1 } };
  const clean: HardCheck = { findings: [], rules: {} };
  const judged = (result: "win" | "loss" | "tie" | "error") => ({ result, reasons: ["judge"] });

  it("x failing loses even when the judge says win", () => {
    expect(withHardOverride(judged("win"), failed, clean)).toMatchObject({ result: "loss", judged: "win", hardOverride: "x_failed" });
  });
  it("y failing hands x the win", () => {
    expect(withHardOverride(judged("loss"), clean, failed)).toMatchObject({ result: "win", judged: "loss", hardOverride: "y_failed" });
    expect(withHardOverride(judged("error"), null, failed).result).toBe("win");
  });
  it("both failing is a loss: a failed plan never wins", () => {
    expect(withHardOverride(judged("win"), failed, failed)).toMatchObject({ result: "loss", hardOverride: "both_failed" });
  });
  it("no hard failure keeps the judge's call; skipped checks don't count", () => {
    expect(withHardOverride(judged("tie"), clean, clean)).toEqual({ result: "tie", reasons: ["judge"], judged: "tie" });
    expect(withHardOverride(judged("win"), { findings: [], rules: {}, skipped: "no plays" }, undefined).result).toBe("win");
  });

  it("end to end on fixture outputs: the judge's win becomes a loss and the report shows why", () => {
    const hard = { basic: hardCheck(output({ channels: [{ name: "Meta ads", priority: 1, why: "", dependsOn: [], measure: "", suggestedMonthlyAdSpend: 500 }] }), lc), b0: hardCheck(output(), lc) };
    const cmp = withHardOverride(judged("win"), hard.basic, hard.b0);
    expect(cmp.result).toBe("loss");
    const md = hardSection([{ case: "cfsbk", task: "strategy", hard }], ["basic", "b0"]).join("\n");
    expect(md).toMatch(/\| basic \| 1 \| 1 \| budget ×1 \| – \|/);
    expect(md).toMatch(/\| b0 \| 1 \| 0 \| – \| – \|/);
    expect(md).toMatch(/cfsbk\/strategy basic\*\*: plan budget @ channels/);
  });
});
