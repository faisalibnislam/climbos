import { z } from "zod";
import { stringFields } from "./lint";
import type { CritiqueResult, LintIssue, Rubric } from "./types";

export const FOCUSED_REVIEW_ID = "focused-growth-strategy";

/** Preserve actionable criterion feedback that the review's short fixes list may omit. */
export function focusedRevisionCriteria(critique: CritiqueResult, rubric: Rubric): string {
  if (rubric.id !== FOCUSED_REVIEW_ID) return "";
  return rubric.criteria.flatMap(criterion => {
    const matches = critique.scores.filter(score => score.id === criterion.id);
    if (matches.length !== 1) return [];
    const score = matches[0];
    if (!Number.isFinite(score.score) || score.score < 1 || score.score >= rubric.shipRule.minEach || !score.fix.trim() || score.fix.trim().toLowerCase() === "none") return [];
    return [{ score: score.score, text: `- ${criterion.id} (${criterion.name}, ${score.score}/5): ${score.note.slice(0, 800)} Fix: ${score.fix.slice(0, 1200)}` }];
  }).sort((a, b) => a.score - b.score).map(row => row.text).join("\n");
}
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

/** Repair only an omitted parent/index when one verbatim quote identifies exactly one compatible field. */
export function resolveFocusedEvidencePaths(critique: CritiqueResult, output: unknown): CritiqueResult {
  const parsed = FocusedEvidenceAuditSchema.safeParse(critique.evidenceAudit);
  if (!parsed.success || output === undefined) return critique;
  const fields = stringFields(output);
  const corrections: NonNullable<CritiqueResult["evidencePathCorrections"]> = [];
  const evidenceAudit = parsed.data.map(row => ({ ...row, claims: row.claims.map(claim => {
    if (!claim.quote.trim() || fields.some(field => field.path === claim.path && field.text.includes(claim.quote))) return claim;
    // Dot-number array notation denotes the same exact index, not a search for another claim.
    const bracketPath = claim.path.replace(/\.(\d+)(?=\.|\[|$)/g, "[$1]");
    if (bracketPath !== claim.path && fields.some(field => field.path === bracketPath && field.text.includes(claim.quote))) {
      corrections.push({ reportedPath: claim.path, resolvedPath: bracketPath, quote: claim.quote });
      return { ...claim, path: bracketPath };
    }
    // An explicit array path supplies the missing scope even when the same citation occurs elsewhere.
    const inArray = fields.filter(field => field.path.startsWith(`${claim.path}[`) && field.text.includes(claim.quote));
    const matches = inArray.length ? inArray : fields.filter(field => field.text.includes(claim.quote));
    if (matches.length !== 1) return claim;
    const resolvedPath = matches[0].path;
    if (!resolvedPath.startsWith(`${claim.path}[`) && !resolvedPath.endsWith(`.${claim.path}`)) return claim;
    corrections.push({ reportedPath: claim.path, resolvedPath, quote: claim.quote });
    return { ...claim, path: resolvedPath };
  }) }));
  return corrections.length ? { ...critique, evidenceAudit, evidencePathCorrections: corrections } : critique;
}

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
      if (claim.verdict !== "unsupported" && claim.correction.trim().toLowerCase() !== "none") {
        issues.push(invalid(`The ${row.category} review marks a claim ${claim.verdict} but requires a factual correction. Use unsupported for a materially incorrect claim; put optional editorial improvements in scored fixes.`));
      }
      if (claim.verdict === "unsupported") issues.push({ severity: "error", rule: "invented_fact", path: claim.path, message: `The evidence reviewer flagged: “${claim.quote}” ${claim.basis} Fix: ${claim.correction}` });
    }
  }
  return issues;
}

export const FOCUSED_EVIDENCE_REVIEW = `FOCUSED EVIDENCE AUDIT: Before scoring, inspect the whole draft (including strategicDirection, channel rationale, actions and prepared copy) for qualitative factual claims, not just numbers. Return evidenceAudit with exactly one row per category:
- business_state: check unknown versus absent audiences, contacts, traffic, revenue, budget, readiness and capacity. One missing measure or no traffic does not prove no followers, contacts or customers. An evaluation spending cap is not the owner's real budget.
- comparative_claims: check fastest, cheapest, best, easiest or most effective route claims. Preference with an explicit hypothesis and tradeoff is allowed; an objective comparison needs supplied comparative evidence. Do not require a precedent for a novel proposal.
- capabilities_and_results: distinguish published feature/price claims from tested functionality, existing assets/programs from proposed drafts, and stated interest/activation from payment, retention or profit. Checkout started, card entry or a payment-link click is not a confirmed successful payment. Check both observation labels and the test brief. Distinguish money collected by the business's customers through an integration from the business's own revenue; do not transfer merchant fees, tax or transaction volume into vendor economics without evidence.
Before flagging a promised asset, cross-read its exact preparedWork item: complete text with status draft can support "the draft/outline below is ready for review" or an unsent invitation offering that text. It does not prove a functioning form, tested integration, hosted resource, sent message or live service. A text outline need not have a live URL; flag only the actual unsupported lifecycle claim, quote it precisely, and identify the preparedWork path you checked in basis. Do not require all three modes to be implemented before recommending a test.
For owner-reviewable public drafts, a documented first-party feature may be written in the business's own voice without saying "our site says" in every sentence. Cross-read evidenceRefs, status draft and checksBeforeUse: when the exact supplied feature supports the claim and the checks require actual product verification before use, classify it as qualified source-reported copy, not tested functionality. This does not permit unlisted features, inferred plan eligibility, invented speed/results, or claims that a test actually ran. For example, a published conditional-question feature supports a proposed conditional-question example; it does not prove an unlisted editing flow or that the entire job works on a particular free tier.
Verification checks do not create missing feature evidence. A broad source-described function does not establish a more specific behavior inferred by the writer: importing a document does not prove that repeated questions are removed, and collecting responses does not prove that an assistant receives a summary. If an invitation promises that unlisted behavior, mark the promise unsupported even when checksBeforeUse says to test it. A private illustrative artifact or a clearly worded experiment asking whether the behavior is possible may be qualified. Keep the exact lifecycle and wording distinct: a speculative exploration elsewhere cannot qualify a present-tense promise in public copy.
For each category quote the 1–2 most decision-relevant claims using exact string field paths and verbatim substrings. Include every material unsupported claim you find (up to four per category). verdict supported requires the supplied evidence to establish the same scope; qualified requires the draft itself to mark the uncertainty or proposal; unsupported requires a correction. basis identifies the supporting supplied fact/page or the specific missing evidence. Use correction "none" for supported/qualified claims. If a factual correction is required, verdict must be unsupported, even when surrounding text hedges. Optional editorial improvements belong in scored fixes. If there truly is no relevant claim, claims may be empty but basis must explain what you checked. Do not let a supported sentence hide a contradiction elsewhere. This audit is model judgment, not verified truth; code validates coverage and quotations and blocks unsupported findings even if you mark all gates passed. Keep the quality bar unchanged. Assess workload, originality and economic depth in the scored criteria, not as invented fact failures.`;


export const FOCUSED_DECISION_REVIEW = `FOCUSED DECISION REVIEW: Assess this as an owner-reviewable strategy and draft package, not as a published campaign. The numeric bar and hard gates remain unchanged; do not invent defects to sound demanding or require approval dependencies to be completed before the owner can review. A score of 5 means excellent at this requested stage, not permission to execute. Judge one useful decision under the supplied uncertainty, not an imaginary fully researched business. A reasoned provisional segment choice may pass if it compares a concrete alternative, explains the tradeoff and identifies the observation that would reverse it; do not require fabricated demand or comparative speed. Missing costs must remain unknown, with relevant cost lines and what depends on them; never request an invented dollar value for brand embarrassment or buyer pain. Require a concrete useful artifact or example, but do not require invented named customers, researched recipients or product tests that did not run.
Judge originality in the bold mechanism and transfer, not whether the grounded choice is familiar. Low feasibility or an unverified handover must shape a reversible test, not alone lower the originality score. A familiar channel, concierge service, reseller or agency program relabelled as bold remains weak unless it contains a materially different value exchange or behavior. Name the actual conventional mechanism and what change would make this particular proposal distinctive; do not prescribe another familiar program as the universal fix. Assess the stated mechanism, why participants would care, and the discriminating test, not the writer's own novelty rating. Do not force the exploration into the primary execution plan.
Compare the bold option with its closest ordinary practice. Moving billing from an agency to its client is a familiar handoff unless a specific additional mechanism changes value or behavior. Explain what each participant gains beyond shifting a cost, and whether the test distinguishes that new mechanism. Proposed product or offer changes are allowed in exploration without claiming they exist. Judge them on their strategic logic and honestly labelled test, not readiness to publish. Do not require a new artifact kind or field outside the supplied contract; creator_pitch is the existing general outreach-draft kind.
Judge owner burden by sequencing and scope, not by counting necessary approvals as needless tasks. focusedMove, firstActions and the first phase entry share canonical text across separate UI surfaces; do not request that these aliases diverge or count them as extra owner work. Evaluate the actual tasks and prepared documents. Clearly local-labelled fictional test amounts can make a private worked example complete; they are not business prices or evidence. Require the distinction rather than deleting the example or asking the owner to invent it. One clear first review with later, explicit product/access/approval dependencies can be manageable. A proposed fix must preserve that single step: do not combine a new access question with an existing review and then penalize the resulting bundle. Require the one question first only if its answer changes the immediate decision; otherwise keep it at the later dependency it unlocks. Never invent automated build/support capabilities to transfer necessary work away from the owner. Never recommend removing required permissions, source checks or real product verification merely to raise simplicity. A proposed invitation cap is a workload limit, not a statistical sufficiency threshold or a license to declare failed demand. A list of paid features is not a buyer-value explanation; require the buyer situation, a proposed consequence of the feature, current alternative and an observable choice, without inventing monetary pain. Test exposure, activation, payment, repeat use and cost remain distinct; no exposure or insufficient observation is not evidence of failed demand. When access or owner time remains unknown by choice, check whether the private brief gives a specific conditional way to investigate eligible access without pretending a reachable audience exists. "Find testers" or "record not-run" alone is not a distribution fallback. Do not require recruiting now, add a second live campaign or repeat a deferred owner question. A query or route to inspect must be labelled proposed research with current rule/fit checks, not an already verified channel. Preserve prepared assets and useful alternative mechanisms in a revision rather than stripping substance to make the answer shorter.`;
