import { v } from "convex/values";

/** Shared storage and mutation shape; values are validated by outcomeProblems. */
export const experimentMeasurementV = v.object({
  type: v.union(v.literal("count"), v.literal("continuous"), v.literal("monetary")),
  value: v.union(v.number(), v.null()),
  comparisonValue: v.union(v.number(), v.null()),
  unit: v.string(),
  currency: v.optional(v.string()),
  basis: v.string(),
  comparisonBasis: v.string(),
});
