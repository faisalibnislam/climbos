import { describe, expect, it } from "vitest";
import { skillPlaybook } from "../../shared/skills";
import { playCatalogsFor } from "../../shared/agents/specs";
import { CLIMBOS_ENGINES } from "../../shared/agents/capacity";
import { planExecutionContext } from "../../shared/agents/planTasks";

describe("strategy context contains methods without unsourced performance promises", () => {
  it("preserves every chosen play and its full numbers and permissions when omitting duplicated review material", () => {
    const plays = Array.from({ length: 4 }, (_, index) => ({ name: `Move ${index}`, mechanic: "Specific execution details ".repeat(200), model: { monthlySpendUsd: index, steps: [{ rate: 0.02, source: "assumption" }] }, actionContract: { permission: "owner_review", evidenceRefs: [`fact:${index}`] }, creativeReview: { longTrace: "x".repeat(8000) } }));
    const value = JSON.parse(planExecutionContext({ plays, strategicDirection: { ambition: "Reach the right buyers" }, preparedWork: [{ draft: "y".repeat(12000) }], strategyExploration: { options: "z".repeat(12000) } }));
    expect(value.plays).toHaveLength(4);
    expect(value.plays[3]).toEqual({ ...plays[3], creativeReview: undefined });
    expect(value.strategicDirection.ambition).toBe("Reach the right buyers");
    expect(value).not.toHaveProperty("preparedWork"); expect(value).not.toHaveProperty("strategyExploration");
  });
  it("excludes historical rate tables from the live growth method", () => {
    const text = skillPlaybook("growth-plays");
    expect(text).not.toContain("elev8or.io");
    expect(text).not.toContain("Free plan user → paid");
    expect(text).not.toContain("at $50/hour if unknown");
    expect(text).toContain("keep them unknown");
    expect(text).toContain("bounded distribution hypothesis");
  });
  it("does not load local-service catalogs for an unknown or desktop software business", () => {
    expect(playCatalogsFor(null)).toEqual([]);
    expect(playCatalogsFor("desktop_app")).toEqual(["plays-saas-b2b"]);
    expect(skillPlaybook("plays-saas-b2b")).not.toContain("**Expect:**");
    expect(CLIMBOS_ENGINES).not.toContain("$300");
    expect(CLIMBOS_ENGINES).not.toContain("1–3%");
  });
});
