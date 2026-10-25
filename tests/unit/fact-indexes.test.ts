import { describe, expect, it } from "vitest";
import { lintFactIndexes } from "../../shared/agents/factIndexes";

describe("fact reference checks", () => {
  it("accepts only integer indexes in the exact run's fact list", () => {
    expect(lintFactIndexes([0, 2], 3)).toEqual([]);
    expect(lintFactIndexes([], 0)).toEqual([]);
    expect(lintFactIndexes([3, -1, 1.5], 3)).toMatchObject([{ rule: "fact_reference", path: "factIndexes" }]);
  });

  it("keeps the specific output path for an invalid reference", () => {
    expect(lintFactIndexes([8], 1, "posts[2].factIndexes")).toMatchObject([{ path: "posts[2].factIndexes" }]);
  });
});
