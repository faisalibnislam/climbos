import { z } from "zod";

/** A bounded preparation step in the same strategy run, never facts or action authority. */
export const CREATIVE_PREPARATION_TOKENS = 12_000;
export const CreativePreparationSchema = z.object({
  directions: z.array(z.object({
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
  })).min(3).max(4),
});

export const CREATIVE_PREPARATION_TASK = `Prepare strategic possibilities for the focused plan, not the plan itself. This is a private ideation step in the same run. The later writer will create the complete grounded, adjacent and bold portfolio, choose one practical move, and prepare its work. Do not write campaign copy, a timeline, a task checklist or forecasts here.

Develop three or four substantially different directions before settling on the first plausible customer or familiar channel. Start from this business's assets and tensions in the supplied context. A useful direction changes a value exchange, participant behavior, buying situation, product promise or source of distribution; naming a platform is not a mechanism. At least one direction must depart from the obvious current use case. Consider an overlooked participant, a reversed category assumption, a distant-industry transfer, or a memorable behavior or brand position this business could own. Do not force every direction to serve the same customer or repeat the same acquisition tactic.

For each, explain why each necessary participant would care, compare the closest familiar alternative, and state the consequential difference. If it is merely a template, concierge demo, referral link, reseller arrangement or billing handoff with new wording, develop a different direction. A product variation can be useful but is not automatically a bold strategy. Do not invent universal category conventions or claim worldwide novelty. Transfer a retrieved precedent only when its mechanism fits; no matching precedent is required.

Ideas may propose unbuilt capabilities, new business models or unusual partnerships. Mark these as proposals and their customer consequences as hypotheses. Unknown feasibility, price, cost, demand, capacity and permissions stay unknown; they do not prevent ideation. Design a small private simulation or reversible test of what makes the mechanism different, before building or making promises. Use only the supplied fact references or exact source URLs for factual premises, and leave refs empty for unsupported hypotheses. Never treat another case's results as evidence for this business. Nothing here authorizes external action.

Return only concise candidate directions in the supplied schema. These are inspectable proposals, not a reasoning transcript, scored ranking or business facts.`;
