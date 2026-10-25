import { describe, expect, it } from "vitest";
import { binomialCdf } from "../../shared/analysis/bayes";
import { customerValue, decisionQuestions, lockedNumbers, playMaths, selectPortfolio, type Economics, type PlayLike } from "../../shared/agents/economics";
import { decidesLine, stopRule, switchPoints } from "../../shared/agents/voi";
import { forecastCalibration } from "../../shared/growth/actuals";

/** Hubbard, How to Measure Anything (3rd ed.) Ch 5–7, 14: switch values, value of information, calibration. Hypothetical inputs. */
const econ: Economics = { revenuePerCustomerMonthUsd: 200, grossMargin: 0.8, monthlyChurn: 0.05, basis: "test", assumed: [], sources: { revenue: { source: "owner", ref: "", quote: "" }, margin: { source: "owner", ref: "", quote: "" }, churn: { source: "owner", ref: "", quote: "" } } as never };
const play = (o: Partial<PlayLike["model"]> = {}, name = "Cold email"): PlayLike => ({
  name,
  kind: "bankable",
  unit: "customers",
  horizonDays: 91,
  model: { weeklyReach: 100, steps: [{ name: "reply", rate: 0.03, low: 0.01, high: 0.06, source: "research" }, { name: "paid", rate: 0.2 }], monthlySpendUsd: 0, ownerHoursPerWeek: 10, ...o },
});
const net = (p: PlayLike) => {
  const m = playMaths(p, econ);
  return m.customers * customerValue(econ)! - m.costUsd;
};

describe("switch values (no probabilities)", () => {
  it("find the break-even of each input; linear inputs match the closed form", () => {
    const p = play();
    const m = playMaths(p, econ);
    const value = customerValue(econ)!;
    const reply = switchPoints(p, econ).find((s) => s.key === "step:0")!;
    // net is linear in the reply rate: switch = rate × cost / (customers × value).
    expect(reply.switchValue!).toBeCloseTo(0.03 * (m.costUsd / (m.customers * value)), 6);
    expect(reply.direction).toBe("ge");
    const churn = switchPoints(p, econ).find((s) => s.key === "churn")!;
    expect(churn.direction).toBe("le");
  });

  it("the deciding line names the nearest input and a computed stop rule", () => {
    const line = decidesLine(play(), econ, (n) => `$${Math.round(n)}`)!;
    expect(line).toMatch(/pays back only if/);
  });

  it("stop rule: stop when the posterior mean (uniform prior) is below the switch rate", () => {
    expect(stopRule(200, 0.032)).toEqual({ trials: 200, stopAtOrBelow: 5 }); // (5+1)/202 = 0.0297 < 0.032; (6+1)/202 = 0.0347
    expect(stopRule(20, 0.03)).toBeNull(); // even 0 of 20 gives 1/22 = 0.045 > 3%: too small to show failure
  });
});

describe("value of perfect information", () => {
  it("matches an independent integration for a sourced range, and is zero when no outcome changes the call", () => {
    const p = play({ ownerHoursPerWeek: 14 });
    const sp = switchPoints(p, econ).find((s) => s.key === "step:0")!;
    // Independent: net is linear in the reply rate x; today's call is go if net(0.03) ≥ 0; EOL = E[max(0, ∓net)] over Triangular(0.01, 0.03, 0.06).
    const a = (net(p) - net({ ...p, model: { ...p.model, steps: [{ ...p.model.steps[0], rate: 0 }, p.model.steps[1]] } })) / 0.03;
    const c = -net({ ...p, model: { ...p.model, steps: [{ ...p.model.steps[0], rate: 0 }, p.model.steps[1]] } });
    const go = a * 0.03 - c >= 0;
    const tri = (x: number) => (x < 0.03 ? (2 * (x - 0.01)) / (0.05 * 0.02) : (2 * (0.06 - x)) / (0.05 * 0.03));
    let s = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const x = 0.01 + ((i + 0.5) / N) * 0.05;
      s += tri(x) * (go ? Math.max(0, c - a * x) : Math.max(0, a * x - c)) * (0.05 / N);
    }
    expect(sp.evpiUsd!).toBeCloseTo(s, 0);
    expect(sp.evpiUsd!).toBeGreaterThan(0);
    // A cheap play that pays back across the whole range: knowing more can't change the call.
    expect(switchPoints(play({ ownerHoursPerWeek: 1 }), econ).find((x) => x.key === "step:0")!.evpiUsd).toBe(0);
  });

  it("is never computed on assumption ranges (no invented probabilities)", () => {
    const p = play({ steps: [{ name: "reply", rate: 0.03, low: 0.01, high: 0.06, source: "assumption" }, { name: "paid", rate: 0.2 }] });
    expect(switchPoints(p, econ).find((s) => s.key === "step:0")!.evpiUsd).toBeUndefined();
  });
});

describe("portfolio and gates", () => {
  it("constrains monthly cash outlay without counting owner time and asks when the limit is unknown", () => {
    const cashCostPlay = play({ monthlySpendUsd: 100, otherMonthlyUsd: 50, ownerHoursPerWeek: 0 }, "Paid test");
    const out = { economics: econ, plays: [cashCostPlay] };
    const unbounded = selectPortfolio(out, {})!;
    expect(unbounded.selected).toEqual(["Paid test"]);
    expect(unbounded.cashSpendUsdMonth).toBe(150);
    const bounded = selectPortfolio(out, { monthlyGrowthCashUsd: 120 })!;
    expect(bounded.selected).toEqual([]);
    expect(bounded.left[0]?.why).toMatch(/exceeds the owner's monthly growth-cash limit/);
    const qs = decisionQuestions(out, null);
    expect(qs[0]).toMatchObject({ key: "monthlyGrowthCashUsd", unit: "usd_month", why: expect.stringContaining("excludes the value of your time") });
    expect(qs[0]?.assumed).toBeUndefined();
    expect(selectPortfolio(out, { monthlyGrowthCashUsd: 0 })!.selected).toEqual([]);
  });

  it("doing nothing new beats a set whose expected contribution is below its cost", () => {
    const skewedLoser = play({ steps: [{ name: "reply", rate: 0.03, low: 0.0, high: 0.031 }, { name: "paid", rate: 0.2 }], ownerHoursPerWeek: 13 }, "Knife edge");
    expect(playMaths(skewedLoser, econ).profitable).toBe(true);
    const pick = selectPortfolio({ economics: econ, plays: [skewedLoser] }, {})!;
    expect(pick.selected).toEqual([]);
    expect(pick.basis).toMatch(/Doing nothing new/);
  });

  it("each play reports its chance of not paying back from the draws", () => {
    const m = playMaths(play({ ownerHoursPerWeek: 14 }), econ);
    expect(m.lossChance).not.toBeNull();
    expect(m.lossChance!).toBeGreaterThan(0);
    expect(m.lossChance!).toBeLessThan(1);
  });

  it("owner questions carry the switch value instead of only an invented sweep", () => {
    const e = { ...econ, assumed: ["revenue", "margin", "churn"] };
    const qs = decisionQuestions({ economics: e, plays: [play({ ownerHoursPerWeek: 14 })] }, null);
    expect(qs.some((q) => typeof q.switchValue === "number" && /pays back only if/.test(q.why))).toBe(true);
  });

  it("locked numbers stay fast with the decision lines (no simulation inside the search)", () => {
    const plays = [play({}, "A"), play({}, "B"), play({}, "C"), play({}, "D")];
    const t = performance.now();
    const text = lockedNumbers({ economics: econ, plays });
    expect(performance.now() - t).toBeLessThan(1500);
    expect(text).toMatch(/Decides it: pays back only if/);
  });
});

describe("forecast calibration (stored predictions vs results)", () => {
  it("flags overconfident ranges with an exact binomial tail", () => {
    expect(binomialCdf(5, 10, 0.8)).toBeCloseTo(0.0328, 4);
    const rows = Array.from({ length: 10 }, (_, i) => ({ customers: i < 5 ? 5 : 50, p10: 4, p90: 10 }));
    expect(forecastCalibration(rows)).toMatchObject({ matured: 10, inside: 5, verdict: "overconfident" });
    expect(forecastCalibration(rows.slice(0, 2)).verdict).toBe("too_few_plays");
    expect(forecastCalibration(Array.from({ length: 5 }, () => ({ customers: 5, p10: 4, p90: 10 }))).verdict).toBe("consistent");
  });
});

describe("owner ranges (Hubbard Ch 5)", () => {
  it("an owner's churn range enables value of information on churn; a single number doesn't", async () => {
    const { applyOwnerEconomics } = await import("../../shared/agents/economics");
    const base = { ...econ, assumed: ["churn"] };
    const p = play({ ownerHoursPerWeek: 14 });
    const point = applyOwnerEconomics(base, { monthlyChurn: 0.05 });
    expect(switchPoints(p, point).find((s) => s.key === "churn")!.evpiUsd).toBeUndefined();
    const ranged = applyOwnerEconomics(base, { monthlyChurn: 0.06, ranges: { churn: { low: 0.02, high: 0.1 } } });
    expect(ranged.ranges?.churn).toEqual({ low: 0.02, high: 0.1 });
    const sp = switchPoints(p, ranged).find((s) => s.key === "churn")!;
    expect(sp.source).toBe("owner");
    expect(sp.evpiUsd).toBeGreaterThanOrEqual(0);
  });
});
