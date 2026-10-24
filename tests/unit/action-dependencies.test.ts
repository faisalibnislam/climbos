import { describe, expect, it } from "vitest";
import { validateActionDependencies } from "../../shared/agents/actionDependencies";

describe("action dependencies", () => {
  it("accepts independent actions and earlier prerequisites", () => {
    expect(validateActionDependencies([
      { dependsOnActionIndexes: [] },
      { dependsOnActionIndexes: [0] },
      { dependsOnActionIndexes: [0, 1] },
    ])).toEqual([]);
  });

  it("rejects duplicate, self, future, and unsafe references", () => {
    expect(validateActionDependencies([
      { dependsOnActionIndexes: [] },
      { dependsOnActionIndexes: [0, 0, 1, 2, Number.MAX_SAFE_INTEGER + 1] },
    ])).toEqual([
      { actionIndex: 1, dependencyIndex: 0, reason: "duplicate_dependency" },
      { actionIndex: 1, dependencyIndex: 1, reason: "dependency_must_be_earlier" },
      { actionIndex: 1, dependencyIndex: 2, reason: "dependency_must_be_earlier" },
      { actionIndex: 1, dependencyIndex: Number.MAX_SAFE_INTEGER + 1, reason: "dependency_must_be_earlier" },
    ]);
  });
});
