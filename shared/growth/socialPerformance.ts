/** Deterministic post-level calculations from provider-reported snapshots. */

export interface SocialMetric {
  metric: string;
  value: number;
}

/**
 * Calculates interaction actions per reached account as a percentage.
 * Requires all component metrics so a partial sum is never mislabeled as a
 * complete engagement rate. This is not a unique-engager rate: one account
 * may contribute more than one action.
 */
export function instagramActionsPerReach(metrics: readonly SocialMetric[]): SocialMetric | null {
  const values = new Map(metrics.map(({ metric, value }) => [metric, value]));
  const reach = values.get("reach");
  const actionMetrics = ["likes", "comments", "saved", "shares"] as const;
  if (typeof reach !== "number" || !Number.isSafeInteger(reach) || reach <= 0) return null;
  const actions = actionMetrics.map((metric) => values.get(metric));
  if (actions.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) return null;
  const totalActions = actions.reduce<number>((total, value) => total + (value ?? 0), 0);
  if (!Number.isSafeInteger(totalActions)) return null;
  return {
    metric: "calculated_actions_per_reach_pct",
    value: (totalActions / reach) * 100,
  };
}
