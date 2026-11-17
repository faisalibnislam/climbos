import { z } from "zod";

export const QUALIFICATION_TOPICS = ["need", "success", "fit", "decision", "timing", "alternatives"] as const;
export const QUALIFICATION_STATES = ["reported", "conflicting", "outdated", "unknown"] as const;
export type QualificationTopic = typeof QUALIFICATION_TOPICS[number];
export const QUALIFICATION_LABELS: Record<QualificationTopic, string> = {
  need: "Problem to solve", success: "What success means", fit: "Fit and delivery constraints",
  decision: "Who decides and how", timing: "Timing and readiness", alternatives: "Other options, including waiting",
};
export const QUALIFICATION_QUESTIONS: Record<QualificationTopic, string> = {
  need: "What problem has this customer described, and why does it matter?",
  success: "What would a useful outcome look like to this customer?",
  fit: "Which requirements can you meet, and what might make this a poor fit?",
  decision: "Who needs to agree, and which evaluation or purchasing steps remain?",
  timing: "Has the customer agreed a timing need or dependency? Leave unknown urgency unknown.",
  alternatives: "What do they use now, and why might they choose it, another option or no change?",
};
export const QualificationObservationSchema = z.object({
  topic: z.enum(QUALIFICATION_TOPICS), state: z.enum(QUALIFICATION_STATES),
  statement: z.string().trim().min(3).max(240), sourceLabel: z.string().trim().min(3).max(160),
  observedOn: z.string(), recordedAt: z.number(), revision: z.number().int().positive(),
});
export const QUALIFICATION_LIMITATIONS = "These are dated owner reports, not independently verified buyer statements, measured intent or purchase probabilities. Conflicting and outdated reports remain unresolved; missing topics are unknown, not failed qualification. A source description is not a fetched or verified document. Recheck material changes with the owner; do not infer urgency, budget, authority or consent. Reading or saving this evidence does not send, schedule, change a stage or approve any action.";
export const QualificationReadSchema = z.object({
  view: z.literal("qualification"), dealId: z.string(), version: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceKind: z.literal("owner_reported"), revision: z.number().int().nonnegative(),
  current: z.array(QualificationObservationSchema).max(6),
  unknownTopics: z.array(z.enum(QUALIFICATION_TOPICS)), limitations: z.string(),
});
