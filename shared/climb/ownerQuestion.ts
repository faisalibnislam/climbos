import { z } from "zod";
export const OwnerQuestionSchema = z.object({
  title: z.string().trim().min(4).max(180),
  reason: z.string().trim().min(4).max(300),
  kind: z.enum(["single", "multiple"]),
  options: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), label: z.string().trim().min(1).max(120) })).min(2).max(5),
  allowOther: z.boolean(),
}).refine((q) => new Set(q.options.map((option) => option.id)).size === q.options.length, "Option IDs must be distinct");
export type OwnerQuestion = z.infer<typeof OwnerQuestionSchema>;
export function ownerAnswer(question: OwnerQuestion, answer: { optionIds: string[]; notSure: boolean; other?: string }): string {
  const ids = [...new Set(answer.optionIds)];
  const other = answer.other?.trim() ?? "";
  if (ids.length !== answer.optionIds.length || ids.some((id) => !question.options.some((option) => option.id === id))) throw new Error("Choose one of the current options.");
  if (answer.notSure) {
    if (ids.length || other) throw new Error("Choose ‘I’m not sure’ on its own.");
    return `Question: ${question.title}\nOwner answer: I’m not sure. This remains unknown; do not treat it as a confirmed fact or permission.`;
  }
  if ((other && !question.allowOther) || other.length > 1200 || (!ids.length && !other) || (question.kind === "single" && ids.length + (other ? 1 : 0) !== 1)) throw new Error("Choose an answer before continuing.");
  return `Question: ${question.title}\nOwner-reported answer: ${[...ids.map((id) => question.options.find((option) => option.id === id)!.label), ...(other ? [other] : [])].join("; ")}\nThis answer supplies context, not approval to publish, send or spend.`;
}
/** Short owner-facing receipt; the full evidence/permission context stays in model history. */
export function ownerAnswerLabel(question: OwnerQuestion, answer: { optionIds: string[]; notSure: boolean; other?: string }): string {
  ownerAnswer(question, answer);
  if (answer.notSure) return "I’m not sure yet";
  return [...answer.optionIds.map((id) => question.options.find((option) => option.id === id)!.label), ...(answer.other?.trim() ? [answer.other.trim()] : [])].join("; ");
}
