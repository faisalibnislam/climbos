export type SearchIntentStage = "awareness" | "evaluation" | "purchase" | "unclear";

const PURCHASE = /\b(?:buy|purchase|pricing|how much does|cost(?:s)?\s+of|quote|book|hire|order|sign\s?up|start\s+(?:a\s+)?trial|free trial|demo|near me|discount)\b/i;
const EVALUATION = /\b(?:best|compare|comparison|versus|vs\.?|alternative|review|reviews|features?|options?)\b/i;
const AWARENESS = /\b(?:what is|how to|how do|why does|guide|tutorial|examples?|definition|learn about|ideas?)\b/i;

/** Classify only explicit intent evidence; page type is a conservative fallback. */
export function inferSearchIntentStage(searchIntent: string, pageType: string): SearchIntentStage {
  if (PURCHASE.test(searchIntent)) return "purchase";
  if (EVALUATION.test(searchIntent)) return "evaluation";
  if (AWARENESS.test(searchIntent)) return "awareness";
  if (["pricing", "service_location"].includes(pageType)) return "purchase";
  if (["comparison", "alternatives"].includes(pageType)) return "evaluation";
  if (pageType === "how_to") return "awareness";
  return "unclear";
}
