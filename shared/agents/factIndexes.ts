import type { LintIssue } from "./types";

/** Check model-selected fact references against the exact ordered facts supplied to this run. */
export function lintFactIndexes(indexes: number[], factCount: number, path = "factIndexes"): LintIssue[] {
  const invalid = indexes.filter((index) => !Number.isInteger(index) || index < 0 || index >= factCount);
  if (!invalid.length) return [];
  return [{
    severity: "error",
    rule: "fact_reference",
    message: `Fact reference${invalid.length === 1 ? "" : "s"} ${[...new Set(invalid)].join(", ")} ${invalid.length === 1 ? "does" : "do"} not exist in this run's confirmed fact list (0–${Math.max(0, factCount - 1)}). Remove it or cite a supplied fact.`,
    path,
  }];
}
