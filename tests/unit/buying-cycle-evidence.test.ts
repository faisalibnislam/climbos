import { describe, expect, it } from "vitest";
import { diagnose, diagnosisBrief } from "../../shared/agents/diagnosis";
import { salesCycleEstimate, limitChecks, type AcquisitionProfile } from "../../shared/acquisition/scoring";
import { CHANNELS } from "../../shared/acquisition/library";

const funnel = { periodDays: 30, leads: 100, activated: 12, newCustomers: 3 };
const profile = (source: "owner" | "inferred" = "owner", confidence: "high" | "low" = "high"): AcquisitionProfile => ({ types: ["b2b_saas"], dims: { salesCycle: { value: "long", source, confidence } }, budgetUsd: 0, horizonDays: 30 });

describe("buying-cycle evidence", () => {
  it("accepts same-day buying without throwing away the funnel", () => {
    expect(diagnose({ funnel, salesCycleDays: 0 })).toMatchObject({ constraint: "activation", status: "supported" });
  });
  it.each(["owner", "inferred"] as const)("labels %s categories as assumptions and asks for actual dates", source => {
    const estimate = salesCycleEstimate(profile(source))!;
    expect(estimate).toMatchObject({ days: 120, source });
    const d = diagnose({ funnel, salesCycleDays: estimate.days, salesCycleEstimate: estimate });
    expect(d).toMatchObject({ constraint: "unknown", status: "insufficient_evidence", nextMeasurement: { priority: "decision_critical" } });
    expect(d.nextMeasurement?.action).toContain("lead and purchase dates");
    expect(diagnosisBrief(d)).toContain("120-day planning assumption");
    expect(diagnosisBrief(d)).toContain("actual time to buy has not been verified");
    expect(d.missing.join(" ")).not.toContain("a period of at least 120 days");
  });
  it("withholds low-confidence or absent category mappings", () => {
    expect(salesCycleEstimate(profile("inferred", "low"))).toBeUndefined();
    expect(salesCycleEstimate({ dims: {} })).toBeUndefined();
    expect(salesCycleEstimate({ dims: { salesCycle: { value: "unknown", confidence: "high", source: "owner" } } })).toBeUndefined();
  });
  it("keeps direct reported days distinct from category estimates", () => {
    const d = diagnose({ funnel, salesCycleDays: 45 });
    expect(d.salesCycleNote).toBeUndefined();
    expect(d.missing).toContain("a period of at least 45 days (one sales cycle), so recent leads have had time to buy");
    expect(d.readings.find(r => r.stage === "purchase")?.immature).toBe(true);
  });
  it("does not let an estimated buying cycle override known zero delivery capacity", () => {
    const estimate = salesCycleEstimate(profile())!;
    expect(diagnose({ funnel, newCustomersPerMonth: 0, salesCycleDays: estimate.days, salesCycleEstimate: estimate })).toMatchObject({ constraint: "delivery", status: "supported", salesCycleNote: expect.stringContaining("planning assumption") });
  });
  it("labels channel timing as a scenario rather than a first-revenue forecast", () => {
    const channel = CHANNELS.find(c => c.id === "S01")!;
    const check = limitChecks(channel, profile()).find(c => c.kind === "sales_cycle")!;
    expect(check.reason).toContain("Planning scenario");
    expect(check.reason).toContain("owner-selected");
    expect(check.reason).toContain("first revenue are unknown");
    expect(limitChecks(channel, profile("inferred", "low")).some(c => c.kind === "sales_cycle")).toBe(false);
  });
});
