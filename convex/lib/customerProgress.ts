import { v } from "convex/values";

export const customerProgressStateV = v.union(v.literal("evaluating"), v.literal("started"), v.literal("activated"), v.literal("retained"), v.literal("expanding"), v.literal("at_risk"), v.literal("exited"), v.literal("unknown"));
export const customerProgressObservationV = v.object({
  scope: v.string(), state: customerProgressStateV, criterion: v.string(), evidence: v.string(), observedOn: v.string(),
  recordedAt: v.number(), recordedBy: v.id("users"), revision: v.number(),
});
export const customerProgressRecordV = v.object({
  current: v.array(customerProgressObservationV), history: v.array(customerProgressObservationV), revision: v.number(),
});
