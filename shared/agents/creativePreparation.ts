import { z } from "zod";
import { FocusedOriginalityAuditSchema } from "./focusedReview";

/** A bounded preparation step in the same strategy run, never facts or action authority. */
// Includes adaptive reasoning plus all three or four complete candidate records.
export const CREATIVE_PREPARATION_TOKENS = 16_000;
// Includes adaptive reasoning and the complete per-candidate audits plus developed direction.
export const CREATIVE_FEEDBACK_TOKENS = 16_000;
const CreativeMethodSchema = z.enum(["convention_inversion", "distant_transfer", "asset_recombination", "ownable_behavior"]);
export const CreativeDirectionSchema = z.object({
  creativeMethod: CreativeMethodSchema,
  methodApplication: z.string().trim().min(20).max(600),
  title: z.string().trim().min(3).max(120),
  businessTension: z.string().trim().min(10).max(500),
  mechanism: z.string().trim().min(10).max(700),
  changedBehavior: z.string().trim().min(10).max(400),
  whyParticipantsCare: z.string().trim().min(10).max(500),
  closestFamiliarAlternative: z.string().trim().min(10).max(300),
  meaningfulDifference: z.string().trim().min(10).max(500),
  unsupportedAssumptions: z.array(z.string().trim().min(3).max(220)).max(5),
  reversibleTest: z.string().trim().min(10).max(500),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(5),
});
export const CreativePreparationSchema = z.object({
  directions: z.array(CreativeDirectionSchema).min(3).max(4).superRefine((directions, ctx) => {
    const methods = new Set(directions.map(direction => direction.creativeMethod));
    if (methods.size !== directions.length || !methods.has("convention_inversion") || !methods.has("distant_transfer")) {
      ctx.addIssue({ code: "custom", message: "Use distinct creative methods, including a convention inversion and a distant-industry transfer. Method labels alone do not establish originality." });
    }
  }),
});

/** Advisory comparison before expansion, never a ranking or an originality gate. */
export const CreativeFeedbackSchema = z.object({
  directions: z.array(FocusedOriginalityAuditSchema.extend({
    creativeMethod: CreativeMethodSchema,
    candidateTitle: z.string().trim().min(3).max(120),
  })).min(3).max(4),
  developedDirection: CreativeDirectionSchema,
});

export function creativeFeedbackMatches(
  preparation: z.infer<typeof CreativePreparationSchema>, feedback: z.infer<typeof CreativeFeedbackSchema>,
): boolean {
  return feedback.directions.length === preparation.directions.length && preparation.directions.every(candidate =>
    feedback.directions.filter(row => row.creativeMethod === candidate.creativeMethod && row.candidateTitle === candidate.title && row.mechanismQuote === candidate.mechanism.trim()).length === 1);
}

export const CREATIVE_FEEDBACK_TASK = `Independently examine every preliminary strategic direction before a writer expands it into a complete plan. These are proposals, not selected recommendations, facts or authority. Return one concise audit per supplied candidate, copying its creativeMethod and title exactly into candidateTitle, and its complete mechanism verbatim into mechanismQuote. Audit that quoted mechanism, not a proposed improvement or another candidate.

Compare the operating mechanism with the closest familiar alternative. Remove the branding, metaphor, new job title and test instrumentation: what do participants actually do, exchange, control or gain differently? Explain whether the claimed difference is consequential for this business, whether each necessary participant has a plausible reason to participate, and where the stated analogy breaks. A renamed template, concierge service, feedback workflow or feature suggestion is not automatically a bold mechanism. Do not invent worldwide novelty or evidence of demand.

Use material_difference for an explained consequential departure, familiar_mechanism for an ordinary mechanism, and unclear_difference for an unexplained departure. Novelty is separate from evidence strength, business fit, feasibility, risk and upside. A speculative or unbuilt idea without a precedent can have a material difference. Do not reject an idea for missing integrations, customer access, available time, direct precedent or high confidence. Keep those as unknowns and propose a private test of the changed exchange. testOfDifference should isolate that difference from the closest ordinary alternative rather than confound it with better copy, advice or a different audience. Fictional simulations can reveal comprehension or observed choices in that simulation; they cannot prove real demand, trust, willingness to pay or product activation.

This is advisory feedback for the writer, not a filter, ranking, score or approval. Retain an audit for every candidate, including unfamiliar or uncertain ones. Identify a precise weak link and what needs rethinking; do not replace the portfolio with conventional recommendations. The writer may improve or replace any candidate and is not required to agree with this judgment. The final plan receives a separate independent review.

After those independent comparisons, develop one additional direction in developedDirection. This is a proposed response to a substantive weakness, not a winning recommendation or a claim that your new idea passed review. Use the existing direction structure: business tension, operating mechanism, participant incentives, closest familiar alternative, consequential difference, unknowns and a private test. If a candidate already changes the mechanism, preserve that difference while repairing its weakest incentive or comparison. If the candidates are ordinary, construct a different exchange from their underlying business tension instead of changing labels, adding an approval log or suggesting an advertised feature. Consider a participant who bears a cost without controlling the purchase, and what different allocation of control, work, risk or value would make participation worthwhile. Describe the actual operation and the cost of breaking the convention. Do not select for lowest risk, strongest evidence or existing implementation; an unbuilt speculative direction may be the most useful development. Keep all input candidates and their audits intact. The additional direction is explicitly hypothetical, its refs support factual premises only, and no customer behavior, current capability or commercial outcome is established by proposing it. The writer must reassess it rather than treat your development as an endorsed bold idea.`;

export const CREATIVE_PREPARATION_TASK = `Prepare strategic possibilities for the focused plan, not the plan itself. This is a private ideation step in the same run. The later writer will create the complete grounded, adjacent and bold portfolio, choose one practical move, and prepare its work. Do not write campaign copy, a timeline, a task checklist or forecasts here.

Develop three or four substantially different directions before settling on the first plausible customer or familiar channel. Start from this business's assets and tensions in the supplied context. A useful direction changes a value exchange, participant behavior, buying situation, product promise or source of distribution; naming a platform is not a mechanism. At least one direction must depart from the obvious current use case. Consider an overlooked participant, a reversed category assumption, a distant-industry transfer, or a memorable behavior or brand position this business could own. Do not force every direction to serve the same customer or repeat the same acquisition tactic.

Use a different creativeMethod for each direction, including both convention_inversion and distant_transfer. Explain the actual operation in methodApplication:
- convention_inversion: state an assumed default as a hypothesis, then reverse a consequential rule: who sets the terms, chooses, owns the output, supplies the work, carries risk or receives value first. Explain who gains or loses and why the reversed arrangement could attract participation. Merely charging for a free step or selling an existing feature to a different job title is not enough.
- distant_transfer: name a mechanism from a genuinely different industry or cultural context, transfer its causal logic to this business, and explain where the analogy could break. Calling a software service a tailor, library or concierge is only a metaphor until the source domain's operating rule or incentive changes what participants do or exchange. A familiar integration or another software upsell is not a distant transfer. You may reason by analogy without a case study; do not fabricate a company's actions or results.
- asset_recombination: combine two unusual business assets, constraints or participant behaviors to create a value exchange neither creates alone.
- ownable_behavior: propose a distinctive ritual, character, promise or recurring format that gives people a specific reason to remember and involve this business.
The method field is a coverage check, not a creativity score. A list of current product features with new labels fails this task. At least one direction should change what the business could become known for or how value is exchanged, beyond improving adoption of a feature it already advertises. Its smallest test may be entirely manual or a private mock-up; current integration support does not limit the idea.

For at least one direction, treat the current product as a resource rather than the finished offer: start with a different exchange or allocation of control, then consider what the existing assets could contribute. Look at an affected participant who does not currently choose or pay for the product, as well as the buyer; their interests may conflict. Explain their specific reason to participate without inventing observed demand. An unpublished simulation can test the exchange even if the required feature does not exist. Lack of that feature is an implementation unknown, not a reason to replace the idea with an existing feature. Keep the practical first move separate from this exploration.

For each, explain why each necessary participant would care, compare the closest familiar alternative, and state the consequential difference. If it is merely a template, concierge demo, referral link, reseller arrangement or billing handoff with new wording, develop a different direction. A product variation can be useful but is not automatically a bold strategy. Do not invent universal category conventions or claim worldwide novelty. Transfer a retrieved precedent only when its mechanism fits; no matching precedent is required.

Ideas may propose unbuilt capabilities, new business models or unusual partnerships. Mark these as proposals and their customer consequences as hypotheses. Unknown feasibility, price, cost, demand, capacity and permissions stay unknown; they do not prevent ideation. Design a small private simulation or reversible test of what makes the mechanism different, before building or making promises. Use only the supplied fact references or exact source URLs for factual premises, and leave refs empty for unsupported hypotheses. Never treat another case's results as evidence for this business. Nothing here authorizes external action.

Return only concise candidate directions in the supplied schema. These are inspectable proposals, not a reasoning transcript, scored ranking or business facts.`;
