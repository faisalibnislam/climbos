import { describe, expect, it } from "vitest";
import { DECISION_CONTRACT, playsTask } from "../../shared/agents/planTasks";
import { growthPlaysSpec, lintPlays, type PlayDraft } from "../../shared/agents/specs";

/** S5 flag (REQ-STRAT-05, REQ-OUT-03): a focused plan isn't forced into bankable + creative. */
const tag = { source: "assumption" as const, ref: "", quote: "" };
const play = (o: Partial<PlayDraft> = {}): PlayDraft => ({
  name: "Win back lapsed customers",
  oneLiner: "Email past customers a reason to return",
  kind: "creative",
  audience: "Customers who stopped ordering in the last 12 months (about 300)",
  trigger: "Seasonal menu change",
  hook: "Your old favourite is back",
  mechanic: "Win-back email with a one-week offer",
  assetUsed: "Customer list",
  funnel: ["300 emails → opens: 30–50%, plan 40% [assumption, grade D]", "opens → orders: 5–10%, plan 7% [assumption, grade D]"],
  unit: "returning customers",
  horizonDays: 30,
  confidence: "medium",
  biggestUnknown: "How many addresses still work",
  test: "300 emails · $0 · 14 days",
  killIf: "Fewer than 3 orders in 14 days",
  scaleIf: "8+ orders in 14 days",
  scores: [5, 3, 3, 4, 3, 5, 5, 3],
  firstActionToday: "Export last year's customers",
  climbosCanDo: "Drafts and sends the emails",
  model: { weeklyReach: 75, weeklyReachLow: 60, weeklyReachHigh: 75, reachSource: tag, steps: [{ name: "open", rate: 0.4, low: 0.3, high: 0.5, ...tag, source: "assumption" }, { name: "order", rate: 0.07, low: 0.05, high: 0.1, ...tag, source: "assumption" }], monthlySpendUsd: 0, spendSource: { source: "planned", ref: "", quote: "" }, ownerHoursPerWeek: 1, hoursSource: { source: "planned", ref: "", quote: "" } },
  ...o,
});
const econ = { revenuePerCustomerMonthUsd: 40, grossMargin: 0.6, monthlyChurn: 0.1, basis: "" };
const portfolio = (issues: { rule: string; severity: string }[]) => issues.filter((i) => i.rule === "portfolio" && i.severity === "error");

describe("decision contract flag", () => {
  it("off (default): a single retention play fails the fixed portfolio shape", () => {
    expect(portfolio(lintPlays([play()], econ)).length).toBeGreaterThan(0);
  });

  it("on: one focused retention play is a valid plan; no volume pressure", () => {
    expect(portfolio(lintPlays([play()], econ, { decisionContract: true }))).toEqual([]);
  });

  it("on: still at most 4 plays, one moonshot, and 'bankable' must be predictable", () => {
    expect(portfolio(lintPlays([1, 2, 3, 4, 5].map((i) => play({ name: `P${i}` })), econ, { decisionContract: true })).length).toBe(1);
    expect(portfolio(lintPlays([play({ kind: "moonshot" }), play({ kind: "moonshot", name: "M2" })], econ, { decisionContract: true })).length).toBe(1);
    expect(portfolio(lintPlays([play({ kind: "bankable" })], econ, { decisionContract: true }))[0]).toBeTruthy(); // predictability 3
  });

  it("the spec and task follow the flag; the default task is unchanged", () => {
    const on = growthPlaysSpec({ decisionContract: true });
    expect(portfolio(on.lint!({ portfolioNote: "", economics: { ...econ, sources: { revenue: tag, margin: tag, churn: tag } }, plays: [play()] } as never, { task: "", brief: "", facts: [] } as never))).toEqual([]);
    expect(playsTask({ scorecard: "", insights: "", decisionContract: true })).toContain(DECISION_CONTRACT);
    expect(playsTask({ scorecard: "", insights: "" })).toMatch(/one bankable play, one or two creative-but-proven plays/);
    expect(playsTask({ scorecard: "", insights: "" })).not.toContain("DECISION CONTRACT");
  });
});
