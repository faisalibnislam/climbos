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
  timingAssessment: { decision: "not_relevant", proposedWindow: null, timezone: null, timezoneBasis: "No calendar timing applies.", timezoneEvidenceRef: null, geographyBasis: "No calendar-specific geography is needed for this evergreen retention test.", geographyEvidenceRef: null, moment: { name: null, businessReason: "This customer win-back mechanic is based on lifecycle behavior, not a date.", evidence: [] }, preparation: { leadTimeDays: null, deliveryLeadTimeDays: null, feasible: null, basis: "No event preparation window applies.", evidenceRef: null, deliveryBasis: "Not applicable to this evergreen test.", deliveryEvidenceRef: null }, capacity: { status: "unknown", basis: "Service capacity was not supplied.", evidenceRef: null }, assumptions: [], unknowns: [], rationale: "The play's trigger is customer behavior rather than a holiday or event." },
  actionContract: { diagnosis: "Repeat purchase is weak", intendedEffect: "Recover paid orders", evidenceBasis: "assumption", evidenceNote: "The customer list size and response are unverified; validate while testing.", evidenceRefs: [], targetOrAsset: "Prior customer list", resourcePlan: "1 owner hour per week; no media spend", executionCapability: "owner", dependencies: [], measurement: { metric: "Recovered orders", baseline: "Establish from the prior 30 days", target: "8 orders", windowDays: 14, source: "Count paid orders during the test" } },
  climbosCanDo: "Drafts and sends the emails",
  model: { weeklyReach: 75, weeklyReachLow: 60, weeklyReachHigh: 75, reachSource: tag, steps: [{ name: "open", rate: 0.4, low: 0.3, high: 0.5, ...tag, source: "assumption" }, { name: "order", rate: 0.07, low: 0.05, high: 0.1, ...tag, source: "assumption" }], monthlySpendUsd: 0, spendSource: { source: "planned", ref: "", quote: "" }, ownerHoursPerWeek: 1, hoursSource: { source: "planned", ref: "", quote: "" } },
  ...o,
});
const econ = { revenuePerCustomerMonthUsd: 40, grossMargin: 0.6, monthlyChurn: 0.1, basis: "" };
const portfolio = (issues: { rule: string; severity: string }[]) => issues.filter((i) => i.rule === "portfolio" && i.severity === "error");

describe("decision contract flag", () => {
  it("treats open invoice balances as owner-review evidence, not collection permission", () => {
    expect(DECISION_CONTRACT).toContain("An open balance is not expected or recoverable revenue");
    expect(DECISION_CONTRACT).toContain("Do not retry payments, send reminders, or contact customers as a side effect");
    expect(DECISION_CONTRACT).toContain("treat receivables and failed-payment recovery as unknown");
  });

  it("off (default): a single retention play fails the fixed portfolio shape", () => {
    expect(portfolio(lintPlays([play()], econ)).length).toBeGreaterThan(0);
  });

  it("on: one focused retention play is a valid plan; no volume pressure", () => {
    expect(portfolio(lintPlays([play()], econ, { decisionContract: true }))).toEqual([]);
  });

  it("hard-fails a bare channel label while accepting a business-specific mechanic", () => {
    const generic = play({ mechanic: "Use influencers", audience: "Everyone", hook: "Build awareness", firstActionToday: "Find influencers" });
    const concrete = play({ mechanic: "Send 10 local coach YouTubers a tracked invite to the existing booking-workshop page.", audience: "Local coaches who publish scheduling advice", firstActionToday: "Select 10 coach channels from the researched list and draft the workshop invite." });
    const genericIssues = lintPlays([generic], econ, { decisionContract: true });
    expect(genericIssues.some((issue) => issue.rule === "generic_action" && issue.severity === "error")).toBe(true);
    expect(lintPlays([concrete], econ, { decisionContract: true }).some((issue) => issue.rule === "generic_action")).toBe(false);
    expect(playsTask({ scorecard: "", insights: "" })).toContain("A channel name is not a deliverable");
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

  it("the structured fields follow the flag while every default task uses constraint-first strategy", () => {
    const on = growthPlaysSpec({ decisionContract: true });
    expect(portfolio(on.lint!({ portfolioNote: "", economics: { ...econ, sources: { revenue: tag, margin: tag, churn: tag } }, plays: [play()] } as never, { task: "", brief: "", facts: [] } as never))).toEqual([]);
    expect(playsTask({ scorecard: "", insights: "", decisionContract: true })).toContain(DECISION_CONTRACT);
    const defaultTask = playsTask({ scorecard: "", insights: "" });
    expect(defaultTask).toContain(DECISION_CONTRACT);
    expect(defaultTask).toContain("COMMERCIAL EVIDENCE GATE");
    expect(defaultTask).toContain("When business-specific evidence of customer demand or willingness to pay is insufficient or mixed");
    expect(defaultTask).toContain("keep any acquisition spend bounded to the test");
    expect(defaultTask).toContain("Never infer viability from a polished website");
    expect(defaultTask).toContain("STRATEGY EXPLORATION");
    expect(defaultTask).toContain("adjacent industries, emerging behavior, unusual partnerships, product changes and non-obvious distribution mechanisms");
    expect(defaultTask).toContain("don't discard a promising idea just because ClimbOS cannot execute it today");
    expect(defaultTask).toContain("grounded, adjacent, and bold");
    expect(defaultTask).toContain("bold may have no direct precedent");
    expect(defaultTask).toContain("low evidence, low business fit, low feasibility, or high risk");
    expect(defaultTask).toContain("Exploration is not execution");
    expect(defaultTask).toMatch(/best-supported binding constraint/);
    expect(defaultTask).not.toMatch(/one bankable play, one or two creative-but-proven plays/);
    expect(defaultTask).not.toContain("Fill decision");
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

  it("requires the primary success metric to match the outcome forecast by the play", () => {
    const clicks = play({ actionContract: { ...play().actionContract, measurement: { ...play().actionContract.measurement, metric: "Website clicks" } } });
    const qualifiedLeads = play({ actionContract: { ...play().actionContract, measurement: { ...play().actionContract.measurement, metric: "Qualified leads" } } });
    const valid = play({ actionContract: { ...play().actionContract, measurement: { ...play().actionContract.measurement, metric: "Recovered orders" } } });
    expect(lintActionContracts([clicks], 0, "").map((issue) => issue.path)).toContain("plays[0].actionContract.measurement.metric");
    expect(lintActionContracts([qualifiedLeads], 0, "").some((issue) => /does not match this play's forecast outcome/.test(issue.message))).toBe(true);
    expect(lintActionContracts([valid], 0, "")).toEqual([]);
  });

  it("makes the plays agent populate the trace and leaves readiness to code", () => {
    const prompt = playsTask({ scorecard: "", insights: "" });
    expect(prompt).toContain("populate actionContract");
    expect(prompt).toContain("primary measurement that matches the same business outcome as the play's forecast unit");
    expect(prompt).toContain("ClimbOS derives readiness");
  });

  it("requires creative dimensions to stay separate and rejects precedent IDs outside the retrieved library", () => {
    const creativeReview = {
      challenge: "A polished mascot is not always more memorable.", conventionBasis: "common_habit" as const,
      costOfBreaking: "A distinctive character could distract from the offer.", customerTensionOrAsset: "Customers remember the founder's repair stories.",
      precedentIds: ["CP-004"], transferLogic: "Constraint-led recognition can make a recurring identity easier to remember.", keyDifferences: "Nintendo had games and distribution at scale; this is a small service business.",
      hopedCustomerBehavior: "Target buyers recall the service and ask about a repair.", assumptions: ["Target buyers like the founder's humor."],
      novelty: "high" as const, evidenceStrength: "medium" as const, businessFit: "medium" as const, feasibility: "high" as const, risk: "medium" as const,
      reversibleTest: "Show two original sketches to six target customers.", successSignal: "More customers correctly recall the service.", guardrail: "Offer comprehension does not fall.", stopCondition: "Stop if recall or offer comprehension declines.", revisionEvidence: "Revise if buyers find the character distracting.",
    };
    expect(lintPlays([play({ creativeReview })], econ, { decisionContract: true }).some((issue) => issue.rule === "creative_precedent")).toBe(false);
    const invalid = { ...creativeReview, precedentIds: ["CP-999"] };
    expect(lintPlays([play({ creativeReview: invalid })], econ, { decisionContract: true }).some((issue) => issue.rule === "creative_precedent" && issue.severity === "error")).toBe(true);
    const unsupported = { ...creativeReview, precedentIds: [], evidenceStrength: "high" as const };
    expect(lintPlays([play({ creativeReview: unsupported })], econ, { decisionContract: true }).some((issue) => issue.rule === "creative_evidence" && issue.severity === "warn")).toBe(true);
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
