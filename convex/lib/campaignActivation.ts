import { v } from "convex/values";

export const campaignActivationObservationV = v.object({
  provider: v.union(v.literal("google_ads"), v.literal("meta_ads")),
  accountId: v.string(), campaignId: v.string(), currency: v.string(), timeZone: v.string(),
  status: v.string(), kind: v.string(), budgetAmount: v.string(),
  budgetPeriod: v.optional(v.string()), budgetShared: v.optional(v.boolean()),
  startDateTime: v.optional(v.string()), endDateTime: v.optional(v.string()),
});
