import { describe, expect, it } from "vitest";
import { diagnose, diagnosisBrief, lintDiagnosisFit, playStage } from "../../shared/agents/diagnosis";
import { choosePlaybooks, eligibility, lintEligibility, lintEligibilityIds, playbookBrief, PLAYBOOKS, type PlaybookContext } from "../../shared/playbooks/contracts";

/** Cycle 2: diagnosis decided in code from the owner's numbers; playbooks gated by typed contracts. */
describe("diagnosis", () => {
  it("EV01: 100 trials → 12 first value → 3 paid is an activation problem", () => {
    const d = diagnose({ funnel: { periodDays: 30, leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "activation", basis: "measured" });
    expect(diagnosisBrief(d)).toMatch(/binding constraint is activation/);
    expect(d.competing).toMatch(/wrong fit/);
  });
  it("capacity binds before anything else (EV09-like)", () => {
    expect(diagnose({ funnel: { newCustomers: 9 }, newCustomersPerMonth: 10 }).constraint).toBe("delivery");
  });
  it("SaaS churn above the reference is a retention problem", () => {
    expect(diagnose({ monthlyChurn: 0.12, types: ["b2b_saas"] }).constraint).toBe("retention");
    expect(diagnose({ monthlyChurn: 0.12, types: ["local_services"] }).constraint).toBe("unknown");
  });
  it("activated users who don't pay point to conversion", () => {
    expect(diagnose({ funnel: { leads: 100, activated: 60, newCustomers: 3 }, types: ["b2b_saas"] }).constraint).toBe("conversion");
  });
  it("healthy conversion with few visitors is demand", () => {
    expect(diagnose({ funnel: { visitors: 300, leads: 40, newCustomers: 10 }, types: ["b2b_saas"] }).constraint).toBe("demand");
  });
  it("no numbers → unknown, with what to measure (never a guess)", () => {
    const d = diagnose({});
    expect(d).toMatchObject({ constraint: "unknown", basis: "none" });
    expect(diagnosisBrief(d)).toMatch(/missing: visitors in the period, signups or leads/);
  });
  it("plays must work on a measured activation constraint", () => {
    const d = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    expect(lintDiagnosisFit([{ name: "Google Ads test", oneLiner: "Buy more trial traffic" }], d)).toMatchObject([{ rule: "diagnosis_fit" }]);
    expect(lintDiagnosisFit([{ name: "Onboarding fix", oneLiner: "Remove the setup step where trials stall" }], d)).toEqual([]);
    expect(lintDiagnosisFit([{ name: "Ads" }], diagnose({}))).toEqual([]);
    expect(playStage("win-back email for cancelled customers")).toBe("retention");
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
    expect(eligibility(search, ctx({ budgetUsd: 60, priceUsdMonth: 50 })).eligible).toBe(false);
    expect(eligibility(search, ctx({ budgetUsd: 600, priceUsdMonth: 6 })).reasons.join(" ")).toMatch(/\$25/);
    expect(eligibility(search, ctx({ budgetUsd: 600, priceUsdMonth: 50 })).eligible).toBe(true);
    const split = PLAYBOOKS.find((p) => p.id === "PB-landing-split")!;
    expect(eligibility(split, ctx({ weeklyVisitors: 12 })).eligible).toBe(false);
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
    const c = choosePlaybooks(ctx({ budgetUsd: 50, priceUsdMonth: 6 }));
    const plays = [{ name: "Google Ads sprint", oneLiner: "Run Google Ads on 'form builder'" }];
    expect(lintEligibility(plays, c)).toMatchObject([{ rule: "eligibility", path: "plays[0]" }]);
    expect(lintEligibilityIds(plays, c.ineligible.map(({ pb, reasons }) => ({ id: pb.id, reasons })))).toHaveLength(1);
    expect(lintEligibility([{ name: "Comparison pages", oneLiner: "Pages vs the top alternatives" }], c)).toEqual([]);
  });
});
