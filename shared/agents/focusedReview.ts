import { z } from "zod";
import { stringFields } from "./lint";
import type { CritiqueResult, LintIssue, Rubric } from "./types";

export const FOCUSED_REVIEW_ID = "focused-growth-strategy";

/** Compare mechanisms, independently of evidence strength or implementation readiness. */
export const FocusedOriginalityAuditSchema = z.object({
  mechanismQuote: z.string().trim().min(10).max(700).describe("Copy the complete operating mechanism being reviewed verbatim; do not quote its title, another candidate, or a proposed replacement."),
  closestFamiliarAlternative: z.string().trim().min(10).max(600),
  consequentialDifference: z.string().trim().min(10).max(900),
  mechanismVerdict: z.enum(["material_difference", "familiar_mechanism", "unclear_difference"]),
  testQuote: z.string().trim().min(8).max(500).describe("Copy the complete proposed test method verbatim, not a better test you would suggest."),
  comparisonVerdict: z.enum(["isolates_difference", "confounded", "not_explained"]).describe("Does that actual proposed test distinguish the claimed mechanism from its closest ordinary alternative? Missing access or an unbuilt feature alone does not make a private proposed test confounded."),
  testOfDifference: z.string().trim().min(10).max(700),
});
export type FocusedOriginalityAudit = z.infer<typeof FocusedOriginalityAuditSchema>;

export function focusedOriginalityMatches(audit: FocusedOriginalityAudit, output: unknown): boolean {
  const fields = new Map(stringFields(output).map(field => [field.path, field.text.trim()]));
  return audit.mechanismQuote === fields.get("strategyExploration.bold.businessMechanism")
    && audit.testQuote === fields.get("strategyExploration.bold.reversibleTest.method");
}

export const MECHANISM_COMPARISON_GUIDANCE = `Compare with the strongest ordinary way to obtain the same promised result, including manual services, contractual arrangements and workarounds outside the software category. A bare tool is a weak control when an ordinary service already offers the proposed benefit. State the changed rule or exchange after holding ordinary benefits constant, and the response that would distinguish it. Keep audience, promise, information and support comparable except for the mechanism being tested. Include the participant whose behavior must change; a seller's willingness to offer something cannot establish a buyer's response. A private simulation may test comprehension or choices inside that simulation, with demand and real use left untested. If the control is inadequate, repair the comparison rather than inventing a difference or discarding a distinctive uncertain idea. This is analytical comparison, not proof that every business uses that practice or a requirement for a matching precedent.`;

export function lintFocusedOriginalityAudit(critique: CritiqueResult, rubric: Rubric, output?: unknown): LintIssue[] {
  if (!rubric.criteria.some(criterion => criterion.id === "F7")) return [];
  const parsed = FocusedOriginalityAuditSchema.safeParse(critique.originalityAudit);
  const invalid = (message: string): LintIssue[] => [{ rule: "review_scores", severity: "error", path: "review.originalityAudit", message }];
  if (!parsed.success) return invalid("Complete the bold mechanism comparison before accepting its originality score: closest familiar practice, consequential difference, mechanism verdict and test of the difference.");
  if (!focusedOriginalityMatches(parsed.data, output)) {
    return invalid("The originality audit must quote the complete current strategyExploration.bold.businessMechanism and reversibleTest.method verbatim. Review this draft's idea and actual test, not another idea, a previous version or a replacement test you wish it proposed.");
  }
  const scores = critique.scores.filter(score => score.id === "F7");
  if (scores.length === 1 && scores[0].score >= rubric.shipRule.minEach && parsed.data.mechanismVerdict !== "material_difference") {
    return invalid(`The originality score passes but its audit finds ${parsed.data.mechanismVerdict}. A better test or presentation cannot make an unchanged familiar mechanism original. Repair the bold mechanism or correct the inconsistent review; do not approve this draft. Closest practice: ${parsed.data.closestFamiliarAlternative}. Difference: ${parsed.data.consequentialDifference}.`);
  }
  if (scores.length === 1 && scores[0].score >= rubric.shipRule.minEach && parsed.data.comparisonVerdict !== "isolates_difference") {
    return invalid(`The originality criterion passes but its audit finds the proposed comparison ${parsed.data.comparisonVerdict}. Repair the test against the closest ordinary alternative; preserve a distinctive mechanism and keep its evidence/feasibility uncertainty separate. Comparison finding: ${parsed.data.testOfDifference}`);
  }
  return [];
}

export const FOCUSED_ORIGINALITY_REVIEW = `FOCUSED ORIGINALITY AUDIT: Independently compare the actual bold option with its closest familiar practice before scoring F7. Return originalityAudit with mechanismQuote (copy the complete current strategyExploration.bold.businessMechanism verbatim), closestFamiliarAlternative, consequentialDifference, mechanismVerdict, testQuote (the complete current strategyExploration.bold.reversibleTest.method), comparisonVerdict and testOfDifference. Evaluate the test actually proposed before suggesting a repair; a better test in your review cannot validate a weaker test in the draft. Keep mechanism originality separate from comparison quality. F7 cannot pass with a confounded or unexplained comparison. ${MECHANISM_COMPARISON_GUIDANCE} Bind the comparison to that quoted mechanism, not an adjacent option, preliminary candidate or replacement you wish the writer had proposed. Describe what participants do, exchange or gain differently; remove the branding, labels, audience job titles and test instrumentation mentally, then ask what consequential mechanism remains. An approval log added to an approval workflow, a paid trial or a template with feedback is not automatically an unconventional strategy. Explain the actual difference for this business rather than inventing a new one for the writer. Use material_difference only for a specific consequential departure; familiar_mechanism when the mechanism remains ordinary; unclear_difference when the proposal does not explain its departure. This classification concerns the idea, not whether it is proven: an unprecedented, speculative, difficult or currently unbuilt mechanism may have a material difference. Do not require matching precedents, research validation, immediate feasibility or high confidence. Keep evidence, business fit, feasibility, risk and upside separate. testOfDifference compares the changed mechanism with the closest ordinary alternative; a better test does not retroactively make a familiar mechanism original. F7 cannot pass while your own audit finds a familiar or unexplained difference. A distinctive adjacent option does not compensate for a conventional bold one. If the difference is material but relevance or the test is weak, identify that narrower defect without discarding the idea. Assess only the current draft; this is an inspectable judgment, not a claim of worldwide originality.`;

function focusedRepairTarget(critique: CritiqueResult, rubric: Rubric): number {
  // Meeting an individual floor does not mean a criterion passed the overall review.
  // Include its deficit when a complete review is below the rubric's average target.
  const requiredScores = rubric.criteria.map(criterion => critique.scores.filter(score => score.id === criterion.id));
  const complete = requiredScores.every(scores => scores.length === 1 && Number.isFinite(scores[0].score) && scores[0].score >= 1 && scores[0].score <= 5);
  const belowAverage = complete && requiredScores.length > 0
    && requiredScores.reduce((sum, scores) => sum + scores[0].score, 0) / requiredScores.length < rubric.shipRule.minAverage;
  return belowAverage ? Math.max(rubric.shipRule.minEach, rubric.shipRule.minAverage) : rubric.shipRule.minEach;
}

/** Only a current, bound finding needed for a repair belongs in the writer's context. */
export function focusedRevisionOriginality(critique: CritiqueResult, rubric: Rubric, output: unknown): string {
  if (rubric.id !== FOCUSED_REVIEW_ID || !rubric.criteria.some(criterion => criterion.id === "F7")) return "";
  const audit = FocusedOriginalityAuditSchema.safeParse(critique.originalityAudit);
  if (!audit.success || !focusedOriginalityMatches(audit.data, output)) return "";
  const scores = critique.scores.filter(score => score.id === "F7");
  if (scores.length !== 1 || !Number.isFinite(scores[0].score) || scores[0].score < 1 || scores[0].score > 5) return "";
  const needsRepair = scores[0].score < focusedRepairTarget(critique, rubric)
    || (scores[0].score >= rubric.shipRule.minEach && (audit.data.mechanismVerdict !== "material_difference" || audit.data.comparisonVerdict !== "isolates_difference"));
  return needsRepair ? JSON.stringify(audit.data) : "";
}

/** Preserve actionable criterion feedback that the review's short fixes list may omit. */
export function focusedRevisionCriteria(critique: CritiqueResult, rubric: Rubric): string {
  if (rubric.id !== FOCUSED_REVIEW_ID) return "";
  const repairTarget = focusedRepairTarget(critique, rubric);
  return rubric.criteria.flatMap(criterion => {
    const matches = critique.scores.filter(score => score.id === criterion.id);
    if (matches.length !== 1) return [];
    const score = matches[0];
    if (!Number.isFinite(score.score) || score.score < 1 || score.score > 5 || score.score >= repairTarget || !score.fix.trim() || score.fix.trim().toLowerCase() === "none") return [];
    const creativeRepair = criterion.id === "F7" ? "\nCREATIVE REPAIR SCOPE: Preserve passing work, not a rejected mechanism. If the weakness is a familiar bold mechanism, replace that option with a different value exchange, participant role, source of distribution or ownable behavior tied to this business. Do not spend the repair renaming it, adding a celebratory moment, or improving the test for the same conventional idea. You may discard every preliminary candidate; they are not an approved shortlist. If the mechanism is already distinctive and only its evidence labelling or test is weak, repair that specific weakness instead. Keep grounded/adjacent work unless a diversity or consistency correction is needed. State the closest familiar alternative, the consequential difference and a reversible comparison that could show the difference matters. New capabilities remain proposals, with honest unknowns; no precedent, high confidence or immediate feasibility is required, and no execution is authorized." : "";
    return [{ score: score.score, text: `- ${criterion.id} (${criterion.name}, ${score.score}/5): ${score.note.slice(0, 800)} Fix: ${score.fix.slice(0, 1200)}${creativeRepair}` }];
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
- capabilities_and_results: distinguish published feature/price claims from tested functionality, existing assets/programs from proposed drafts, and stated interest/activation from payment, retention or profit. Checkout started, card entry or a payment-link click is not a confirmed successful payment. Check both observation labels and the test brief. Distinguish money collected by the business's customers through an integration from the business's own revenue; do not transfer merchant fees, tax or transaction volume into vendor economics without evidence. Check who can actually do the work, especially focusedMove.aiCanDo: another product's connector documentation does not establish ClimbOS account access or an implemented ability to operate it. Preparing a checklist is different from running its product/payment test. Owner approval is necessary for consequential actions but cannot create missing technical capabilities; a clearly proposed future capability is allowed only as a proposal, not a current AI promise.
Before flagging a promised asset, cross-read its exact preparedWork item: complete text with status draft can support "the draft/outline below is ready for review" or an unsent invitation offering that text. It does not prove a functioning form, tested integration, hosted resource, sent message or live service. A text outline need not have a live URL; flag only the actual unsupported lifecycle claim, quote it precisely, and identify the preparedWork path you checked in basis. Do not require all three modes to be implemented before recommending a test.
Check the preparedWork kind as well as its target. Fictional worked examples belong in test_brief, with each numeric line starting "Fictional test data:" or each value followed by "(illustrative test amount)". A page_copy item saying "private" still receives public-copy checks; status draft, a heading or a bare "(fictional)" cannot waive those findings. When the intended artifact is a private example, request correct classification and local labels while preserving the useful example. Never relabel actual product claims as fictional to avoid evidence requirements.
For owner-reviewable public drafts, a documented first-party feature may be written in the business's own voice without saying "our site says" in every sentence. Cross-read evidenceRefs, status draft and checksBeforeUse: when the exact supplied feature supports the claim and the checks require actual product verification before use, classify it as qualified source-reported copy, not tested functionality. This does not permit unlisted features, inferred plan eligibility, invented speed/results, or claims that a test actually ran. For example, a published conditional-question feature supports a proposed conditional-question example; it does not prove an unlisted editing flow or that the entire job works on a particular free tier.
Verification checks do not create missing feature evidence. A broad source-described function does not establish a more specific behavior inferred by the writer: importing a document does not prove that repeated questions are removed, and collecting responses does not prove that an assistant receives a summary. If an invitation promises that unlisted behavior, mark the promise unsupported even when checksBeforeUse says to test it. A private illustrative artifact or a clearly worded experiment asking whether the behavior is possible may be qualified. Keep the exact lifecycle and wording distinct: a speculative exploration elsewhere cannot qualify a present-tense promise in public copy.
For each category quote the 1–2 most decision-relevant claims using exact string field paths and verbatim substrings. Include every material unsupported claim you find (up to four per category). verdict supported requires the supplied evidence to establish the same scope; qualified requires the draft itself to mark the uncertainty or proposal; unsupported requires a correction. basis identifies the supporting supplied fact/page or the specific missing evidence. Use correction "none" for supported/qualified claims. If a factual correction is required, verdict must be unsupported, even when surrounding text hedges. Optional editorial improvements belong in scored fixes. If there truly is no relevant claim, claims may be empty but basis must explain what you checked. Do not let a supported sentence hide a contradiction elsewhere. This audit is model judgment, not verified truth; code validates coverage and quotations and blocks unsupported findings even if you mark all gates passed. Keep the quality bar unchanged. Assess workload, originality and economic depth in the scored criteria, not as invented fact failures.`;


// Presentation basis: GoalWorkspace, PlanTimeline, PreparedWork and StrategyExplorationPanel.
export const FOCUSED_DECISION_REVIEW = `FOCUSED DECISION REVIEW: Assess this as an owner-reviewable strategy and draft package, not as a published campaign. The numeric bar and hard gates remain unchanged; do not invent defects to sound demanding or require approval dependencies to be completed before the owner can review. A score of 5 means excellent at this requested stage, not permission to execute. Judge one useful decision under the supplied uncertainty, not an imaginary fully researched business. A reasoned provisional segment choice may pass if it compares a concrete alternative, explains the tradeoff and identifies the observation that would reverse it; do not require fabricated demand or comparative speed. Missing costs must remain unknown, with relevant cost lines and what depends on them; never request an invented dollar value for brand embarrassment or buyer pain. Require a concrete useful artifact or example, but do not require invented named customers, researched recipients or product tests that did not run.
PRESENTATION CONTEXT: The current goal workspace opens on Next steps with one selected timeline step. Its checklist and timing details expand on request. Prepared work is a separate tab with individually collapsed drafts; strategy options are another tab whose cards show the title, mechanism and upside, with evidence, risk and test details inside an expandable section. Judge the visible recommendation, one next decision, clarity of each opened artifact and actual work required at later conditional stages. Do not treat the full stored JSON as one screen or count optional exploration details as simultaneous owner assignments. Collapsing detail does not make real work disappear: still flag an overloaded step, missing prepared instructions, unclear actor, avoidable repetition or an unsupported claim that AI can perform the work. Preserve useful source/test detail and required approvals instead of deleting them merely to reduce the stored object's length. No browser interaction or usability test is implied by this presentation context.
Judge originality in the bold mechanism and transfer, not whether the grounded choice is familiar. Low feasibility or an unverified handover must shape a reversible test, not alone lower the originality score. A familiar channel, concierge service, reseller or agency program relabelled as bold remains weak unless it contains a materially different value exchange or behavior. Name the actual conventional mechanism and what change would make this particular proposal distinctive; do not prescribe another familiar program as the universal fix. Assess the stated mechanism, why participants would care, and the discriminating test, not the writer's own novelty rating. Do not force the exploration into the primary execution plan.
Compare the bold option with its closest ordinary practice. Moving billing from an agency to its client is a familiar handoff unless a specific additional mechanism changes value or behavior. Explain what each participant gains beyond shifting a cost, and whether the test distinguishes that new mechanism. Proposed product or offer changes are allowed in exploration without claiming they exist. Judge them on their strategic logic and honestly labelled test, not readiness to publish. Do not require a new artifact kind or field outside the supplied contract; creator_pitch is the existing general outreach-draft kind.
Judge owner burden by sequencing and scope, not by counting necessary approvals as needless tasks. focusedMove, firstActions and the first phase entry share canonical text across separate UI surfaces; do not request that these aliases diverge or count them as extra owner work. Evaluate the actual tasks and prepared documents. Clearly local-labelled fictional test amounts can make a private worked example complete; they are not business prices or evidence. Require the distinction rather than deleting the example or asking the owner to invent it. One clear first review with later, explicit product/access/approval dependencies can be manageable. A proposed fix must preserve that single step: do not combine a new access question with an existing review and then penalize the resulting bundle. Require the one question first only if its answer changes the immediate decision; otherwise keep it at the later dependency it unlocks. Never invent automated build/support capabilities to transfer necessary work away from the owner. Never recommend removing required permissions, source checks or real product verification merely to raise simplicity. A proposed invitation cap is a workload limit, not a statistical sufficiency threshold or a license to declare failed demand. When supplied evidence describes an external free or current alternative for the same job, check that the recommendation addresses it. An internal paywall is not a competitive advantage, but similar feature labels do not prove equal results or eliminate a reasonable test of an unresolved buyer consequence. Do not demand invented superiority. For a subscription, a one-off task and repeat paid value are different hypotheses. A list of paid features is not a buyer-value explanation; require the buyer situation, a proposed consequence of the feature, current alternative and an observable choice, without inventing monetary pain. Test exposure, activation, payment, repeat use and cost remain distinct; no exposure or insufficient observation is not evidence of failed demand. Payment can legitimately precede activation when the product requires a paid plan. Do not call that sequence a measurement error or replace the product-value event with viewing a sample merely to avoid a payment prerequisite. Record plan purchase and successful product use separately, including people who decline or cannot access the paid feature. Cross-check the actor and access branch in the private brief, invitation and primary metric: an owner-account demonstration cannot count as a participant using the product. With access unknown, conditional branches are sufficient; do not ask the owner again or invent a free trial. A sample walkthrough supports comprehension or job-fit learning only; unavailable plan access leaves product activation untested. When access or owner time remains unknown by choice, check whether the private brief gives a specific conditional way to investigate eligible access without pretending a reachable audience exists. "Find testers" or "record not-run" alone is not a distribution fallback. Do not require recruiting now, add a second live campaign or repeat a deferred owner question. A query or route to inspect must be labelled proposed research with current rule/fit checks, not an already verified channel. Preserve prepared assets and useful alternative mechanisms in a revision rather than stripping substance to make the answer shorter.`;
