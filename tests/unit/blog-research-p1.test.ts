import { describe, expect, it } from "vitest";
import { sampleRatio, SPLIT_CHECKLIST } from "../../shared/analysis/decisions";
import { readingOf, readingText } from "../../shared/growth/experimentOutcome";
import { diagnose, funnelRatesOf, playStage } from "../../shared/agents/diagnosis";
import { lockedNumbers, playMaths, type Economics } from "../../shared/agents/economics";
import { playInputs } from "../../shared/agents/provenance";
import { eligibility, PLAYBOOKS, type PlaybookContext } from "../../shared/playbooks/contracts";

/** Blog-research backlog P1 (docs/growth-expansion/blog-research/BACKLOG.md #1–9). */
describe("split check warning band (#2)", () => {
  it("230/170 on 50/50 warns (p ≈ 0.0027) and names the arm and checklist; 9,000/1,000 blocks", () => {
    const w = sampleRatio({ planned: [50, 50], observed: [230, 170] });
    expect(w).toMatchObject({ mismatch: false, warning: true, overArm: 0 });
    expect(w.checklist).toEqual(SPLIT_CHECKLIST);
    expect(sampleRatio({ planned: [50, 50], observed: [9000, 1000] })).toMatchObject({ mismatch: true, warning: false });
    expect(sampleRatio({ planned: [50, 50], observed: [205, 195] })).toMatchObject({ mismatch: false, warning: false, overArm: null, checklist: [] });
  });
});

describe("outcome reading (#1)", () => {
  it("only a valid split with a significant difference earns 'incremental conversions'", () => {
    expect(readingOf({ exposed: 120, conversions: 18, controlSize: 120, controlConversions: 12 })).toMatchObject({ kind: "no_difference", pValue: 0.2416 });
    expect(readingOf({ exposed: 300, conversions: 60, controlSize: 300, controlConversions: 15 }).kind).toBe("difference");
    expect(readingOf({ exposed: 230, conversions: 40, controlSize: 170, controlConversions: 10, plannedSharePct: 50 }).kind).toBe("split_warning");
    expect(readingOf({ exposed: 300, conversions: 60, controlSize: 100, controlConversions: 5, plannedSharePct: 50 }).kind).toBe("split_mismatch");
    expect(readingOf({ exposed: 100, conversions: 5 }).kind).toBe("no_counts");
    expect(readingText({ kind: "no_difference", pValue: 0.2416 })).toMatch(/No reliable difference \(p = 0\.242\)/);
  });
});

describe("activation kind (#8)", () => {
  it("a setup count can't make the diagnosis 'measured'", () => {
    const value = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] });
    const setup = diagnose({ funnel: { leads: 100, activated: 12, newCustomers: 3, activationKind: "setup" }, types: ["b2b_saas"] });
    expect(value.basis).toBe("measured");
    expect(setup.basis).toBe("partial");
    expect(setup.missing.join(" ")).toMatch(/first-value event/);
  });
  it("funnel rates carry the measured stage rates for test sizing (#4)", () => {
    expect(funnelRatesOf(diagnose({ funnel: { visitors: 2000, leads: 100, activated: 12, newCustomers: 3 }, types: ["b2b_saas"] }))).toEqual({ lead: 0.05, activation: 0.12, purchase: 0.25 });
    expect(funnelRatesOf(diagnose({}))).toBeUndefined();
  });
});

describe("price increase is its own play (#9)", () => {
  it("is classed as economics, not only delivery, and has a contract", () => {
    expect(playStage("Raise prices on the Pro plan for new buyers")).toBe("economics");
    expect(playStage("Add a waitlist when fully booked")).toBe("delivery");
    const pb = PLAYBOOKS.find((p) => p.id === "PB-price-increase")!;
    const ctx: PlaybookContext = { types: ["local_services"], budgetUsd: 0, connected: [], constraint: "delivery" };
    expect(pb.worksOn).toEqual(expect.arrayContaining(["economics", "delivery"]));
    expect(eligibility(pb, ctx).eligible).toBe(true);
    expect(pb.signature.test("Increase our prices by 10% for new clients")).toBe(true);
  });
});

describe("cost per customer and payback labels (#5–7)", () => {
  const e: Economics = { revenuePerCustomerMonthUsd: 100, grossMargin: 0.8, monthlyChurn: 0.03, basis: "", ownerHourUsd: 50, assumed: [] };
  const play = (other?: number) => ({ name: "Ads", kind: "bankable", horizonDays: 30, model: { weeklyReach: 1000, steps: [{ name: "buy", rate: 0.0014 }], monthlySpendUsd: 900, ownerHoursPerWeek: 7, ...(other !== undefined ? { otherMonthlyUsd: other } : {}) } });
  it("counts tools and freelancers in cost per customer (Skok's fully loaded CAC)", () => {
    const without = playMaths(play() as never, e);
    const withOther = playMaths(play(150) as never, e);
    expect(withOther.costUsd - without.costUsd).toBeCloseTo(150 * (30 / 30.4375), 5); // 30 days of a $150/month cost
    expect(withOther.cacUsd!).toBeGreaterThan(without.cacUsd!);
    expect(playInputs(play(150) as never, e).some((r) => r.key === "other" && r.value === 150)).toBe(true);
  });
  it("names both payback definitions in the locked numbers", () => {
    const locked = lockedNumbers({ economics: e, plays: [play() as never] }, { horizonDays: 30 });
    expect(locked).toMatch(/months with churn \(\d+(\.\d+)? months per surviving customer\)/);
  });
});
