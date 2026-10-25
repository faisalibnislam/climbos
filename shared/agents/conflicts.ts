/**
 * Conflicting facts (Book 14 §5): when current business evidence disagrees,
 * keep both and say so, rather than letting a writer pick whichever reads better.
 *
 * Deterministic and narrow on purpose: prices per plan tier (same currency,
 * billing period, and billing unit), free-trial length, and explicit feature
 * availability. A monthly and a yearly price for the same tier is not a conflict.
 */

export interface FactConflict {
  /** What disagrees, e.g. "Pro price per seat per month". */
  subject: string;
  /** The differing normalized values, with any explicit billing unit preserved. */
  values: string[];
  factIds: string[];
}

const TIERS = ["free", "starter", "basic", "personal", "hobby", "solo", "plus", "pro", "premium", "growth", "team", "teams", "business", "agency", "scale", "enterprise", "lifetime"];
const TIER_RE = new RegExp(`\\b(${TIERS.join("|")})\\b`, "i");
const RATE_UNIT = "user|seat|member|account";
const PRICE_RE = new RegExp(`([$£€₹৳¥]|\\b(?:USD|EUR|GBP|INR|BDT|CAD|AUD)\\s?)(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:\\/|per|a|an|each)\\s*(?:(${RATE_UNIT})s?\\s*(?:\\/|per)\\s*)?(month|mo|year|yr|annum)\\b(?:\\s*(?:\\/|per)\\s*(${RATE_UNIT})s?\\b)?`, "gi");
const TRIAL_RE = /\b(\d{1,3})[-\s]?day\s+(?:free\s+)?trial\b/i;
const CAPABILITY_YES = /^(.{2,100}?)\s+(includes?|supports?|offers?|provides?|has|comes with|features?)\s+(.{2,100}?)[.!?]*$/i;
const CAPABILITY_NO = /^(.{2,100}?)\s+(?:does not|doesn't)\s+(include|support|offer|provide|have|feature)\s+(.{2,100}?)[.!?]*$/i;
const CAPABILITY_LACKS = /^(.{2,100}?)\s+lacks\s+(.{2,100}?)[.!?]*$/i;
const CAPABILITY_HAS_NO = /^(.{2,100}?)\s+(?:has|have)\s+no\s+(.{2,100}?)[.!?]*$/i;
const CAPABILITY_PASSIVE = /^(.{2,100}?)\s+is\s+(not\s+)?(included|supported|offered|provided|available)\s+(?:in|on|with|for)\s+(.{2,100}?)[.!?]*$/i;
const CAPABILITY_IS_FEATURE_OF = /^(.{2,100}?)\s+is\s+(not\s+)?(?:a\s+)?feature\s+of\s+(.{2,100}?)[.!?]*$/i;

const sym = (s: string) => s.trim().toUpperCase().replace("USD", "$").replace("EUR", "€").replace("GBP", "£");

export function findConflicts(facts: { id: string; statement: string; category?: string }[]): FactConflict[] {
  const seen = new Map<string, { value: number; shown: string; factId: string }[]>();
  const capabilities = new Map<string, { value: boolean; shown: string; factId: string }[]>();
  const add = (key: string, value: number, shown: string, factId: string) => {
    const list = seen.get(key) ?? [];
    list.push({ value, shown, factId });
    seen.set(key, list);
  };
  for (const f of facts) {
    if (f.category && !["pricing", "offer", "product"].includes(f.category)) continue;
    const tier = TIER_RE.exec(f.statement)?.[1]?.toLowerCase().replace(/^teams$/, "team");
    // Many small businesses publish a single offer without naming a tier ("Our
    // service is $120/month"). Treat that as one default offer so contradictory
    // current prices still block a plan. Keep named tiers separate as before.
    for (const m of f.statement.matchAll(PRICE_RE)) {
      const yearly = /^(year|yr|annum)$/i.test(m[4]);
      const unit = (m[5] ?? m[3])?.toLowerCase().replace(/s$/, "");
      const n = Number(m[2].replace(/,/g, ""));
      if (n > 0) {
        const subject = `${tier ? `${tier[0].toUpperCase()}${tier.slice(1)} ` : "Unspecified offer "}price${unit ? ` per ${unit}` : ""} per ${yearly ? "year" : "month"} (${sym(m[1])})`;
        add(subject, n, `${sym(m[1])}${m[2]}${unit ? `/${unit}` : ""}`, f.id);
      }
    }
    const t = TRIAL_RE.exec(f.statement);
    if (t) add("Free trial length (days)", Number(t[1]), `${t[1]} days`, f.id);
    const passive = CAPABILITY_PASSIVE.exec(f.statement);
    const negative = CAPABILITY_NO.exec(f.statement);
    const lacks = CAPABILITY_LACKS.exec(f.statement);
    const hasNo = CAPABILITY_HAS_NO.exec(f.statement);
    const featureOf = CAPABILITY_IS_FEATURE_OF.exec(f.statement);
    const positive = negative || lacks || hasNo || passive || featureOf ? null : CAPABILITY_YES.exec(f.statement);
    const capability = positive ?? negative ?? lacks ?? hasNo ?? passive ?? featureOf;
    if (capability) {
      const passiveForm = capability === passive;
      const reverseFeatureForm = capability === featureOf;
      const unavailableForm = capability === negative || capability === lacks || capability === hasNo || (passiveForm && Boolean(capability[2])) || (reverseFeatureForm && Boolean(capability[2]));
      const subjectRaw = passiveForm ? capability[4] : reverseFeatureForm ? capability[3] : capability[1];
      const featureRaw = passiveForm ? capability[1] : reverseFeatureForm ? capability[1] : lacks || hasNo ? capability[2] : capability[3];
      const subject = subjectRaw.trim().toLocaleLowerCase("en-US").replace(/^(?:the|a|an)\s+/u, "").replace(/\s+(?:plan|tier)$/u, "").replace(/\s+/gu, " ");
      const isAvailable = !unavailableForm;
      const shownFeature = featureRaw.trim().replace(/[.!?]+$/u, "").replace(/\s+/gu, " ");
      const feature = shownFeature.toLocaleLowerCase("en-US");
      const key = `${subject}\u0000${feature}`;
      const list = capabilities.get(key) ?? [];
      list.push({ value: isAvailable, shown: `${isAvailable ? "Available" : "Not available"}: ${shownFeature}`, factId: f.id });
      capabilities.set(key, list);
    }
  }
  const out: FactConflict[] = [];
  for (const [subject, list] of seen) {
    const values = [...new Set(list.map((x) => x.value))];
    // A stated price is exact: even a small difference can make a public offer or
    // customer-facing draft stale, though it may have little effect on forecast math.
    if (values.length > 1 && new Set(list.map((x) => x.factId)).size > 1)
      out.push({ subject: subject.replace(/ \(\$\)$/, ""), values: [...new Set(list.map((x) => x.shown))], factIds: [...new Set(list.map((x) => x.factId))] });
  }
  for (const [key, list] of capabilities) {
    if (new Set(list.map((x) => x.value)).size > 1 && new Set(list.map((x) => x.factId)).size > 1) {
      const [subject, feature] = key.split("\u0000");
      out.push({ subject: `Feature availability · ${subject} / ${feature}`, values: [...new Set(list.map((x) => x.shown))], factIds: [...new Set(list.map((x) => x.factId))] });
    }
  }
  return out.slice(0, 6);
}

/** One owner-facing line per conflict: "Pro price per month: $19 vs $24". */
export function conflictLines(cs: FactConflict[]): string[] {
  return cs.map((c) => `${c.subject}: ${c.values.join(" vs ")}`);
}
