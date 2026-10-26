import { describe, expect, it } from "vitest";
import { lintDesignDirections } from "../../shared/agents/specs";

const dir = (id: string, o: Record<string, unknown> = {}) => ({ id, name: `Direction ${id}`, effort: "small", risks: ["May not help"], assumptions: ["Visitors read the hero"], ...o });

describe("Design Critic directions", () => {
  it("accepts one direction, or distinct levels with effort and risk", () => {
    expect(lintDesignDirections([dir("a")], "d")).toEqual([]);
    expect(lintDesignDirections([dir("a", { responseLevel: "quick_fix" }), dir("b", { responseLevel: "bold_alternative" })], "d")).toEqual([]);
  });

  it("rejects missing or duplicate levels and a bold alternative without assumptions or risks", () => {
    expect(lintDesignDirections([dir("a"), dir("b", { responseLevel: "quick_fix" })], "d").map((i) => i.severity)).toContain("error");
    expect(lintDesignDirections([dir("a", { responseLevel: "quick_fix" }), dir("b", { responseLevel: "quick_fix" })], "d")[0].message).toMatch(/different response levels/);
    const bold = lintDesignDirections([dir("a", { responseLevel: "quick_fix" }), dir("b", { responseLevel: "bold_alternative", assumptions: [], risks: [] })], "d");
    expect(bold.filter((i) => i.severity === "error").map((i) => i.path)).toEqual(["d[1].risks", "d[1].assumptions"]);
  });
});
