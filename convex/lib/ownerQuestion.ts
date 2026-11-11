import { v } from "convex/values";
export const ownerQuestionV = v.object({ title: v.string(), reason: v.string(), kind: v.union(v.literal("single"), v.literal("multiple")), options: v.array(v.object({ id: v.string(), label: v.string() })), allowOther: v.boolean(), status: v.union(v.literal("pending"), v.literal("answered")), answerText: v.optional(v.string()) });
