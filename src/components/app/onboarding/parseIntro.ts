/**
 * Deterministic parser for the onboarding chat box. It fills the same fields
 * the checklist uses (no AI call, no cost). Anything it can't parse stays
 * editable in the checklist; the full text is also passed to research as an
 * owner-supplied description.
 */
export interface ParsedIntro {
  businessName?: string;
  website?: string;
  goalKind?: "more_sales" | "more_customers" | "more_reach" | "custom";
  /** Every goal type the text mentions, in the order they are checked (all equal priority). */
  goalKinds?: ("more_sales" | "more_customers" | "more_reach")[];
  goalStatement?: string;
  monthlyAdBudget?: number;
  horizonDays?: number;
  reviewDay?: string;
  /** Where the business is today, when the owner says so ("just launched", "no customers yet", "pre-launch"). */
  businessStage?: "idea" | "launching_soon" | "just_launched" | "has_customers";
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function parseIntro(text: string): ParsedIntro {
  const out: ParsedIntro = {};
  const t = text.trim();
  if (!t) return out;

  // A domain or URL that isn't part of an email address.
  const url = t.match(/(?<![@\w.-])((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,]*)?)/i);
  if (url) out.website = url[1].replace(/[.,;:!?)]+$/, "");

  const name =
    t.match(/\b(?:[Ww]e(?:'|’| a)re|[Ii] run|[Ii] own|[Mm]y business is|[Mm]y company is|[Oo]ur company is|[Tt]his is)\s+(?:(?:called|named)\s+)?([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})/) ??
    t.match(/^([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,2})\s*(?:\(|-|—|,)/);
  if (name) out.businessName = name[1].trim();
  else if (out.website) {
    const host = out.website.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    const base = host.split(".")[0];
    out.businessName = base.charAt(0).toUpperCase() + base.slice(1);
  }

  const budget = t.match(/(?:\$|usd\s?|£|€)\s?([\d,]+(?:\.\d+)?)\s*(k)?(?:\s*(?:a|per|\/)\s*month|\s*monthly|\s*\/mo)?/i);
  if (budget && /(ad|ads|advertis|spend|budget|month)/i.test(t)) {
    const n = Number(budget[1].replace(/,/g, "")) * (budget[2] ? 1000 : 1);
    if (Number.isFinite(n) && n >= 0 && n < 1_000_000) out.monthlyAdBudget = n;
  }
  if (/\bno (?:ad|ads|budget)|don'?t want (?:to )?(?:run )?ads/i.test(t)) out.monthlyAdBudget = 0;

  const horizon = t.match(/(\d{1,3})\s*(day|days|week|weeks|month|months)/i);
  if (horizon) {
    const n = Number(horizon[1]);
    const unit = horizon[2].toLowerCase();
    const days = unit.startsWith("day") ? n : unit.startsWith("week") ? n * 7 : n * 30;
    if (days >= 14 && days <= 365) out.horizonDays = days;
  }

  const kinds: NonNullable<ParsedIntro["goalKinds"]> = [];
  if (/paying customers|more customers|new customers|sign[- ]?ups|clients/i.test(t)) kinds.push("more_customers");
  if (/sales|revenue|orders|sell more/i.test(t)) kinds.push("more_sales");
  if (/reach|awareness|followers|audience|brand/i.test(t)) kinds.push("more_reach");
  if (kinds.length) {
    out.goalKind = kinds[0];
    out.goalKinds = kinds;
  }

  const goalSentence = t.split(/(?<=[.!?])\s+/).find((s) => /(help|want|goal|grow|get|need)/i.test(s));
  if (goalSentence) out.goalStatement = goalSentence.trim().slice(0, 300);

  if (/\b(?:just (?:an )?idea|idea stage|still an idea|validating (?:an|my|the|this) idea)\b/i.test(t)) out.businessStage = "idea";
  else if (/\b(?:pre-?launch|launching (?:soon|next)|not (?:yet )?launched|haven'?t launched|about to launch|coming soon)\b/i.test(t)) out.businessStage = "launching_soon";
  else if (/\b(?:just (?:launched|started|opened|went live)|newly launched|recently launched|no (?:customers|users|clients|sales|buyers) yet|(?:don'?t|do not) have any (?:customers|users|clients)|zero (?:customers|users|clients))\b/i.test(t)) out.businessStage = "just_launched";
  else if (/\b(?:\d[\d,]*\+?\s+(?:paying )?(?:customers|clients|users|subscribers)|our (?:existing |current )?customers|existing customers)\b/i.test(t)) out.businessStage = "has_customers";

  const day = DAYS.find((d) => new RegExp(`\\b${d}s?\\b`, "i").test(t));
  if (day) out.reviewDay = day.charAt(0).toUpperCase() + day.slice(1);
  return out;
}
