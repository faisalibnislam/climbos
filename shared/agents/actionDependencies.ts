export interface ActionDependenciesInput {
  dependsOnActionIndexes: readonly number[];
}

export interface ActionDependencyIssue {
  actionIndex: number;
  dependencyIndex?: number;
  reason: "duplicate_dependency" | "dependency_must_be_earlier";
}

/** Dependencies must refer to unique earlier actions, which makes the graph acyclic by construction. */
export function validateActionDependencies(actions: readonly ActionDependenciesInput[]): ActionDependencyIssue[] {
  const issues: ActionDependencyIssue[] = [];
  for (const [actionIndex, action] of actions.entries()) {
    const seen = new Set<number>();
    for (const dependencyIndex of action.dependsOnActionIndexes) {
      if (seen.has(dependencyIndex)) {
        issues.push({ actionIndex, dependencyIndex, reason: "duplicate_dependency" });
        continue;
      }
      seen.add(dependencyIndex);
      if (!Number.isSafeInteger(dependencyIndex) || dependencyIndex < 0 || dependencyIndex >= actionIndex) {
        issues.push({ actionIndex, dependencyIndex, reason: "dependency_must_be_earlier" });
      }
    }
  }
  return issues;
}
