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
  goalStatement?: string;
  monthlyAdBudget?: number;
  horizonDays?: number;
  reviewDay?: string;
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

  if (/paying customers|more customers|new customers|sign[- ]?ups|clients/i.test(t)) out.goalKind = "more_customers";
  else if (/sales|revenue|orders|sell more/i.test(t)) out.goalKind = "more_sales";
  else if (/reach|awareness|followers|audience|brand/i.test(t)) out.goalKind = "more_reach";

  const goalSentence = t.split(/(?<=[.!?])\s+/).find((s) => /(help|want|goal|grow|get|need)/i.test(s));
  if (goalSentence) out.goalStatement = goalSentence.trim().slice(0, 300);

  const day = DAYS.find((d) => new RegExp(`\\b${d}s?\\b`, "i").test(t));
  if (day) out.reviewDay = day.charAt(0).toUpperCase() + day.slice(1);
  return out;
}
