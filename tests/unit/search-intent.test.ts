import { describe, expect, it } from "vitest";
import { inferSearchIntentStage } from "../../shared/agents/searchIntent";

describe("search intent stage", () => {
  it("distinguishes research, evaluation, and ready-to-buy queries", () => {
    expect(inferSearchIntentStage("how to manage customer appointments", "other")).toBe("awareness");
    expect(inferSearchIntentStage("best appointment scheduling software comparison", "other")).toBe("evaluation");
    expect(inferSearchIntentStage("appointment scheduling software pricing and free trial", "other")).toBe("purchase");
  });

  it("uses page type only as a fallback and preserves ambiguity", () => {
    expect(inferSearchIntentStage("appointment scheduling", "alternatives")).toBe("evaluation");
    expect(inferSearchIntentStage("something", "other")).toBe("unclear");
  });
});
