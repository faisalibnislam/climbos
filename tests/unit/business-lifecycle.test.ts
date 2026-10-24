import { describe, expect, it } from "vitest";
import { BUSINESS_LIFECYCLE_STAGES, businessLifecycleContext } from "../../shared/agents/lifecycle";

describe("owner-reported business lifecycle context", () => {
  it("gives each supplied stage a distinct, cautious planning lens", () => {
    const contexts = BUSINESS_LIFECYCLE_STAGES.map((stage) => businessLifecycleContext(stage, Date.UTC(2026, 0, 2)));
    expect(new Set(contexts).size).toBe(BUSINESS_LIFECYCLE_STAGES.length);
    expect(contexts.every((context) => context.includes("owner-reported; owner-confirmed 2026-01-02"))).toBe(true);
    expect(contexts.find((context) => context.includes("Idea validation"))).toContain("commit money or time");
    expect(contexts.find((context) => context.includes("Possible decline"))).toContain("seasonality");
    expect(contexts.every((context) => context.includes("not proof of demand"))).toBe(true);
  });

  it("keeps a missing stage unknown and tells the planner not to infer it from the website", () => {
    const context = businessLifecycleContext(null);
    expect(context).toContain("unknown (not provided by the owner)");
    expect(context).toContain("Do not infer");
    expect(context).toContain("across stages");
  });
});
