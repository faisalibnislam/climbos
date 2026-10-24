import { playMaths } from "../../shared/agents/economics";
import { describe, expect, it } from "vitest";
import { DECISION_CONTRACT, playsTask } from "../../shared/agents/planTasks";
import { actionReadinessOf, growthPlaysSpec, lintActionContracts, lintPlays, type PlayDraft } from "../../shared/agents/specs";

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
  route: "",
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
  actionContract: { diagnosis: "Repeat purchase is weak", intendedEffect: "Recover paid orders", evidenceBasis: "assumption", evidenceNote: "The customer list size and response are unverified; validate while testing.", evidenceRefs: [], targetOrAsset: "Prior customer list", resourcePlan: "1 owner hour per week; no media spend", executionCapability: "owner", dependencies: [], measurement: { metric: "Recovered orders", baseline: "Establish from the prior 30 days", target: "8 orders", windowDays: 14, source: "Count paid orders during the test" } },
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
    expect(portfolio(lintPlays(["Referral ask", "Partner webinar", "Directory listing", "Review request", "Local press"].map((n) => play({ name: n, mechanic: `${n} campaign` })), econ, { decisionContract: true })).length).toBe(1);
    expect(portfolio(lintPlays([play({ kind: "moonshot" }), play({ kind: "moonshot", name: "Billboard stunt", mechanic: "Guerrilla billboard near the stadium" })], econ, { decisionContract: true })).length).toBe(1);
    // Decision books (Hubbard Ch 6/14): with economics known, computed robustness decides "bankable", not the model's score.
    expect(portfolio(lintPlays([play({ kind: "bankable" })], econ, { decisionContract: true }))).toEqual([]); // robust despite predictability 3
    const fragile = play({ kind: "bankable", model: { ...play().model!, ownerHoursPerWeek: 6 } });
    expect(playMaths(fragile as never, econ as never).robustness).toBe("fragile");
    expect(portfolio(lintPlays([fragile], econ, { decisionContract: true }))[0]).toBeTruthy();
    // Without economics the score still gates.
    expect(portfolio(lintPlays([play({ kind: "bankable" })], undefined, { decisionContract: true }))[0]).toBeTruthy(); // predictability 3
  });

  it("the spec and task follow the flag; the default task is unchanged", () => {
    const on = growthPlaysSpec({ decisionContract: true });
    expect(portfolio(on.lint!({ portfolioNote: "", economics: { ...econ, sources: { revenue: tag, margin: tag, churn: tag } }, plays: [play()] } as never, { task: "", brief: "", facts: [] } as never))).toEqual([]);
    expect(playsTask({ scorecard: "", insights: "", decisionContract: true })).toContain(DECISION_CONTRACT);
    expect(playsTask({ scorecard: "", insights: "" })).toMatch(/one bankable play, one or two creative-but-proven plays/);
    expect(playsTask({ scorecard: "", insights: "" })).not.toContain("DECISION CONTRACT");
  });
});

describe("structured action contracts", () => {
  it("derives safe-to-start versus dependency-gated readiness", () => {
    expect(actionReadinessOf(play().actionContract)).toEqual({ status: "safe_to_start", reasons: [] });
    expect(actionReadinessOf({ ...play().actionContract, dependencies: ["Confirm the customer list is consented"] })).toEqual({ status: "depends_on_input", reasons: ["Confirm the customer list is consented"] });
    expect(actionReadinessOf({ ...play().actionContract, executionCapability: "external_setup" })).toEqual({ status: "depends_on_input", reasons: ["External setup is required."] });
    expect(actionReadinessOf({ ...play().actionContract, executionCapability: "existing_integration" }).status).toBe("depends_on_input");
    expect(actionReadinessOf({ ...play().actionContract, executionCapability: "climbos" }).status).toBe("depends_on_input");
  });

  it("rejects invented evidence references and measurement windows past the horizon", () => {
    const draft = play({ actionContract: { ...play().actionContract, evidenceRefs: ["fact:4", "https://invented.example/pricing"], measurement: { ...play().actionContract.measurement, windowDays: 45 } } });
    const issues = lintActionContracts([draft], 1, "https://real.example/pricing", 30, ["https://real.example/pricing"]);
    expect(issues.filter((issue) => issue.severity === "error").map((issue) => issue.rule)).toEqual(["action_evidence", "action_evidence", "action_measurement"]);
  });

  it("makes the plays agent populate the trace and leaves readiness to code", () => {
    const prompt = playsTask({ scorecard: "", insights: "" });
    expect(prompt).toContain("fill actionContract");
    expect(prompt).toContain("ClimbOS derives readiness");
  });
});

/** Regression shapes from the 2026-10-19 paid check (B1 losses on Folevi and Formkit). */
describe("plan checks from the regression run", () => {
  const issue = (issues: { rule: string; message: string }[], re: RegExp) => issues.some((i) => re.test(i.message));
  it("an empty plays list is a hard no_plays failure", async () => {
    const { HARD_RULES } = await import("../../shared/agents/quality");
    const issues = lintPlays([], econ);
    expect(issues.some((i) => i.rule === "no_plays")).toBe(true);
    expect(HARD_RULES.has("no_plays")).toBe(true);
  });

  it("a unit that isn't a paying outcome (visits, events) is an economics error", () => {
    const issues = lintPlays([play({ unit: "organic page visit", model: { ...play().model, steps: [{ name: "Organic page visit to free signup", rate: 0.03, low: 0.01, high: 0.05, source: "assumption", ref: "", quote: "" }] } })], econ, { decisionContract: true });
    expect(issues.some((i) => i.rule === "economics" && /isn't a paying outcome/.test(i.message))).toBe(true);
  });

  it("a customer unit whose funnel stops at a click or sign-up is flagged; ending at paid is fine", () => {
    const stopsAtClick = play({ unit: "paying accounts", model: { ...play().model, steps: [{ name: "Delivered email to click", rate: 0.05, low: 0.02, high: 0.08, source: "assumption", ref: "", quote: "" }] } });
    expect(issue(lintPlays([stopsAtClick], econ, { decisionContract: true }), /isn't a paying/)).toBe(true);
    const toPaid = play({ unit: "paying accounts", model: { ...play().model, steps: [{ name: "Free signup → paid", rate: 0.05, low: 0.02, high: 0.08, source: "assumption", ref: "", quote: "" }] } });
    expect(issue(lintPlays([toPaid], econ, { decisionContract: true }), /isn't a paying/)).toBe(false);
  });

  it("the same move twice is flagged", () => {
    const a = play({ name: "Comparison page refresh", mechanic: "Refresh the comparison page with a free-plan call to action" });
    const b = play({ name: "Comparison page refresh test", mechanic: "Refresh the comparison page and test the free-plan call to action" });
    expect(issue(lintPlays([a, b], econ, { decisionContract: true }), /repeats/)).toBe(true);
  });

  it("the default plays task keeps the ambition that won the first check, with distinct moves and an honest gap", () => {
    const t = playsTask({ scorecard: "", insights: "" });
    expect(t).toMatch(/Be ambitious/);
    expect(t).toMatch(/distinct move/);
    expect(t).toMatch(/ClimbOS shows the owner the gap/);
  });
});
