import { v } from "convex/values";

export const customerProgressStateV = v.union(v.literal("evaluating"), v.literal("started"), v.literal("activated"), v.literal("retained"), v.literal("expanding"), v.literal("at_risk"), v.literal("exited"), v.literal("unknown"));
export const customerProgressRuleV = v.object({ scope: v.string(), state: customerProgressStateV, criterion: v.string(), maxAgeDays: v.number() });
export const customerProgressObservationV = v.object({
  scope: v.string(), state: customerProgressStateV, criterion: v.string(), evidence: v.string(), observedOn: v.string(),
  recordedAt: v.number(), recordedBy: v.id("users"), revision: v.number(),
  source: v.optional(v.object({ id: v.id("productTrackingSources"), name: v.string(), event: v.string(), occurredAt: v.number(), conflict: v.optional(v.boolean()) })),
});
export const customerProgressRecordV = v.object({
  current: v.array(customerProgressObservationV), history: v.array(customerProgressObservationV), revision: v.number(),
});
