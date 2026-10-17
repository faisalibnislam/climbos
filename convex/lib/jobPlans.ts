import { CURRENT_ROUTING, currentRateVersion } from "../../shared/economics";
import type { PartialMeters } from "../../shared/economics/ledger";
import type { RoleKey } from "../../shared/economics/roles";
import { MODEL_SPECS } from "../../shared/ai/models";
import { TASKS, type TaskType } from "../../shared/ai/tasks";
import { estimateRun, type PlannedStep } from "../engine";

/**
 * The fixed step plan for each job kind: which roles take part (the CEO's
 * coordination is deterministic routing, not a round-robin of agents), what
 * each step may cost at most, and which usage meters it consumes.
 */

export type JobKind =
  | "onboarding_research"
  | "strategy"
  | "content_social"
  | "content_ads"
  | "content_email"
  | "content_seo"
  | "chat_intent"
  | "explain_results"
  | "conversion_audit"
  | "retention_plan"
  | "sales_sequence";

export interface JobPlan {
  kind: JobKind;
  title: string;
  roles: RoleKey[];
  tasks: TaskType[];
  steps: PlannedStep[];
  meters: PartialMeters;
}

function modelStep(task: TaskType, webSearches = 0): PlannedStep {
  const contract = TASKS[task];
  const modelKey = CURRENT_ROUTING.routes[contract.role].primary;
  const searches = MODEL_SPECS[modelKey].provider === "anthropic" ? webSearches : 0;
  return {
    kind: "model",
    role: contract.role,
    modelKey,
    inputBudget: contract.inputBudget,
    outputBudget: contract.outputBudget,
    webSearches: searches || undefined,
  };
}

export function planJob(kind: JobKind, params: { quantity?: number; images?: number; pages?: number } = {}): JobPlan {
  switch (kind) {
    case "onboarding_research": {
      const pages = Math.min(params.pages ?? 3, 3);
      return {
        kind,
        title: "Understand your business",
        roles: ["data_analyst", "cmo"],
        tasks: ["business_profile", "business_insights"],
        steps: [{ kind: "research", scrapeCredits: pages }, modelStep("business_profile"), modelStep("business_insights", 2)],
        meters: { scrapeCredits: pages, searchCalls: 2 },
      };
    }
    case "strategy":
      return {
        kind,
        title: "Build your growth plan",
        roles: ["ceo", "cmo"],
        tasks: ["growth_strategy"],
        steps: [modelStep("growth_strategy")],
        meters: {},
      };
    case "content_social": {
      const qty = Math.max(1, Math.min(params.quantity ?? 3, 6));
      const images = Math.max(0, Math.min(params.images ?? 0, qty, 2));
      return {
        kind,
        title: `Draft ${qty} social post${qty === 1 ? "" : "s"}`,
        roles: images ? ["social_media_manager", "creative_director"] : ["social_media_manager"],
        tasks: ["social_posts"],
        steps: [
          modelStep("social_posts"),
          ...Array.from({ length: images }, (): PlannedStep => ({ kind: "image", role: "creative_director", imageAttempts: 2 })),
        ],
        meters: { socialPosts: qty, imageAttempts: images * 2, deliveredImages: images },
      };
    }
    case "content_ads":
      return { kind, title: "Draft ads (paused until approved)", roles: ["ads_manager", "creative_director"], tasks: ["ad_drafts"], steps: [modelStep("ad_drafts")], meters: {} };
    case "content_email":
      return { kind, title: "Draft an email sequence", roles: ["customer_success_manager"], tasks: ["email_sequence"], steps: [modelStep("email_sequence")], meters: {} };
    case "content_seo":
      return { kind, title: "Write an SEO page", roles: ["seo_specialist"], tasks: ["seo_brief"], steps: [modelStep("seo_brief", 2)], meters: { searchCalls: 2 } };
    case "chat_intent":
      return { kind, title: "Understand your request", roles: ["coo"], tasks: ["chat_intent"], steps: [modelStep("chat_intent")], meters: {} };
    case "explain_results":
      return { kind, title: "Explain your results", roles: ["data_analyst"], tasks: ["metric_explanation"], steps: [modelStep("metric_explanation")], meters: {} };
    case "conversion_audit":
      return {
        kind,
        title: "Audit your website for conversions",
        roles: ["cso", "cmo"],
        tasks: ["conversion_audit"],
        steps: [{ kind: "research", scrapeCredits: 2 }, modelStep("conversion_audit")],
        meters: { scrapeCredits: 2 },
      };
    case "retention_plan":
      return { kind, title: "Plan retention and loyalty", roles: ["customer_success_manager"], tasks: ["retention_plan"], steps: [modelStep("retention_plan")], meters: {} };
    case "sales_sequence":
      return { kind, title: "Plan sales follow-ups", roles: ["cso"], tasks: ["sales_sequence"], steps: [modelStep("sales_sequence")], meters: {} };
  }
}

/** Worst-case cost estimate shown on action cards before anything runs. */
export function estimateJobMicros(plan: JobPlan): number {
  return estimateRun(plan.steps, currentRateVersion().id).costMicros;
}
