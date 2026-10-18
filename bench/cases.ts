/**
 * Benchmark cases: real public businesses across the types ClimbOS serves.
 * Facts are extracted from each public website once (cached in bench/cache)
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

export const CASES: BenchCase[] = [
  { id: "plausible", name: "Plausible Analytics", website: "https://plausible.io", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 500, currency: "USD" },
  { id: "buttondown", name: "Buttondown", website: "https://buttondown.com", type: "creator_saas", goal: "Get more writers on a paid plan in the next 90 days", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "fishwife", name: "Fishwife", website: "https://eatfishwife.com", type: "ecommerce", goal: "Grow repeat online orders over the next 90 days", horizonDays: 90, monthlyAdBudget: 2000, currency: "USD" },
  { id: "animalz", name: "Animalz", website: "https://www.animalz.co", type: "agency", goal: "Book more qualified discovery calls with B2B SaaS companies this quarter", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "tartine", name: "Tartine Bakery", website: "https://tartinebakery.com", type: "local_food", goal: "Get more pre-orders for holiday pastries and catering", horizonDays: 60, monthlyAdBudget: 300, currency: "USD" },
  { id: "formkit", name: "Formkit", website: "https://formkit.app", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 600, currency: "USD" },
  { id: "finch", name: "Finch", website: "https://finchcare.com", type: "b2c_app", goal: "Grow paid Finch Plus subscribers in the next 90 days", horizonDays: 90, monthlyAdBudget: 1500, currency: "USD" },
  { id: "ugmonk", name: "Ugmonk", website: "https://ugmonk.com", type: "ecommerce", goal: "Increase sales of the Gather desk organizer before the holidays", horizonDays: 60, monthlyAdBudget: 1000, currency: "USD" },
  { id: "cfsbk", name: "CrossFit South Brooklyn", website: "https://www.cfsbk.com", type: "local_fitness", goal: "Get 20 new members to start the intro program this quarter", horizonDays: 90, monthlyAdBudget: 400, currency: "USD" },
  { id: "pilot", name: "Pilot", website: "https://pilot.com", type: "b2b_service", goal: "Book more consultations with venture-backed startups", horizonDays: 90, monthlyAdBudget: 3000, currency: "USD" },
  { id: "tinyhabits", name: "Tiny Habits (BJ Fogg)", website: "https://tinyhabits.com", type: "creator", goal: "Grow enrollment in the next Tiny Habits coaching program", horizonDays: 60, monthlyAdBudget: 0, currency: "USD" },
  { id: "bellbrothers", name: "Bell Brothers", website: "https://www.bellbrothers.com", type: "local_service", goal: "Book more furnace tune-ups and replacements before winter", horizonDays: 60, monthlyAdBudget: 1500, currency: "USD" },
];

export type BenchTask = "insights" | "strategy" | "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "ads" | "email" | "seo" | "audit" | "outbound";
export const TASKS_ALL: BenchTask[] = ["insights", "strategy", "linkedin", "instagram", "facebook", "x", "tiktok", "ads", "email", "seo", "audit"];
