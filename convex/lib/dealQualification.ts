import { v } from "convex/values";
export const qualificationTopicV = v.union(v.literal("need"), v.literal("success"), v.literal("fit"), v.literal("decision"), v.literal("timing"), v.literal("alternatives"));
export const qualificationStateV = v.union(v.literal("reported"), v.literal("conflicting"), v.literal("outdated"), v.literal("unknown"));
export const qualificationObservationV = v.object({
  topic: qualificationTopicV, state: qualificationStateV, statement: v.string(), sourceLabel: v.string(), observedOn: v.string(),
  recordedAt: v.number(), recordedBy: v.id("users"), revision: v.number(),
});
export const dealQualificationV = v.object({ current: v.array(qualificationObservationV), history: v.array(qualificationObservationV), revision: v.number() });
