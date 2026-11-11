import { z } from "zod";

/** A reviewed candidate needs a decision, not just a favorable score. */
export const ChannelDecisionSchema = z.object({
  firstStep: z.string().trim().min(8).max(500),
  unknowns: z.array(z.string().trim().min(3).max(300)).min(1).max(4),
  setupSteps: z.array(z.string().trim().min(3).max(300)).max(4),
  ownerHoursPerWeek: z.number().min(0).max(168).nullable(),
  effortBasis: z.enum(["owner_reported", "planned", "unknown"]),
  smallestCheck: z.string().trim().min(8).max(500),
  changeCourseIf: z.string().trim().min(8).max(400),
  alternative: z.string().trim().min(8).max(500),
});
export type ChannelDecision = z.infer<typeof ChannelDecisionSchema>;

/** Stored historical rows can omit the brief; malformed new data never becomes advice. */
export function channelDecisionFrom(value: unknown): ChannelDecision | undefined {
  const parsed = ChannelDecisionSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const decision = parsed.data;
  if ((decision.effortBasis === "unknown") !== (decision.ownerHoursPerWeek === null)) return undefined;
  return decision;
}

export const CHANNEL_DECISION_POLICY = "Review the channel candidates briefly, then return a top-level decisions array for only the 3 to 5 most useful candidates to investigate. Each decision has the exact candidate id and decisionBrief: the concrete firstStep for this business, unknowns (at least one uncertainty still to check), setupSteps (empty only when none are needed), ownerHoursPerWeek (null when unknown), effortBasis (owner_reported only when supplied by the owner, planned for an explicitly proposed test allocation, unknown with null hours), smallestCheck (a small reversible check and what evidence to look for), changeCourseIf, and alternative (one plausible alternative and why this candidate should precede it or wait). Do not repeat decisionBrief on every channels row; keep the broad comparison short and the shortlist useful. These are proposed decisions, never a statement of permission or readiness. Do not invent an effort requirement or a business input. A library score alone is not evidence of fit.";
