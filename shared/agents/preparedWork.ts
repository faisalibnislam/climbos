import { z } from "zod";
import type { AgentInput, LintIssue } from "./types";

/** Small, useful drafts produced with the recommendation. These confer no execution permission. */
export const PreparedWorkSchema = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["page_copy", "creator_pitch", "social_post", "test_brief"]),
  target: z.string().min(1).max(600),
  draft: z.string().min(40).max(6000),
  evidenceRefs: z.array(z.string()).max(8),
  checksBeforeUse: z.array(z.string()).max(4),
  status: z.literal("draft"),
});
export type PreparedWork = z.infer<typeof PreparedWorkSchema>;
/** Both initial plans and later step work must reject unfinished destinations. */
export const hasUnfinishedDestination = (text: string) => /\b(?:(?:GUIDE|PAGE)-(?:ADDRESS|URL|LINK)|YOUR-(?:URL|LINK|PAGE)|INSERT-(?:LINK|URL))\b|\[(?:page\s+link|insert\b[^\]]*|your\s+(?:website|link|company|name)|link\s+here)\]/i.test(text);
export const PREPARED_WORK_POLICY = `DO USEFUL WORK NOW: Include 1–3 preparedWork drafts, each tied to the primary move and a confirmed source asset or explicitly labelled proposed asset. Write the actual page, editorial pitch, native social draft or complete test brief now; 'AI will draft it' is not a draft. Give a plain title, kind, exact target, complete draft (40–6000 characters for page_copy; 40–2400 for other kinds), source references and the specific checks needed before use. A how-to page needs ordered instructions supported by the supplied product evidence, not just a feature list. Mark status draft. Do not invent a recipient relationship, tested product behavior, outcome, contact permission, promotion or deadline. A pitch is an unsent editorial suggestion, not a sponsorship commitment. Never claim prepared text is already published, sent or implemented. Keep drafts together in preparedWork, not repeated across plan fields. Owner time, money, demand and performance stay unknown when not supplied. Useful low-risk drafting and research should proceed alongside measurement; only the action that truly depends on private information should wait.`;
export function lintPreparedWork(work: PreparedWork[] | undefined, input: AgentInput): LintIssue[] {
  const known = new Set(input.availableSourceUrls ?? input.precomputedResearch?.sources.map((s) => s.url) ?? []);
  return (work ?? []).flatMap((item, i) => [...(item.kind !== "page_copy" && item.draft.length > 2400 ? [{ severity: "error" as const, rule: "word_cap", path: `preparedWork[${i}].draft`, message: "Keep non-page prepared drafts within 2400 characters." }] : []), ...item.evidenceRefs.flatMap((ref): LintIssue[] => {
    const index = /^fact:(\d+)$/.exec(ref);
    const valid = index ? Number(index[1]) >= 0 && Number(index[1]) < input.facts.length : known.has(ref);
    return valid ? [] : [{ severity: "error", rule: "citation", path: `preparedWork[${i}].evidenceRefs`, message: "A prepared draft cites evidence this run did not receive." }];
  })]);
}
