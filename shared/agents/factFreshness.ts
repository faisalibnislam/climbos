import type { Doc } from "../../convex/_generated/dataModel";

const REVIEW_AFTER_DAYS: Record<Doc<"businessFacts">["category"], number> = {
  pricing: 60,
  offer: 60,
  competitor: 45,
  proof: 120,
  product: 180,
  audience: 180,
  brand: 365,
  other: 180,
};

/** Age is only a prompt to review; it is not proof that a business fact is wrong. */
export function factFreshness(category: Doc<"businessFacts">["category"], updatedAt: number, now = Date.now()): { daysOld: number; reviewSuggested: boolean } {
  const daysOld = Math.max(0, Math.floor((now - updatedAt) / 86_400_000));
  return { daysOld, reviewSuggested: daysOld >= REVIEW_AFTER_DAYS[category] };
}
