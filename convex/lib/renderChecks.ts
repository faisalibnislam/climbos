import { v } from "convex/values";

export const renderChecksV = v.object({ method: v.literal("rendered_dom_sample"), checkedAt: v.number(), viewport: v.object({ width: v.number(), height: v.number() }), sampledElements: v.number(), checks: v.array(v.object({ id: v.string(), state: v.union(v.literal("pass"), v.literal("review")), evidence: v.string() })) });
