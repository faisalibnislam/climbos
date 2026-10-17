/**
 * Benchmark cases: real public businesses across the types ClimbOS serves.
 * Facts are extracted from each public website once (cached in bench/cache)
 * so both engines get identical inputs.
 */
export interface BenchCase {
  id: string;
  name: string;
  website: string;
  type: "b2b_saas" | "creator_saas" | "local_service" | "ecommerce" | "agency" | "local_food";
  goal: string;
  horizonDays: number;
  monthlyAdBudget: number;
  currency: string;
  notes?: string;
}

export const CASES: BenchCase[] = [
  { id: "plausible", name: "Plausible Analytics", website: "https://plausible.io", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 500, currency: "USD" },
  { id: "buttondown", name: "Buttondown", website: "https://buttondown.com", type: "creator_saas", goal: "Get more writers on a paid plan in the next 90 days", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "fishwife", name: "Fishwife", website: "https://eatfishwife.com", type: "ecommerce", goal: "Grow repeat online orders over the next 90 days", horizonDays: 90, monthlyAdBudget: 2000, currency: "USD" },
  { id: "animalz", name: "Animalz", website: "https://www.animalz.co", type: "agency", goal: "Book more qualified discovery calls with B2B SaaS companies this quarter", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "tartine", name: "Tartine Bakery", website: "https://tartinebakery.com", type: "local_food", goal: "Get more pre-orders for holiday pastries and catering", horizonDays: 60, monthlyAdBudget: 300, currency: "USD" },
  { id: "formkit", name: "Formkit", website: "https://formkit.app", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 600, currency: "USD" },
];

export type BenchTask = "insights" | "strategy" | "linkedin" | "instagram" | "ads" | "email";
export const TASKS_ALL: BenchTask[] = ["insights", "strategy", "linkedin", "instagram", "ads", "email"];
