/**
 * How strong a fact is as evidence of demand (expansion slice 6; BK05 Ch 2
 * compliments and hypotheticals are not data; BK04 say < do < commit; BK02
 * stated vs demonstrated willingness to pay). Classified in code from the
 * fact's wording and where it came from, never by the model.
 *
 * - published: the business's own site or material says it (a claim, not a measurement)
 * - stated:    someone said they like, want or would pay (opinion, compliment, hypothetical)
 * - behavior:  something people actually did (signed up, used, asked, complained, churned)
 * - commitment: time, reputation or money given (paid, deposit, pre-order, signed, intro)
 * - measured:  a count or rate from a system (analytics, billing, CRM)
 * - owner:     the owner's own report with no stronger marker
 */
export type EvidenceKind = "published" | "stated" | "behavior" | "commitment" | "measured" | "owner";

const COMMITMENT = /\b(paid|pays|paying customers?|purchased|bought|deposit|pre-?ordered|pre-?sold|signed (?:a |the )?(?:contract|letter|loi)|letter of intent|invoice[sd]?|subscribed for|renewed)\b/i;
const MEASURED = /\b(analytics|stripe|billing|crm|search console|dashboard|cohort|conversion rate|retention|churn(?:ed)? rate|\d+(?:\.\d+)?\s?% (?:of|convert|churn|retain|open|click))\b/i;
const BEHAVIOR = /\b(signed up|sign-?ups?|booked|used|uses|logged in|completed|cancel(?:l)?ed|churned|returned|asked for|requested|complained|referred|downloaded|installed)\b/i;
const STATED = /\b(said|says|say they|told us|would (?:pay|buy|use|love)|will (?:pay|buy)|interested|love(?:d|s)? (?:it|the idea)|sounds (?:great|interesting|good)|great idea|survey|wishlist|feedback says|everyone (?:says|loves))\b/i;

export function evidenceKind(statement: string, provenance?: string): EvidenceKind {
  if (provenance === "researched") return "published";
  if (COMMITMENT.test(statement)) return "commitment";
  if (MEASURED.test(statement)) return "measured";
  if (STATED.test(statement)) return "stated";
  if (BEHAVIOR.test(statement)) return "behavior";
  return "owner";
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  published: "site says",
  stated: "stated opinion",
  behavior: "observed behaviour",
  commitment: "commitment",
  measured: "measured",
  owner: "owner report",
};

/** Proof-of-demand language: "validated demand", "customers love it", "proven need". */
const DEMAND_CLAIM = /\b(?:validated|proven|confirmed|clear|strong)\s+(?:demand|need|willingness to pay|product[- ]market fit)\b|\b(?:customers?|users?|people|everyone)\s+(?:love|want|are asking for|are begging for)\b|\bmarket wants\b|\bdemand is (?:there|proven|clear)\b/i;

/**
 * A plan may not call demand proven when no fact is a behaviour, commitment or
 * measurement: stated interest is a signal to test.
 */
export function lintEvidenceStrength(fields: { path: string; text: string }[], kinds: EvidenceKind[]) {
  if (kinds.some((k) => k === "behavior" || k === "commitment" || k === "measured")) return [];
  return fields
    .filter((f) => DEMAND_CLAIM.test(f.text))
    .slice(0, 3)
    .map((f) => ({ severity: "error" as const, rule: "evidence_strength", message: `"${f.text.match(DEMAND_CLAIM)![0]}" treats opinions as proof. No fact shows behaviour, a commitment or a measurement yet: call it a signal and test it (a real offer, a pre-sale, a pilot).`, path: f.path }));
}
