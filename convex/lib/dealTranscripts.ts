import { v } from "convex/values";
export const dealTranscriptFields = {
  index: v.number(), title: v.string(), sourceLabel: v.string(), text: v.string(), textHash: v.string(),
  occurredOn: v.optional(v.string()), permissionConfirmed: v.literal(true), permissionBasis: v.string(),
  recordedAt: v.number(), recordedBy: v.id("users"),
};
