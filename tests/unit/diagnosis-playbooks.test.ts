import { describe, expect, it } from "vitest";
import { diagnose, diagnosisBrief, lintDiagnosisFit, playStage } from "../../shared/agents/diagnosis";
import { choosePlaybooks, eligibility, lintEligibility, lintEligibilityIds, playbookBrief, PLAYBOOKS, type PlaybookContext } from "../../shared/playbooks/contracts";

/** Cycle 2: diagnosis decided in code from the owner's numbers; playbooks gated by typed contracts. */
describe("diagnosis", () => {
  it("EV01: 100 trials → 12 first value → 3 paid points to activation as an observation, not a proven cause", () => {
    const d = diagnose({ funnel: { periodDays: 30, leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "activation", basis: "measured", status: "supported" });
    expect(diagnosisBrief(d)).toMatch(/point to activation as the weakest link\. This is an observation/);
    expect(d.competing).toMatch(/wrong fit/);
  });
  it("does not compare current sales with a limit that means additional capacity", () => {
    const d = diagnose({ funnel: { periodDays: 30, newCustomers: 20 }, newCustomersPerMonth: 10 });
    expect(d.constraint).toBe("unknown");
    expect(d.readings.find((reading) => reading.stage === "capacity")).toMatchObject({ rate: null, verdict: "unknown", observed: "room for up to 10 additional new customers a month (owner reported)" });
    expect(diagnosisBrief(d)).not.toContain("near owner-stated capacity");
  });
  it("treats a confirmed zero-customer capacity as a delivery constraint without creating infinite rates", () => {
    const d = diagnose({ newCustomersPerMonth: 0 });
    expect(d).toMatchObject({ constraint: "delivery", status: "supported" });
    expect(d.readings.find((reading) => reading.stage === "capacity")).toMatchObject({ rate: null, verdict: "weak" });
    expect(d.hypotheses?.[0]?.support).toContain("The owner reported no remaining capacity for additional customers.");
    expect(JSON.parse(JSON.stringify(d))).toMatchObject({ constraint: "delivery" });
  });
  it("resolves invalid capacity inputs instead of treating them as measurements", () => {
    expect(diagnose({ newCustomersPerMonth: Number.NaN })).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
    expect(diagnose({ funnel: { visitors: 10, leads: 12 }, newCustomersPerMonth: 0 })).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
  });
  it("rejects fractional funnel counts instead of rounding them into posterior evidence", () => {
    const diagnosis = diagnose({ funnel: { visitors: 10.5, leads: 2, periodDays: 30 }, types: ["b2b_saas"] });
    expect(diagnosis).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
    expect(diagnosis.conflicts).toContain("visitors must be a whole count between 0 and 100,000,000.");
    expect(diagnosis.readings).toEqual([]);
  });
  it("rejects invalid churn and sales-cycle inputs before reading retention or maturity", () => {
    for (const monthlyChurn of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      const diagnosis = diagnose({ monthlyChurn, types: ["b2b_saas"] });
      expect(diagnosis).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
      expect(diagnosis.conflicts).toContain("Monthly churn must be a share between 0 and 100%.");
      expect(diagnosis.readings.some((reading) => reading.stage === "retention")).toBe(false);
    }
    for (const salesCycleDays of [0, -30, Number.NaN, Number.POSITIVE_INFINITY]) {
      const diagnosis = diagnose({ funnel: { periodDays: 30, leads: 10, activated: 5, newCustomers: 1 }, salesCycleDays });
      expect(diagnosis).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
      expect(diagnosis.conflicts).toContain("Sales cycle length must be a number of days greater than zero.");
    }
  });
  it("rejects an explicitly invalid measurement period instead of silently assuming 30 days", () => {
    for (const periodDays of [0, -14, Number.NaN, Number.POSITIVE_INFINITY]) {
      const diagnosis = diagnose({ funnel: { periodDays, visitors: 300, leads: 30, activated: 15, newCustomers: 3 }, newCustomersPerMonth: 10 });
      expect(diagnosis).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
      expect(diagnosis.conflicts).toContain("The measurement period must be a number of days greater than zero.");
    }
  });
  it("SaaS churn above the reference is a retention problem", () => {
    expect(diagnose({ monthlyChurn: 0.12, types: ["b2b_saas"] }).constraint).toBe("retention");
    expect(diagnose({ monthlyChurn: 0, types: ["b2b_saas"] })).toMatchObject({ constraint: "unknown", status: "insufficient_evidence" });
    expect(diagnose({ monthlyChurn: 0.12, types: ["local_services"] }).constraint).toBe("unknown");
  });
  it("activated users who don't pay point to conversion", () => {
    expect(diagnose({ funnel: { leads: 100, activated: 60, newCustomers: 3 }, types: ["b2b_saas"] }).constraint).toBe("conversion");
  });
  it("healthy conversion with few visitors is demand", () => {
    expect(diagnose({ funnel: { visitors: 300, leads: 40, newCustomers: 10, signupKind: "trial_no_card" }, types: ["b2b_saas"] }).constraint).toBe("demand");
    // Without the signup model there is no reference, so "healthy" can't be judged (decision books: CG-02).
    const unknownModel = diagnose({ funnel: { visitors: 300, leads: 40, newCustomers: 10 }, types: ["b2b_saas"] });
    expect(unknownModel.constraint).toBe("unknown");
    expect(unknownModel.missing.join(" ")).toMatch(/free plan, a trial without a card/);
  });
  it("no numbers → unknown, with what to measure (never a guess)", () => {
    const d = diagnose({});
    expect(d).toMatchObject({ constraint: "unknown", basis: "none" });
    expect(d.nextMeasurement).toMatchObject({ priority: "decision_critical" });
    expect(d.nextMeasurement?.action).toMatch(/Count new paying customers/);
    expect(diagnosisBrief(d)).toMatch(/NEXT MEASUREMENT \(needed before a firm decision\)/);
    expect(diagnosisBrief(d)).not.toMatch(/visitors in the period, signups or leads/);
  });
  it("asks for the one missing count that separates the remaining funnel explanations", () => {
    const d = diagnose({ funnel: { periodDays: 30, visitors: 300, newCustomers: 10 } });
    expect(d.nextMeasurement).toMatchObject({ action: expect.stringMatching(/Count how many of those 300 visitors became leads/), priority: "useful" });
    expect(d.missing.length).toBeGreaterThan(1);
  });
  it("plays must work on a measured activation constraint", () => {
    const d = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    expect(lintDiagnosisFit([{ name: "Google Ads test", oneLiner: "Buy more trial traffic" }], d)).toMatchObject([{ rule: "diagnosis_fit" }]);
    expect(lintDiagnosisFit([{ name: "Onboarding fix", oneLiner: "Remove the setup step where trials stall" }], d)).toEqual([]);
    expect(lintDiagnosisFit([{ name: "Ads" }], diagnose({}))).toEqual([]);
    expect(playStage("win-back email for cancelled customers")).toBe("retention");
  });
  it("does not mistake an unclassified play for demand generation", () => {
    const d = diagnose({ funnel: { visitors: 300, leads: 40, newCustomers: 10, signupKind: "trial_no_card" }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "demand", status: "supported" });
    expect(lintDiagnosisFit([{ name: "Improve the pricing page", oneLiner: "Clarify the plan comparison" }], d)).toMatchObject([{ rule: "diagnosis_fit" }]);
    expect(lintDiagnosisFit([{ name: "Search ads", oneLiner: "Reach more qualified visitors" }], d)).toEqual([]);
  });
});

describe("playbook contracts", () => {
  const ctx = (o: Partial<PlaybookContext> = {}): PlaybookContext => ({ types: ["b2b_saas"], budgetUsd: 600, connected: [], constraint: "unknown", ...o });
  it("every contract is complete", () => {
    for (const pb of PLAYBOOKS) {
      for (const k of ["decision", "appliesWhen", "avoidWhen", "outcome", "guardrail", "stop", "revise", "expand", "source"] as const) expect(pb[k], `${pb.id}.${k}`).toBeTruthy();
      expect(pb.steps.length, pb.id).toBeGreaterThan(1);
      for (const a of pb.alternatives) expect(PLAYBOOKS.some((x) => x.id === a), `${pb.id} → ${a}`).toBe(true);
    }
  });
  it("gates by budget, price, traffic, audience, connection, type and place", () => {
    const search = PLAYBOOKS.find((p) => p.id === "PB-paid-search-test")!;
    // Decision books: a small budget is a preference, not a ban; no budget at all is hard; CPC unknown is "check first".
    expect(eligibility(search, ctx({ budgetUsd: 0, priceUsdMonth: 50 })).eligible).toBe(false);
    expect(eligibility(search, ctx({ budgetUsd: 60, priceUsdMonth: 50 }))).toMatchObject({ eligible: true, status: "needs_evidence", unknown: ["cost per click for your search terms"] });
    expect(eligibility(search, ctx({ budgetUsd: 60, priceUsdMonth: 50, cpcUsd: 2 }))).toMatchObject({ eligible: true, status: "low_priority" });
    expect(eligibility(search, ctx({ budgetUsd: 600, priceUsdMonth: 6, cpcUsd: 2 })).soft.join(" ")).toMatch(/\$25/);
    expect(eligibility(search, ctx({ budgetUsd: 600, priceUsdMonth: 50, cpcUsd: 2 })).status).toBe("eligible");
    const split = PLAYBOOKS.find((p) => p.id === "PB-landing-split")!;
    expect(eligibility(split, ctx({ weeklyVisitors: 12 })).eligible).toBe(false);
    // Readability is sized on the owner's own rate: 400 a week at a 20% lead rate fits in 6 weeks; at 2% it doesn't.
    expect(eligibility(split, ctx({ weeklyVisitors: 400, leadRate: 0.2 })).eligible).toBe(true);
    expect(eligibility(split, ctx({ weeklyVisitors: 400, leadRate: 0.02 })).reasons.join(" ")).toMatch(/2% lead rate needs about \d+ weeks/);
    expect(eligibility(split, ctx({})).unknown).toEqual(["weekly visitors"]);
    const email = PLAYBOOKS.find((p) => p.id === "PB-lifecycle-email")!;
    expect(eligibility(email, ctx({ emailAudience: 0 })).eligible).toBe(false);
    const cold = PLAYBOOKS.find((p) => p.id === "PB-cold-outreach")!;
    expect(eligibility(cold, ctx({ priceUsdMonth: 300 })).reasons.join(" ")).toMatch(/own mailbox/);
    const local = PLAYBOOKS.find((p) => p.id === "PB-local-listing")!;
    expect(eligibility(local, ctx({ geography: "national" })).eligible).toBe(false);
  });
  it("orders playbooks that work on the constraint first and names fallbacks", () => {
    const c = choosePlaybooks(ctx({ constraint: "activation", emailAudience: 0, weeklyVisitors: 50 }));
    expect(c.eligible[0].pb.worksOn).toContain("activation");
    const brief = playbookBrief(c);
    expect(brief).toMatch(/NOT ELIGIBLE NOW/);
    expect(brief).toMatch(/Lifecycle email to consented contacts: needs consented contacts.*Instead: First-value repair or Build a consented list/);
  });
  it("blocks plays built on an ineligible playbook, from the choice or from saved ids", () => {
    const c = choosePlaybooks(ctx({ budgetUsd: 0, priceUsdMonth: 6 })); // no ad budget at all: paid search is blocked (hard)
    const plays = [{ name: "Google Ads sprint", oneLiner: "Run Google Ads on 'form builder'" }];
    expect(lintEligibility(plays, c)).toMatchObject([{ rule: "eligibility", path: "plays[0]" }]);
    expect(lintEligibilityIds(plays, c.ineligible.map(({ pb, reasons }) => ({ id: pb.id, reasons })))).toHaveLength(1);
    expect(lintEligibility([{ name: "Comparison pages", oneLiner: "Pages vs the top alternatives" }], c)).toEqual([]);
  });
});
