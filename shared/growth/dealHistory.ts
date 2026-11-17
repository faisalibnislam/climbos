import { z } from "zod";

export const DEAL_STAGES = ["lead", "talking", "booked", "won", "lost"] as const;
export type DealStage = typeof DEAL_STAGES[number];
export const DEAL_STAGE_LABELS: Record<DealStage, string> = { lead: "Possible customer", talking: "In conversation", booked: "Call booked", won: "Sale recorded", lost: "Did not go ahead" };
export const DEAL_HISTORY_SOURCES = ["owner", "prospect", "booking", "booking_cancelled", "inbound"] as const;
export const DEAL_HISTORY_LABELS = { owner: "Owner-reported change", prospect: "Recorded prospect progress", booking: "Recorded booking", booking_cancelled: "Recorded booking cancellation", inbound: "Recorded inbound capture" };
export const DealStageEventSchema = z.object({ sequence: z.number().int().positive(), from: z.enum(DEAL_STAGES).nullable(), to: z.enum(DEAL_STAGES), at: z.number(), source: z.enum(DEAL_HISTORY_SOURCES) });
export const DealHistoryReadSchema = z.object({
  view: z.literal("history"), dealId: z.string(), version: z.string(),
  events: z.array(DealStageEventSchema).max(20), total: z.number().int().nonnegative(), retained: z.number().int().nonnegative(),
  fromCreation: z.boolean(), nextBefore: z.number().nullable(), limitations: z.string(),
});
export const DEAL_HISTORY_LIMITATIONS = "These are changes recorded by ClimbOS, not verified buyer decisions, event occurrence times outside ClimbOS, payment receipts or a complete conversation. Owner changes and captured workflow events remain distinct. A booked call does not establish qualification. Earlier history may be unknown or outside the 100-event retention window. Do not infer close probabilities, causal lift or permission to contact from stages. Reading history executes no actions.";
