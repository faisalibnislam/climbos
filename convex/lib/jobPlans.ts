import { CURRENT_ROUTING, currentRateVersion } from "../../shared/economics";
import type { PartialMeters } from "../../shared/economics/ledger";
import type { RoleKey } from "../../shared/economics/roles";
import { MODEL_SPECS } from "../../shared/ai/models";
import { TASKS, type TaskType } from "../../shared/ai/tasks";
import { estimateRun, type PlannedStep } from "../engine";
import type { AgentSpec } from "../../shared/agents/types";
import {
  adsSpec,
  conversionAuditSpec,
  emailSpec,
  insightsSpec,
  researchFor,
  retentionSpec,
  salesSpec,
  seoSpec,
  socialCalendarSpec,
  socialSpec,
  strategySpec,
} from "../../shared/agents/specs";

/** Engine v2 (agent loop + skills) is switched on per deployment once the benchmark shows it wins. */
export function engineV2(): boolean {
  return process.env.CLIMBOS_ENGINE === "v2";
}

/**
 * Steps reserved up front for one agent: optional research, the first draft
 * and its review. Each further revision round is reserved just before it runs
 * (see agentRevisionStep), so a small allowance isn't blocked by worst cases
 * that rarely happen.
 */
export function agentSteps(spec: AgentSpec<unknown>, research?: { maxSearches: number }, rounds = 1): PlannedStep[] {
  const steps: PlannedStep[] = [];
  if (research) {
    steps.push({ kind: "model", role: spec.role, modelKey: spec.models.research, inputBudget: 80_000, outputBudget: spec.maxTokens.research, webSearches: research.maxSearches });
  }
  for (let r = 0; r < rounds; r++) {
    steps.push({ kind: "model", role: spec.role, modelKey: spec.models.draft, inputBudget: 40_000, outputBudget: spec.maxTokens.draft });
    steps.push({ kind: "model", role: spec.role, modelKey: spec.models.critic, inputBudget: 40_000, outputBudget: spec.maxTokens.critic });
  }
  return steps;
}

/** The two steps (revised draft + review) one extra revision round needs. */
export function agentRevisionSteps(spec: AgentSpec<unknown>): PlannedStep[] {
  return [
    { kind: "model", role: spec.role, modelKey: spec.models.draft, inputBudget: 40_000, outputBudget: spec.maxTokens.draft },
    { kind: "model", role: spec.role, modelKey: spec.models.critic, inputBudget: 40_000, outputBudget: spec.maxTokens.critic },
  ];
}

function v2Plan(kind: JobKind, params: { quantity?: number; images?: number; pages?: number; channel?: string }): JobPlan | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (s: AgentSpec<any>) => s as AgentSpec<unknown>;
  const plan = (title: string, roles: RoleKey[], tasks: TaskType[], steps: PlannedStep[], meters: PartialMeters): JobPlan => ({ kind, title, roles, tasks, steps, meters });
  const searches = (t: Parameters<typeof researchFor>[0]) => researchFor(t, { businessName: "", website: "" })?.maxSearches ?? 0;
  switch (kind) {
    case "onboarding_research": {
      const pages = Math.min(params.pages ?? 3, 3);
      const r = { maxSearches: searches("business_insights") };
      return plan("Understand your business", ["data_analyst", "cmo"], ["business_profile", "business_insights"], [{ kind: "research", scrapeCredits: pages }, modelStep("business_profile"), ...agentSteps(any(insightsSpec()), r)], {
        scrapeCredits: pages,
        searchCalls: r.maxSearches,
      });
    }
    case "strategy": {
      const r = { maxSearches: searches("growth_strategy") };
      return plan("Build your growth plan", ["ceo", "cmo"], ["growth_strategy"], agentSteps(any(strategySpec()), r), { searchCalls: r.maxSearches });
    }
    case "content_social": {
      const qty = Math.max(1, Math.min(params.quantity ?? 3, 6));
      const images = Math.max(0, Math.min(params.images ?? 0, qty, 2));
      return plan(
        `Draft ${qty} social post${qty === 1 ? "" : "s"}`,
        images ? ["social_media_manager", "creative_director"] : ["social_media_manager"],
        ["social_posts"],
        [...agentSteps(any(socialSpec([params.channel ?? "instagram"]))), ...Array.from({ length: images }, (): PlannedStep => ({ kind: "image", role: "creative_director", imageAttempts: 2 }))],
        { socialPosts: qty, imageAttempts: images * 2, deliveredImages: images },
      );
    }
    case "content_ads": {
      const r = { maxSearches: searches("ad_drafts") };
      return plan("Draft ads (paused until approved)", ["ads_manager", "creative_director"], ["ad_drafts"], agentSteps(any(adsSpec()), r), { searchCalls: r.maxSearches });
    }
    case "content_email":
      return plan("Draft an email sequence", ["customer_success_manager"], ["email_sequence"], agentSteps(any(emailSpec())), {});
    case "content_seo": {
      const r = { maxSearches: searches("seo_brief") };
      return plan("Write an SEO page", ["seo_specialist"], ["seo_brief"], agentSteps(any(seoSpec()), r), { searchCalls: r.maxSearches });
    }
    case "conversion_audit": {
      const r = { maxSearches: searches("conversion_audit") };
      return plan("Audit your website for conversions", ["cso", "cmo"], ["conversion_audit"], [{ kind: "research", scrapeCredits: 2 }, ...agentSteps(any(conversionAuditSpec()), r)], {
        scrapeCredits: 2,
        searchCalls: r.maxSearches,
      });
    }
    case "retention_plan":
      return plan("Plan retention and loyalty", ["customer_success_manager"], ["retention_plan"], agentSteps(any(retentionSpec())), {});
    case "sales_sequence":
      return plan("Plan sales follow-ups", ["cso"], ["sales_sequence"], agentSteps(any(salesSpec())), {});
    case "social_calendar":
      return plan("Plan next week's posts", ["social_media_manager"], ["social_posts"], agentSteps(any(socialCalendarSpec({ instagram: 3 }))), {});
    default:
      return null; // chat intent and explanations stay single-call
  }
}

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
  | "sales_sequence"
  | "social_calendar";

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
  const modelKey = contract.primaryModel ?? CURRENT_ROUTING.routes[contract.role].primary;
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

export function planJob(kind: JobKind, params: { quantity?: number; images?: number; pages?: number; channel?: string } = {}, opts: { fixture?: boolean } = {}): JobPlan {
  // The weekly planner exists only as an agent: real workspaces always get it.
  if ((engineV2() || kind === "social_calendar") && !opts.fixture) {
    const v2 = v2Plan(kind, params);
    if (v2) return v2;
  }
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
    case "social_calendar":
      // Demo and v1: a deterministic plan from the business facts (no model call).
      return { kind, title: "Plan next week's posts", roles: ["social_media_manager"], tasks: [], steps: [], meters: {} };
  }
}

/** Worst-case cost estimate shown on action cards before anything runs. */
export function estimateJobMicros(plan: JobPlan): number {
  return estimateRun(plan.steps, currentRateVersion().id).costMicros;
}
