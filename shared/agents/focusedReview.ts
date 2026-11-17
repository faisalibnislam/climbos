import { z } from "zod";
import { stringFields } from "./lint";
import type { LintIssue } from "./types";

export const FOCUSED_REVIEW_ID = "focused-growth-strategy";
export const EVIDENCE_AUDIT_CATEGORIES = ["business_state", "comparative_claims", "capabilities_and_results"] as const;
export const FocusedEvidenceAuditSchema = z.array(z.object({
  category: z.enum(EVIDENCE_AUDIT_CATEGORIES),
  basis: z.string().min(1).max(700),
  claims: z.array(z.object({
    path: z.string().min(1).max(300),
    quote: z.string().min(1).max(700),
    verdict: z.enum(["supported", "qualified", "unsupported"]),
    basis: z.string().min(1).max(700),
    correction: z.string().min(1).max(700),
  })).max(4),
})).length(3);
export type FocusedEvidenceAudit = z.infer<typeof FocusedEvidenceAuditSchema>;

/** Enforces the review contract, not semantic entailment: the reviewer can still miss a claim. */
export function lintFocusedEvidenceAudit(value: unknown, output?: unknown): LintIssue[] {
  const parsed = FocusedEvidenceAuditSchema.safeParse(value);
  const invalid = (message: string): LintIssue => ({ severity: "error", rule: "review_scores", path: "review.evidenceAudit", message });
  if (!parsed.success || EVIDENCE_AUDIT_CATEGORIES.some(category => parsed.data.filter(row => row.category === category).length !== 1)) {
    return [invalid("The focused review needs exactly one evidence audit for business state, comparative claims, and capabilities/results. Complete the review before accepting this draft.")];
  }
  const fields = output === undefined ? null : new Map(stringFields(output).map(field => [field.path, field.text]));
  const issues: LintIssue[] = [];
  for (const row of parsed.data) {
    if (!row.basis.trim()) issues.push(invalid(`Explain what was checked for ${row.category}, including when no relevant claim exists.`));
    for (const claim of row.claims) {
      if (!claim.quote.trim() || !claim.basis.trim() || !claim.correction.trim() || (fields && !fields.get(claim.path)?.includes(claim.quote))) {
        issues.push(invalid(`The ${row.category} audit must quote the exact current draft at ${claim.path} and explain its evidence basis and correction. Do not invent a quotation or reuse another draft's review.`));
      }
      if (claim.verdict === "unsupported") issues.push({ severity: "error", rule: "invented_fact", path: claim.path, message: `The evidence reviewer flagged: “${claim.quote}” ${claim.basis} Fix: ${claim.correction}` });
    }
  }
  return issues;
}

export const FOCUSED_EVIDENCE_REVIEW = `FOCUSED EVIDENCE AUDIT: Before scoring, inspect the whole draft (including strategicDirection, channel rationale, actions and prepared copy) for qualitative factual claims, not just numbers. Return evidenceAudit with exactly one row per category:
- business_state: check unknown versus absent audiences, contacts, traffic, revenue, budget, readiness and capacity. One missing measure or no traffic does not prove no followers, contacts or customers. An evaluation spending cap is not the owner's real budget.
- comparative_claims: check fastest, cheapest, best, easiest or most effective route claims. Preference with an explicit hypothesis and tradeoff is allowed; an objective comparison needs supplied comparative evidence. Do not require a precedent for a novel proposal.
- capabilities_and_results: distinguish published feature/price claims from tested functionality, existing assets/programs from proposed drafts, and stated interest/activation from payment, retention or profit.
For each category quote the 1–2 most decision-relevant claims using exact string field paths and verbatim substrings. Include every material unsupported claim you find (up to four per category). verdict supported requires the supplied evidence to establish the same scope; qualified requires the draft itself to mark the uncertainty or proposal; unsupported requires a correction. basis identifies the supporting supplied fact/page or the specific missing evidence. Use correction "none" when no correction is needed. If there truly is no relevant claim, claims may be empty but basis must explain what you checked. Do not let a supported sentence hide a contradiction elsewhere. This audit is model judgment, not verified truth; code validates coverage and quotations and blocks unsupported findings even if you mark all gates passed. Keep the quality bar unchanged. Assess workload, originality and economic depth in the scored criteria, not as invented fact failures.`;
