/**
 * Benchmark cases: the owner's own Airly apps (approved 2026-10-18).
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

/** The owner's own products only (owner decision, 2026-10-18). Budgets differ so plans must adapt. */
export const CASES: BenchCase[] = [
  { id: "formkit", name: "Formkit", website: "https://formkit.app", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 600, currency: "USD" },
  { id: "meetrao", name: "Meetrao", website: "https://meetrao.com", type: "b2b_saas", goal: "Reach 100 paying customers in 90 days", horizonDays: 90, monthlyAdBudget: 300, currency: "USD" },
  { id: "involets", name: "Involets", website: "https://involets.com", type: "b2b_saas", goal: "Get the first 50 paying freelancers and small agencies", horizonDays: 90, monthlyAdBudget: 0, currency: "USD" },
  { id: "taskeni", name: "Taskeni", website: "https://taskeni.app", type: "b2b_saas", goal: "Grow paying teams by 30% in 90 days", horizonDays: 90, monthlyAdBudget: 1000, currency: "USD" },
  { id: "folevi", name: "Folevi", website: "https://folevi.com", type: "b2b_saas", goal: "Get more paying customers in the next 90 days", horizonDays: 90, monthlyAdBudget: 200, currency: "USD" },
];

export type BenchTask = "insights" | "strategy" | "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "ads" | "email" | "seo" | "audit" | "outbound";
export const TASKS_ALL: BenchTask[] = ["insights", "strategy", "linkedin", "instagram", "facebook", "x", "tiktok", "ads", "email", "seo", "audit"];
