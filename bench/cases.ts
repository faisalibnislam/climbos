/**
 * Benchmark cases: the owner's connected products (approved 2026-10-18), plus a mixed set of other
 * business types. Facts are extracted from each public website once (cached in bench/cache)
 * so every engine gets identical inputs.
 */
export interface BenchCase {
  id: string;
  name: string;
  website: string;
  type: "b2b_saas" | "creator_saas" | "local_service" | "ecommerce" | "agency" | "local_food" | "b2c_app" | "creator" | "b2b_service" | "local_fitness";
  goal: string;
  horizonDays: number;
  monthlyAdBudget: number;
  currency: string;
}

/** The owner's own products only (owner decision, 2026-10-18). Budgets differ so plans must adapt. */
export const CASES: BenchCase[] = [
  { id: "formkit", name: "Formkit", website: "https://formkit.app", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 600, currency: "USD" },
  { id: "meetrao", name: "Meetrao", website: "https://meetrao.com", type: "b2b_saas", goal: "Reach 100 paying customers in 90 days", horizonDays: 90, monthlyAdBudget: 300, currency: "USD" },
  { id: "involets", name: "Involets", website: "https://involets.com", type: "b2b_saas", goal: "Get the first 50 paying freelancers and small agencies", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "taskeni", name: "Taskeni", website: "https://taskeni.app", type: "b2b_saas", goal: "Grow paying teams by 30% in 90 days", horizonDays: 90, monthlyAdBudget: 1000, currency: "USD" },
  { id: "folevi", name: "Folevi", website: "https://folevi.com", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 200, currency: "USD" },
];

/**
 * Other business types (Book 14 §13: a plan's quality must hold across types), from sites already in
 * bench/cache. Separate from CASES so the B0 comparison on the SaaS set stays valid.
 */
export const MIXED_CASES: BenchCase[] = [
  { id: "animalz", name: "Animalz", website: "https://www.animalz.co", type: "agency", goal: "Book 10 qualified discovery calls with B2B SaaS marketing leaders in 90 days", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "bellbrothers", name: "Bell Brothers", website: "https://bellbrothers.com", type: "local_service", goal: "Book 150 more furnace tune-ups and heating repairs in central Iowa before winter", horizonDays: 60, monthlyAdBudget: 1500, currency: "USD" },
  { id: "tartine", name: "Tartine Bakery", website: "https://tartinebakery.com", type: "local_food", goal: "Grow holiday cake pre-orders and Goldbelly shipping orders by 25% this season", horizonDays: 60, monthlyAdBudget: 400, currency: "USD" },
  { id: "cfsbk", name: "CrossFit South Brooklyn", website: "https://crossfitsouthbrooklyn.com", type: "local_fitness", goal: "Get 20 new paying members in 60 days", horizonDays: 60, monthlyAdBudget: 60, currency: "USD" },
  { id: "finch", name: "Finch", website: "https://finchcare.com", type: "b2c_app", goal: "Get 3,000 new Finch Plus subscribers in 90 days", horizonDays: 90, monthlyAdBudget: 1000, currency: "USD" },
  { id: "tinyhabits", name: "Tiny Habits", website: "https://tinyhabits.com", type: "creator", goal: "Add 10,000 people to the free 5-day Tiny Habits program in 90 days", horizonDays: 90, monthlyAdBudget: 150, currency: "USD" },
];

/** Named case sets for `--cases`: saas (the B0 set, default), mixed (other business types), all. */
export const CASE_SETS = { saas: CASES, mixed: MIXED_CASES, all: [...CASES, ...MIXED_CASES] } as const;

/**
 * `--cases` value → cases, in order, without duplicates. Accepts set names and case ids mixed
 * ("saas", "mixed,formkit", "finch,cfsbk"). An unknown name throws, so a typo never runs a paid bench on the wrong set.
 */
export function selectCases(spec: string | undefined): BenchCase[] {
  if (!spec?.trim()) return CASES;
  const byId = new Map(CASE_SETS.all.map((c) => [c.id, c]));
  const out = new Map<string, BenchCase>();
  for (const token of spec.split(",").map((t) => t.trim()).filter(Boolean)) {
    const set = (CASE_SETS as Record<string, readonly BenchCase[]>)[token];
    const found = set ?? (byId.has(token) ? [byId.get(token)!] : null);
    if (!found) throw new Error(`Unknown case or set "${token}". Sets: ${Object.keys(CASE_SETS).join(", ")}. Cases: ${[...byId.keys()].join(", ")}.`);
    for (const c of found) out.set(c.id, c);
  }
  return [...out.values()];
}

export type BenchTask = "insights" | "strategy" | "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "ads" | "email" | "seo" | "audit" | "outbound";
export const TASKS_ALL: BenchTask[] = ["insights", "strategy", "linkedin", "instagram", "facebook", "x", "tiktok", "ads", "email", "seo", "audit"];
