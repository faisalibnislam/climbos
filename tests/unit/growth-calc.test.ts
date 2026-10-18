import { describe, expect, it } from "vitest";
import * as c from "../../shared/growth/calc";

// Spec §18 synthetic fixture: every input is a test assumption, never a default.
describe("spec §18 fixture", () => {
  const spend = 600, cpc = 2, clickToSignup = 0.08, signupToPaid = 0.25, revenue = 30, margin = 0.8, churn = 0.05;
  const clicks = c.clicks(spend, cpc)!;
  const customers = c.funnelCustomers(clicks, [clickToSignup, signupToPaid])!;
  const cac = c.cacMedia(spend, customers)!;
  const cm = c.contributionMonth(revenue, margin)!;

  it("funnel and CAC", () => {
    expect(clicks).toBe(300);
    expect(customers).toBeCloseTo(6, 10);
    expect(cac).toBeCloseTo(100, 10);
    expect(cm).toBeCloseTo(24, 10);
  });

  it("payback and contribution", () => {
    expect(c.paybackSimple(cac, cm)).toBeCloseTo(4.1667, 4);
    expect(c.contributionOver(cm, churn, 3)).toBeCloseTo(68.46, 2);
    expect(c.contributionOver(cm, churn, 12)).toBeCloseTo(220.6272, 4);
  });

  it("break-even CPC over 3 periods", () => {
    const allowable = c.allowableCac(cm, churn, 3);
    expect(c.breakevenCpc(allowable, clickToSignup, signupToPaid)).toBeCloseTo(1.3692, 4);
  });
});

describe("missing and invalid inputs", () => {
  it("returns null instead of guessing", () => {
    expect(c.funnelCustomers(null, [0.1])).toBeNull();
    expect(c.funnelCustomers(100, [0.1, undefined])).toBeNull();
    expect(c.contributionMonth(30, null)).toBeNull();
    expect(c.cacMedia(600, 0)).toBeNull();
    expect(c.clicks(600, 0)).toBeNull();
  });

  it("rejects rates outside 0–1 and negative spend", () => {
    expect(c.funnelCustomers(100, [1.5])).toBeNull();
    expect(c.contributionMonth(30, 80)).toBeNull();
    expect(c.cacMedia(-1, 5)).toBeNull();
  });

  it("handles zero churn", () => {
    expect(c.contributionOver(24, 0, 12)).toBe(288);
    expect(c.paybackWithChurn(100, 24, 0)).toBeCloseTo(4.1667, 4);
  });

  it("payback with churn is null when it never pays back", () => {
    expect(c.paybackWithChurn(1000, 24, 0.05)).toBeNull(); // lifetime value 480 < 1000
    expect(c.paybackWithChurn(100, 24, 0.05)).toBeGreaterThan(4.1667);
  });

  it("portfolio overlap applies only with two or more plays", () => {
    expect(c.portfolioCustomers([10], 0.2)).toBe(10);
    expect(c.portfolioCustomers([10, 10], 0.2)).toBe(16);
  });
});
