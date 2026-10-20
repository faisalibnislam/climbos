import { describe, expect, it } from "vitest";
import { betaPosterior, probBelow, probLess, poissonCdf } from "../../shared/analysis/bayes";
import { compareRates } from "../../shared/analysis/decisions";
import { diagnose, diagnosisBrief } from "../../shared/agents/diagnosis";
import { combinePlays, lintEconomics, playMaths, portfolioRange, selectPortfolio, type Economics, type PlayLike } from "../../shared/agents/economics";
import { lintFeasibility } from "../../shared/agents/specs";
import { playActuals } from "../../shared/growth/actuals";
import { diagnoseShortfall } from "../../shared/growth/diagnostics";
import { PLAYBOOKS, eligibility, type PlaybookContext } from "../../shared/playbooks/contracts";
import { decide } from "../../shared/abtest";

/**
 * Decision books (2026-10-20): the owner's acceptance cases (prompt §7, 1–12) and the
 * before/after examples from the reading. All inputs are hypothetical.
 */
const econ: Economics = { revenuePerCustomerMonthUsd: 100, grossMargin: 0.8, monthlyChurn: 0.05, basis: "test", assumed: [] };
const play = (name: string, o: Partial<PlayLike["model"]> = {}, kind = "bankable", horizonDays = 90): PlayLike => ({
  name,
  kind,
  unit: "customers",
  horizonDays,
  model: { weeklyReach: 100, steps: [{ name: "lead", rate: 0.05 }, { name: "paid", rate: 0.2 }], monthlySpendUsd: 100, ownerHoursPerWeek: 1, ...o },
});
const ctx = (o: Partial<PlaybookContext> = {}): PlaybookContext => ({ types: ["b2b_saas"], budgetUsd: 600, connected: [], constraint: "unknown", ...o });
const pb = (id: string) => PLAYBOOKS.find((p) => p.id === id)!;

describe("rate uncertainty helpers", () => {
  it("match closed forms", () => {
    expect(probBelow(betaPosterior(0, 4), 0.15)).toBeCloseTo(1 - 0.85 ** 5, 9);
    expect(poissonCdf(2, 4)).toBeCloseTo(0.2381, 4);
    expect(probLess(betaPosterior(3, 10), betaPosterior(1, 3))).toBeCloseTo(0.5934, 3);
    expect(() => betaPosterior(5, 4)).toThrow();
  });
});

describe("acceptance cases (owner prompt §7)", () => {
  it("1. different wording of identical facts keeps eligibility and arithmetic", () => {
    const a = diagnose({ funnel: { leads: 200, activated: 40, newCustomers: 10 }, types: ["b2b_saas"] });
    const b = diagnose({ funnel: { newCustomers: 10, activated: 40, leads: 200 }, types: ["b2b_saas"] });
    expect(b).toEqual(a);
    expect(playMaths(play("Search ads for trials"), econ).customers).toBe(playMaths(play("Paid search: trial signups"), econ).customers);
    expect(eligibility(pb("PB-paid-search-test"), ctx({ cpcUsd: 2 }))).toEqual(eligibility(pb("PB-paid-search-test"), { ...ctx(), cpcUsd: 2 }));
  });

  it("2. missing denominators prevent a strong numeric diagnosis", () => {
    const d = diagnose({ funnel: { newCustomers: 3 }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "unknown", status: "insufficient_evidence" });
    expect(d.basis).not.toBe("measured");
    expect(d.missing).toContain("signups or leads");
  });

  it("3. immature cohorts are flagged before ranking: a 30-day period can't show 45-day purchases", () => {
    const d = diagnose({ funnel: { periodDays: 30, leads: 100, activated: 50, newCustomers: 2 }, types: ["b2b_saas"], salesCycleDays: 45 });
    expect(d.constraint).toBe("unknown");
    expect(d.readings.find((r) => r.stage === "purchase")?.immature).toBe(true);
    expect(d.missing.join(" ")).toMatch(/at least 45 days/);
  });

  it("4. the 100 → 12 → 3 funnel names a weaker link as an observation, not a proven cause", () => {
    const d = diagnose({ funnel: { periodDays: 30, leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    const brief = diagnosisBrief(d);
    expect(brief).toMatch(/not a proven cause/);
    expect(d.hypotheses?.map((h) => h.constraint)).toEqual(["activation", "conversion"]);
    expect(d.leverage).toEqual([
      { stage: "activation", perPoint: 0.25 },
      { stage: "purchase", perPoint: 0.12 },
    ]);
    // The prompt's conditional scenarios, computed as extra customers over today's rates (one cohort of 100).
    const week = 7;
    const actFix = play("Onboarding fix", { weeklyReach: 100, steps: [{ name: "first value", rate: 0.18, baselineRate: 0.12 }, { name: "paid", rate: 0.25, baselineRate: 0.25 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 }, "bankable", week);
    const buyFix = play("Checkout fix", { weeklyReach: 100, steps: [{ name: "first value", rate: 0.12, baselineRate: 0.12 }, { name: "paid", rate: 0.4, baselineRate: 0.25 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 }, "bankable", week);
    expect(playMaths(actFix, econ).customers).toBeCloseTo(1.5, 9);
    expect(playMaths(buyFix, econ).customers).toBeCloseTo(1.8, 9);
  });

  it("5. a low-cost, high-intent search pilot is judged on its inputs, not a $300 rule", () => {
    expect(eligibility(pb("PB-paid-search-test"), ctx({ budgetUsd: 150, cpcUsd: 1.5, priceUsdMonth: 80 })).status).toBe("eligible");
    expect(eligibility(pb("PB-paid-search-test"), ctx({ budgetUsd: 60, cpcUsd: 2, priceUsdMonth: 80 }))).toMatchObject({ eligible: true, status: "low_priority" });
    expect(eligibility(pb("PB-paid-search-test"), ctx({ budgetUsd: 0 })).eligible).toBe(false);
  });

  it("6. unprofitable economics stay unattractive however big the budget", () => {
    const loser = play("Expensive ads", { monthlySpendUsd: 5000 });
    expect(playMaths(loser, econ).profitable).toBe(false);
    for (const budget of [5000, 50_000, 500_000]) expect(selectPortfolio({ economics: econ, plays: [loser, play("Cheap content", { monthlySpendUsd: 0 })] }, { monthlyBudgetUsd: budget })!.selected).toEqual(["Cheap content"]);
  });

  it("7. eligible plays can't jointly exceed cash, hours or delivery capacity", () => {
    const plays = [play("A", { monthlySpendUsd: 300, ownerHoursPerWeek: 2 }), play("B", { monthlySpendUsd: 300, ownerHoursPerWeek: 2 }), play("C", { monthlySpendUsd: 0, ownerHoursPerWeek: 3 })];
    const pick = selectPortfolio({ economics: econ, plays }, { monthlyBudgetUsd: 400, ownerHoursPerWeek: 5 })!;
    expect(pick.spendUsdMonth).toBeLessThanOrEqual(400);
    expect(pick.ownerHoursWeek).toBeLessThanOrEqual(5);
    expect(pick.left.length).toBeGreaterThan(0);
    expect(pick.runnerUp).not.toBeNull();
    // A bigger budget never removes a set that already fit.
    expect(selectPortfolio({ economics: econ, plays }, { monthlyBudgetUsd: 4000, ownerHoursPerWeek: 5 })!.customers).toBeGreaterThanOrEqual(pick.customers);
    // Capacity: plays that would bring more customers than the business can serve don't fit together.
    const cap = selectPortfolio({ economics: econ, plays }, { newCustomersPerMonth: 1, horizonDays: 90 })!;
    expect(cap.customers).toBeLessThanOrEqual(3 * 1.001 * (90 / 30));
    // The lint names the computed fix.
    const issues = lintFeasibility(plays as never, { monthlyAdBudgetUsd: 400, ownerHoursPerWeek: 5, currency: "USD" } as never, econ);
    expect(issues.map((i) => i.message).join(" ")).toMatch(/Best set that fits \(computed\)/);
  });

  it("8. relabelling activation without outcome evidence doesn't manufacture uplift", () => {
    const setup = diagnose({ funnel: { leads: 100, activated: 60, newCustomers: 3, activationKind: "setup" }, types: ["b2b_saas"] });
    expect(setup.basis).toBe("partial");
    expect(setup.missing.join(" ")).toMatch(/first-value event/);
    // A play that only raises an intermediate step but leaves final paid people unchanged adds no customers.
    const relabel = play("Count signups as activated", { steps: [{ name: "activated", rate: 0.6, baselineRate: 0.12 }, { name: "paid", rate: 0.05, baselineRate: 0.25 }], monthlySpendUsd: 0 });
    expect(playMaths(relabel, econ).customers).toBeCloseTo(0, 9);
  });

  it("9. unknown permission isn't permission, and missing evidence isn't unsuitability", () => {
    const email = pb("PB-lifecycle-email");
    expect(eligibility(email, ctx({}))).toMatchObject({ status: "needs_evidence", unknown: ["consented contacts"] });
    expect(eligibility(email, ctx({ emailAudience: 0 })).eligible).toBe(false);
    expect(eligibility(pb("PB-paid-search-test"), ctx({ priceUsdMonth: 80 }))).toMatchObject({ eligible: true, status: "needs_evidence" });
  });

  it("10. a sourced benchmark stays distinguishable from the owner's observation", () => {
    const d = diagnose({ funnel: { leads: 400, newCustomers: 20, signupKind: "trial_no_card" }, types: ["b2b_saas"] });
    const r = d.readings.find((x) => x.stage === "purchase")!;
    expect(r.observed).toBe("20 of 400 leads paid");
    expect(r.reference).toMatch(/practitioner range, grade C/);
    expect(r.referenceId).toBe("REF-trial-no-card");
    expect(d.rules).toContain("REF-trial-no-card@2");
  });

  it("12. contradictory counts produce a resolution task, not a confident plan", () => {
    const d = diagnose({ funnel: { leads: 50, activated: 80, newCustomers: 5 }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "unknown", status: "conflicting_inputs" });
    expect(d.missing[0]).toMatch(/^Resolve: 80 reached first value but only 50 leads/);
    expect(diagnosisBrief(d)).toMatch(/contradict each other/);
  });
});

describe("before/after examples from the reading", () => {
  it("0 of 4 SaaS leads paying is no longer 'weak, measured' (posterior P = 0.56)", () => {
    const d = diagnose({ funnel: { leads: 4, newCustomers: 0, signupKind: "trial_no_card" }, types: ["b2b_saas"] });
    expect(d.readings.find((r) => r.stage === "purchase")?.verdict).toBe("unknown");
    expect(d.constraint).toBe("unknown");
  });

  it("10 → 3 → 1 is ambiguous between activation and conversion (P = 0.59), not 'activation, measured'", () => {
    const d = diagnose({ funnel: { leads: 10, activated: 3, newCustomers: 1 }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "unknown", status: "ambiguous" });
    expect(d.hypotheses?.[0].probability).toBeCloseTo(0.59, 2);
  });

  it("a weak lead → paid rate with no first-value count no longer defaults to 'conversion'", () => {
    const d = diagnose({ funnel: { leads: 1000, newCustomers: 20, signupKind: "trial_no_card" }, types: ["b2b_saas"] });
    expect(d).toMatchObject({ constraint: "unknown", status: "ambiguous" });
  });

  it("shortfall: 0 of 30 at a planned 2% isn't a failing step; 0 of 25 at a planned 20% is", () => {
    const actuals = (planned: number, trials: number) =>
      playActuals({ weeklyReach: trials / 2, steps: [{ name: "click", rate: planned }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 }, [0, 1].map((w) => ({ weekStart: w * 604_800_000, reach: trials / 2, steps: [0], spendUsd: 0, ownerHours: 0 })), { p10: 1, p50: 2, p90: 3 });
    expect(diagnoseShortfall(actuals(0.02, 30)).verdict).toBe("too_few"); // was "tracking": 0.6 expected, so zero isn't a broken count
    expect(diagnoseShortfall(actuals(0.2, 25)).verdict).toBe("conversion");
  });

  it("2 customers against 4 expected is noise, not 'behind'", () => {
    const m = { weeklyReach: 50, steps: [{ name: "paid", rate: 0.04 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 };
    // Before: below the P10-by-now of 3 with no step to judge → "behind". Now P(X ≤ 2 | 4) = 0.24, so it's noise.
    const a = playActuals(m, [0, 1].map((w) => ({ weekStart: w * 604_800_000, reach: 50, steps: [1], spendUsd: 0, ownerHours: 0 })), { p10: 19.5, p50: 26, p90: 32.5 }, 13);
    expect(a.expectedByNow).toMatchObject({ p10: 3, p50: 4 });
    expect(a.status).toBe("on_track");
  });

  it("weeks before the play started don't count, and unlogged weeks block 'ahead'", () => {
    const m = { weeklyReach: 50, steps: [{ name: "paid", rate: 0.04 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 };
    const W = 604_800_000;
    const rows = [{ weekStart: -W, reach: 50, steps: [9], spendUsd: 0, ownerHours: 0 }, { weekStart: 0, reach: 50, steps: [6], spendUsd: 0, ownerHours: 0 }, { weekStart: 3 * W, reach: 50, steps: [6], spendUsd: 0, ownerHours: 0 }];
    const a = playActuals(m, rows, { p10: 6.5, p50: 13, p90: 19.5 }, 13, { startWeek: 0 });
    expect(a.ignoredBeforeStart).toBe(1);
    expect(a.weeksSinceStart).toBe(4);
    expect(a.status).not.toBe("ahead");
  });

  it("portfolio: adding a play never lowers the total; same-step plays count once", () => {
    expect(combinePlays([12, 2], ["demand", "demand"])).toBeCloseTo(13.6, 9);
    expect(combinePlays([6, 5], ["activation", "activation"])).toBe(6);
    const two = [play("Onboarding email", { steps: [{ name: "activate", rate: 0.3 }] }), play("Onboarding checklist", { steps: [{ name: "activate", rate: 0.3 }] })];
    expect(portfolioRange({ economics: econ, plays: two }).p50).toBeCloseTo(playMaths(two[0], econ).customers, 9);
  });

  it("portfolio range comes from joint draws, narrower than adding every play's P10 and P90", () => {
    const ranged = (n: string) => play(n, { steps: [{ name: "lead", rate: 0.05, low: 0.01, high: 0.09 }, { name: "paid", rate: 0.2, low: 0.1, high: 0.3 }] });
    const ps = [ranged("A ads"), ranged("B content"), ranged("C partners")];
    const r = portfolioRange({ economics: econ, plays: ps });
    const heads = ps.map((p) => playMaths(p, econ).headline);
    expect(r.p10).toBeGreaterThan(combinePlays(heads.map((h) => h.p10), ["demand", "demand", "demand"]));
    expect(r.p90).toBeLessThan(combinePlays(heads.map((h) => h.p90), ["demand", "demand", "demand"]));
  });

  it("plays report robustness and a break-even switch point", () => {
    const m = playMaths(play("Search test", { steps: [{ name: "lead", rate: 0.05, low: 0.01, high: 0.09 }, { name: "paid", rate: 0.2, low: 0.1, high: 0.3 }] }), econ);
    expect(["robust", "fragile", "loses"]).toContain(m.robustness);
    expect(m.breakevenCustomers).toBeCloseTo(m.costUsd / m.valueUsd!, 9);
  });

  it("an onboarding play without today's rate is flagged: it would count customers who'd come anyway", () => {
    const issues = lintEconomics({ economics: econ, plays: [play("Onboarding checklist", { steps: [{ name: "activate", rate: 0.3 }] })] });
    expect(issues.some((i) => /baselineRate/.test(i.message))).toBe(true);
  });

  it("compareRates: impossible counts are rejected; intervals separate 'too few to tell' from 'flat'", () => {
    expect(() => compareRates({ control: { visitors: 10, conversions: 12 }, treatment: { visitors: 10, conversions: 1 } })).toThrow();
    expect(compareRates({ control: { visitors: 60, conversions: 3 }, treatment: { visitors: 60, conversions: 5 }, practicalChange: 0.01 }).practical).toBe("inconclusive");
    expect(compareRates({ control: { visitors: 50_000, conversions: 2000 }, treatment: { visitors: 50_000, conversions: 2010 }, practicalChange: 0.005 }).practical).toBe("flat");
  });

  it("A/B: a clear early lead isn't applied; the result is read at the planned end", () => {
    expect(decide([{ key: "A", trials: 150, wins: 3 }, { key: "B", trials: 150, wins: 18 }], 100, 1000).done).toBe(false);
  });
});

describe("experiment feasibility uses the population's own denominator (Kohavi Ch 17)", () => {
  it("a visitor population is sized with visitor → paid, not the per-lead purchase rate", async () => {
    const { lintExperimentFeasibility } = await import("../../shared/agents/specs");
    const exp = { name: "Pricing page test", method: "ab_split", population: "about 750 visitors a week", durationDays: 14, stoppingRule: "Read once on day 14; stop early if refunds rise above 3%", primaryMetric: "paid customers", guardrails: ["refunds above 3%"] };
    // Per lead 25% would pass; per visitor (5% × 12% × 25% = 0.15%) it can't finish.
    const issues = lintExperimentFeasibility({ experiments: [exp] }, { funnelRates: { lead: 0.05, activation: 0.12, purchase: 0.25 } });
    expect(issues.map((i) => i.message).join(" ")).toMatch(/visitor → purchase/);
  });
});
