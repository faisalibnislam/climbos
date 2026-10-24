/**
 * The parts of a growth plan an owner can compare and restore one at a time.
 * Each part names the stored fields it covers (top-level or under `expert`).
 */
export const PLAN_PARTS = [
  { key: "summary", label: "Summary", fields: ["summary"], expert: [] },
  { key: "positioning", label: "How you stand out", fields: ["positioning"], expert: [] },
  { key: "target", label: "Diagnosis and target", fields: [], expert: ["diagnosis", "affordableCac", "northStar", "leadingIndicators"] },
  { key: "plays", label: "Growth plays", fields: [], expert: ["plays", "economics", "growthPlanV8"] },
  { key: "execution", label: "Execution plan", fields: [], expert: ["phases", "weekOneChecklist", "risks", "notDoing"] },
  { key: "audiences", label: "Audiences", fields: ["audiences"], expert: [] },
  { key: "channels", label: "Channels", fields: ["channels"], expert: [] },
  { key: "experiments", label: "Experiments", fields: [], expert: [] },
  { key: "basics", label: "Constraints and measurement", fields: ["constraints", "measurementPlan"], expert: [] },
] as const;

export type PlanPartKey = (typeof PLAN_PARTS)[number]["key"];

export const PLAN_PART_KEYS = PLAN_PARTS.map((p) => p.key) as PlanPartKey[];

export function planPartLabel(key: string): string {
  return PLAN_PARTS.find((p) => p.key === key)?.label ?? key;
}

/** "Channels and Growth plays", "all parts" when every part was taken. */
export function describeParts(keys: readonly string[]): string {
  if (keys.length >= PLAN_PARTS.length) return "all parts";
  const labels = keys.map(planPartLabel);
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
