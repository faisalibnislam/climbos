/**
 * Conflicting facts (Book 14 §5): when two confirmed facts disagree, keep both
 * and say so, rather than letting a writer pick whichever reads better.
 *
 * Deterministic and narrow on purpose: prices per plan tier (same currency and
 * billing period) and free-trial length. A monthly and a yearly price for the
 * same tier is an annual discount, not a conflict.
 */

export interface FactConflict {
  /** What disagrees, e.g. "Pro price per month". */
  subject: string;
  /** The differing values as stated ("$19", "$24"). */
  values: string[];
  factIds: string[];
}

const TIERS = ["free", "starter", "basic", "personal", "hobby", "solo", "plus", "pro", "premium", "growth", "team", "teams", "business", "agency", "scale", "enterprise", "lifetime"];
const TIER_RE = new RegExp(`\\b(${TIERS.join("|")})\\b`, "i");
const PRICE_RE = /([$£€₹৳¥]|\b(?:USD|EUR|GBP|INR|BDT|CAD|AUD)\s?)(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per|a|an)\s*(month|mo|year|yr|annum)\b/gi;
const TRIAL_RE = /\b(\d{1,3})[-\s]?day\s+(?:free\s+)?trial\b/i;

const sym = (s: string) => s.trim().toUpperCase().replace("USD", "$").replace("EUR", "€").replace("GBP", "£");

export function findConflicts(facts: { id: string; statement: string; category?: string }[]): FactConflict[] {
  const seen = new Map<string, { value: number; shown: string; factId: string }[]>();
  const add = (key: string, value: number, shown: string, factId: string) => {
    const list = seen.get(key) ?? [];
    list.push({ value, shown, factId });
    seen.set(key, list);
  };
  for (const f of facts) {
    if (f.category && !["pricing", "offer", "product"].includes(f.category)) continue;
    const tier = TIER_RE.exec(f.statement)?.[1]?.toLowerCase().replace(/^teams$/, "team");
    if (tier) {
      for (const m of f.statement.matchAll(PRICE_RE)) {
        const yearly = /^(year|yr|annum)$/i.test(m[3]);
        const n = Number(m[2].replace(/,/g, ""));
        if (n > 0) add(`${tier[0].toUpperCase()}${tier.slice(1)} price per ${yearly ? "year" : "month"} (${sym(m[1])})`, n, `${sym(m[1])}${m[2]}`, f.id);
      }
    }
    const t = TRIAL_RE.exec(f.statement);
    if (t) add("Free trial length (days)", Number(t[1]), `${t[1]} days`, f.id);
  }
  const out: FactConflict[] = [];
  for (const [subject, list] of seen) {
    const values = [...new Set(list.map((x) => x.value))];
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Different facts, values more than 1% apart.
    if (values.length > 1 && max > min * 1.01 && new Set(list.map((x) => x.factId)).size > 1)
      out.push({ subject: subject.replace(/ \(\$\)$/, ""), values: [...new Set(list.map((x) => x.shown))], factIds: [...new Set(list.map((x) => x.factId))] });
  }
  return out.slice(0, 6);
}

/** One owner-facing line per conflict: "Pro price per month: $19 vs $24". */
export function conflictLines(cs: FactConflict[]): string[] {
  return cs.map((c) => `${c.subject}: ${c.values.join(" vs ")}`);
}
