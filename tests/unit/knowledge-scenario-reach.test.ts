import { describe, expect, it } from "vitest";
import { retrieveGrowthKnowledge } from "../../shared/knowledge/retrieve";

describe("problem-scenario reach", () => {
  const query = "TASK: Grow repeat orders this quarter.\nBRIEF: Small team, limited budget, wants more returning customers.";

  it("uses the owner-chosen industry business type to reach its problem scenarios", () => {
    const without = retrieveGrowthKnowledge(query, { limit: 3, maxChars: 3_500 });
    const withType = retrieveGrowthKnowledge(query, { limit: 3, maxChars: 3_500, businessTypeId: "BT-006" });
    expect(without.some((r) => r.kind === "scenario")).toBe(false);
    expect(withType.some((r) => r.kind === "scenario" && r.businessType === "DTC e-commerce")).toBe(true);
  });
});
