/**
 * Benchmark case: Formkit (formkit.app) only.
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

/** Benchmarking uses one product only (owner decision, 2026-10-18). */
export const CASES: BenchCase[] = [
  { id: "formkit", name: "Formkit", website: "https://formkit.app", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 600, currency: "USD" },
];

export type BenchTask = "insights" | "strategy" | "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "ads" | "email" | "seo" | "audit" | "outbound";
export const TASKS_ALL: BenchTask[] = ["insights", "strategy", "linkedin", "instagram", "facebook", "x", "tiktok", "ads", "email", "seo", "audit"];
