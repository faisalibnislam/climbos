import { describe, expect, it } from "vitest";
import { beforeAfter, calculate, compareRates, margin, priceFloor, sampleRatio, sampleSize } from "../../shared/analysis/decisions";
import { chiSquareSf, fisherExact, normalCdf, normalQuantile, twoProportionP } from "../../shared/analysis/stats";
import { CLIMB_TOOLS, climbToolDefs } from "../../convex/lib/climbTools";

/** Slice 1: decision arithmetic in code, checked against the expansion cases' expected numbers. */
describe("statistics", () => {
  it("matches standard reference values", () => {
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5);
    expect(chiSquareSf(3.841459, 1)).toBeCloseTo(0.05, 4);
    expect(chiSquareSf(5.991465, 2)).toBeCloseTo(0.05, 4);
    expect(fisherExact(1, 9, 11, 3)).toBeCloseTo(0.002759, 5);
    expect(fisherExact(2, 98, 3, 97)).toBeCloseTo(1, 3);
    expect(twoProportionP(100, 1000, 120, 1000)).toBeCloseTo(0.1529, 3); // pooled z = 1.429
  });
});

describe("money (EV03, EV12, EV15, EV31)", () => {
  it("EV03: $30 with $21 of listed costs is a 30% contribution margin, not profit, not markup", () => {
    const r = margin({ price: 30, costs: [{ name: "model research", amount: 12 }, { name: "email infra", amount: 3 }, { name: "support", amount: 6 }], targetMargin: 0.3 });
    expect(r).toMatchObject({ totalCost: 21, contribution: 9, contributionMargin: 0.3, meetsTarget: true });
    expect(r.markupOnCost).toBeCloseTo(0.4286, 3);
    expect(r.notes.join(" ")).toMatch(/not company net profit/);
  });
  it("EV15: a $40 bundle with $20 of cost keeps $20 at 50%", () => {
    expect(margin({ price: 40, costs: [{ name: "A", amount: 12 }, { name: "B", amount: 8 }] })).toMatchObject({ contribution: 20, contributionMargin: 0.5 });
  });
  it("EV31: stated $15 vs $14 cost is 6.7%; the 30% floor is $20 and isn't validated demand", () => {
    const r = priceFloor({ unitCost: 14, targetMargin: 0.3, statedWillingnessToPay: 15 });
    expect(r.floor).toBe(20);
    expect(r.marginAtStated).toBeCloseTo(0.0667, 3);
    expect(r.notes.join(" ")).toMatch(/not what buyers will pay/);
  });
});

describe("tests and changes (EV08, EV14, EV20, EV28)", () => {
  it("EV08: 2/100 vs 3/100 is 1 point, 50% relative, no reliable difference, and too early", () => {
    const r = compareRates({ control: { visitors: 100, conversions: 2 }, treatment: { visitors: 100, conversions: 3 }, plannedEndReached: false });
    expect(r).toMatchObject({ controlRate: 0.02, treatmentRate: 0.03, absoluteChange: 0.01, relativeChange: 0.5, method: "fisher_exact", verdict: "too_early" });
    expect(r.pValue).toBeGreaterThan(0.9);
    expect(compareRates({ control: { visitors: 100, conversions: 2 }, treatment: { visitors: 100, conversions: 3 } }).verdict).toBe("no_reliable_difference");
  });
  it("EV14: 9,000 vs 1,000 on a 50/50 plan is a sample-ratio mismatch", () => {
    const r = sampleRatio({ planned: [50, 50], observed: [9000, 1000] });
    expect(r.mismatch).toBe(true);
    expect(r.chiSquare).toBe(6400);
    expect(sampleRatio({ planned: [50, 50], observed: [5030, 4970] }).mismatch).toBe(false);
  });
  it("needs about 3,800 a side to see 2% → 3%, and flags tests too long for the traffic (EV28)", () => {
    const r = sampleSize({ baseline: 0.02, minDetectable: 0.01 });
    expect(r.perArm).toBeGreaterThan(3600);
    expect(r.perArm).toBeLessThan(4000);
    const slow = sampleSize({ baseline: 0.05, minDetectable: 0.01, arms: 10, weeklyEligible: 12 });
    expect(slow.weeks).toBeGreaterThan(12);
    expect(slow.notes.join(" ")).toMatch(/Too long for an A\/B test/);
  });
  it("EV20: $10,000 → $12,000 is a 20% observed change with confounders, not proven impact", () => {
    const r = beforeAfter({ before: 10000, after: 12000, confounders: ["seasonal peak", "price change"] });
    expect(r).toMatchObject({ change: 2000, relativeChange: 0.2, label: "observed" });
    expect(r.notes.join(" ")).toMatch(/seasonal peak, price change/);
  });
});

describe("Climb AI calculate tool", () => {
  it("is a read tool with a flat object input that runs locally", () => {
    const t = CLIMB_TOOLS.find((x) => x.name === "calculate")!;
    expect(t.risk).toBe("read");
    const def = climbToolDefs({ ui: false }).find((d) => d.name === "calculate")!;
    expect(def.input_schema.type).toBe("object");
    expect(t.local?.({ kind: "margin", price: 30, costs: [{ name: "all", amount: 21 }] })).toMatchObject({ contribution: 9 });
  });
  it("returns a plain error for missing inputs instead of throwing", () => {
    expect(calculate({ kind: "compare_rates" } as never)).toMatchObject({ error: expect.stringMatching(/compare_rates/) });
    expect(calculate({ kind: "price_floor", unitCost: 10, targetMargin: 1.2 })).toMatchObject({ error: expect.any(String) });
  });
});
