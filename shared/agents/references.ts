/**
 * Versioned reference rules for the decision code (decision books, governed
 * knowledge: each rule records its source, review date, scope, class and what
 * happens when data is missing, so a cited number can be traced and changed
 * without silently rewriting old decisions). Saved diagnoses record the ids and
 * versions they used.
 *
 * Classes follow the book-research rule policy (docs/growth-expansion/book-research/RECONCILIATION.md):
 * a reference range is a contextual heuristic, never a hard rule, and never the
 * owner's evidence.
 */

export type RuleClass = "external_requirement" | "missing_prerequisite" | "economic_feasibility" | "strategic_preference" | "contextual_heuristic" | "unknown_to_investigate";

export interface ReferenceRule {
  id: string;
  version: number;
  /** Lowest rate the reference treats as normal (verdict "weak" only below it, with posterior evidence). */
  low: number;
  high?: number;
  text: string;
  source: string;
  reviewed: string;
  appliesTo: string;
  class: RuleClass;
  counterexamples: string;
  missingData: string;
  reviewTrigger: string;
}

const REVIEWED = "2026-10-20";

export const REFERENCES = {
  freeToPaid: {
    id: "REF-free-to-paid",
    version: 2,
    low: 0.02,
    high: 0.05,
    text: "2–5% free-plan user → paid (practitioner range, grade C)",
    source: "skills/growth-plays/reference/base-rates.md. The low end matches Lean Analytics (2013, Totango-era data: about 2%); the 5% upper end has no verified source.",
    reviewed: REVIEWED,
    appliesTo: "Self-serve SaaS with a free plan (signupKind free_plan).",
    class: "contextual_heuristic",
    counterexamples: "Products whose free plan is the main product (paid is a niche upsell) convert far lower without anything being wrong.",
    missingData: "Signup model unknown: no reference is applied (verdict unknown).",
    reviewTrigger: "A sourced benchmark for the business's segment, or the owner's own cohort history.",
  },
  trialNoCard: {
    id: "REF-trial-no-card",
    version: 2,
    low: 0.15,
    high: 0.25,
    text: "15–25% free trial (no card) → paid (practitioner range, grade C)",
    source: "skills/growth-plays/reference/base-rates.md. Lean Analytics (2013) gives about 15%, and 25% only with targeted selling; the 25% upper end is practitioner literature.",
    reviewed: REVIEWED,
    appliesTo: "Self-serve SaaS with a time-limited trial and no card at signup (signupKind trial_no_card).",
    class: "contextual_heuristic",
    counterexamples: "Freemium and card-required trials have very different denominators; applying this floor to them misreads normal rates as weak (book-research R19).",
    missingData: "Signup model unknown: no reference is applied.",
    reviewTrigger: "As above.",
  },
  trialCard: {
    id: "REF-trial-card",
    version: 1,
    low: 0.4,
    high: 0.6,
    text: "40–60% card-required trial → paid (practitioner range, grade C; far fewer trial starts)",
    source: "skills/growth-plays/reference/base-rates.md. Lean Analytics (2013) gives 40–50%.",
    reviewed: REVIEWED,
    appliesTo: "Self-serve SaaS that takes a card at trial start (signupKind trial_card).",
    class: "contextual_heuristic",
    counterexamples: "Annual-only plans and long trials shift the timing; the period must cover trial end.",
    missingData: "Signup model unknown: no reference is applied.",
    reviewTrigger: "As above.",
  },
  saasChurn: {
    id: "REF-smb-saas-churn",
    version: 1,
    low: 0.03,
    high: 0.07,
    text: "3–7% monthly churn for small-business SaaS (practitioner range, grade C)",
    source: "skills/growth-plays/reference/base-rates.md",
    reviewed: REVIEWED,
    appliesTo: "SaaS types only; other businesses get no churn verdict (no reliable benchmark).",
    class: "contextual_heuristic",
    counterexamples: "Annual contracts, seasonal products and very small customers (Sharp: some loss is normal at a given size).",
    missingData: "No churn given: retention isn't read.",
    reviewTrigger: "Billing cohorts with 3+ months (shared/attribution/cohorts.ts).",
  },
} satisfies Record<string, ReferenceRule>;

/**
 * Decision thresholds for posterior readings (ClimbOS policy, strategic preference, version 1).
 * A link is called weak only when the owner's counts make it at least 90% likely
 * that its true rate is below the reference; one link is preferred over another
 * only at 80% or more. Between those, the diagnosis says "ambiguous" or "unknown"
 * and names the measurement that would decide.
 */
export const DECISION_THRESHOLDS = {
  id: "DT-posterior-verdicts",
  version: 2,
  weakAt: 0.9,
  preferAt: 0.8,
  /** Two links within this relative gap aren't ranked, however large the counts. */
  materialGap: 0.1,
  rationale: "Kochenderfer et al. Ch 6 (choose by expected consequences) and Downey Ch 4 (small samples are wide): a point rate below a reference isn't evidence it is below. 90% and 80% are ClimbOS choices, not book values.",
  class: "strategic_preference" as RuleClass,
  reviewed: REVIEWED,
};

export type SignupKind = "free_plan" | "trial_no_card" | "trial_card" | "unknown";

/** The conversion reference for a SaaS signup model; null when the model is unknown. */
export function conversionReference(kind: SignupKind | undefined): ReferenceRule | null {
  if (kind === "free_plan") return REFERENCES.freeToPaid;
  if (kind === "trial_no_card") return REFERENCES.trialNoCard;
  if (kind === "trial_card") return REFERENCES.trialCard;
  return null;
}
