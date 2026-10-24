import { describe, expect, it } from "vitest";
import { EXPERT_PLAN_SCHEMA_VERSION, readExpertPlan } from "../../../shared/agents/planCompatibility";

describe("saved expert plan compatibility", () => {
  it("labels rows written before schema versioning as legacy and preserves their payload", () => {
    const legacy = { diagnosis: "Old plan", economics: { monthsRetained: 12 }, plays: [{ name: "Keep customers" }] };

    expect(readExpertPlan(legacy)).toEqual({ ...legacy, version: 0 });
  });

  it("preserves a supported saved version", () => {
    const current = { version: EXPERT_PLAN_SCHEMA_VERSION, diagnosis: "Current plan" };

    expect(readExpertPlan(current)).toEqual(current);
  });

  it("preserves a future version without guessing how to migrate it", () => {
    const future = { version: EXPERT_PLAN_SCHEMA_VERSION + 1, diagnosis: "Future plan" };

    expect(readExpertPlan(future)).toEqual(future);
  });

  it("treats invalid version values as legacy", () => {
    expect(readExpertPlan({ version: 1.5, diagnosis: "Plan" })).toEqual({ version: 0, diagnosis: "Plan" });
  });
});
