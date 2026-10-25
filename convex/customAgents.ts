import { v } from "convex/values";
import { AGENT_ACTIONS, AGENT_ARCHETYPE_BY_ID } from "../shared/agents/registry";
import { microsToCredits } from "../shared/economics";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const DAY = 86_400_000;
const triggerDelay = (trigger: "manual" | "daily" | "weekly") => trigger === "daily" ? DAY : trigger === "weekly" ? 7 * DAY : null;

const permission = v.union(v.literal("read_only"), v.literal("draft"), v.literal("request_approval"));
const knowledgeSource = v.union(v.literal("growth_library"));
const READ_ONLY = new Set(["research", "analyze_results", "note"]);
const DRAFT = new Set(AGENT_ACTIONS.filter((kind) => !["ad_change", "email_send", "schedule_content"].includes(kind)));

function cleanConfiguration(input: {
  archetypeId: string; name: string; objective: string; instructions: string;
  allowedActions: string[]; knowledge: string[]; permission: "read_only" | "draft" | "request_approval";
  maxRunCredits: number; monthlyBudgetCredits?: number; maxActionsPerRun: number; successMetric: string; trigger?: "manual" | "daily" | "weekly";
}) {
  const archetype = AGENT_ARCHETYPE_BY_ID.get(input.archetypeId);
  if (!archetype) throw appError("INVALID", "Choose one of the ClimbOS specialist roles.");
  const allowedActions = [...new Set(input.allowedActions)];
  if (!allowedActions.length || allowedActions.length > 8 || allowedActions.some((action) => !AGENT_ACTIONS.includes(action as (typeof AGENT_ACTIONS)[number]))) {
    throw appError("INVALID", "Choose 1 to 8 supported ClimbOS capabilities.");
  }
  const permissionActions = input.permission === "read_only" ? READ_ONLY : input.permission === "draft" ? DRAFT : new Set(AGENT_ACTIONS);
  if (allowedActions.some((action) => !permissionActions.has(action))) {
    throw appError("INVALID", "The selected permission level does not allow one or more capabilities.");
  }
  const maxRunCredits = Math.round(input.maxRunCredits);
  // Existing settings clients don't send a monthly cap yet. Derive a bounded default
  // from the explicit per-run cap until the profile is edited in the updated UI.
  const monthlyBudgetCredits = Math.round(input.monthlyBudgetCredits ?? Math.min(maxRunCredits * 10, 1000));
  const maxActionsPerRun = Math.round(input.maxActionsPerRun);
  if (!Number.isFinite(maxRunCredits) || maxRunCredits < 1 || maxRunCredits > 100) throw appError("INVALID", "Set a per-run cap from 1 to 100 credits.");
  if (!Number.isFinite(monthlyBudgetCredits) || monthlyBudgetCredits < maxRunCredits || monthlyBudgetCredits > 1000) throw appError("INVALID", "Set a monthly cap at least as high as the per-run cap, up to 1,000 credits.");
  if (!Number.isFinite(maxActionsPerRun) || maxActionsPerRun < 1 || maxActionsPerRun > 4) throw appError("INVALID", "An agent can prepare 1 to 4 actions per request.");
  return {
    archetypeId: archetype.id,
    name: input.name.trim().slice(0, 60) || archetype.name,
    objective: input.objective.trim().slice(0, 500),
    instructions: input.instructions.trim().slice(0, 1500),
    allowedActions,
    knowledge: [...new Set(input.knowledge)].filter((source) => source === "growth_library").slice(0, 1),
    permission: input.permission,
    maxRunCredits,
    monthlyBudgetCredits,
    maxActionsPerRun,
    successMetric: input.successMetric.trim().slice(0, 300),
    trigger: input.trigger ?? "manual",
    modelRouting: "automatic" as const,
  };
}

const configArgs = {
  archetypeId: v.string(), name: v.string(), objective: v.string(), instructions: v.string(),
  allowedActions: v.array(v.string()), knowledge: v.array(knowledgeSource), permission,
  maxRunCredits: v.number(), maxActionsPerRun: v.number(), successMetric: v.string(),
  monthlyBudgetCredits: v.optional(v.number()),
  trigger: v.optional(v.union(v.literal("manual"), v.literal("daily"), v.literal("weekly"))),
};

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role, user } = await requireOrgAccess(ctx, { slug }, "view");
    const agents = await ctx.db.query("customAgents").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(30);
    const monthStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
    const feedbackSince = Date.now() - 90 * 86_400_000;
    return {
      canManage: ["owner", "admin", "editor"].includes(role),
      archetypes: [...AGENT_ARCHETYPE_BY_ID.values()],
      agents: await Promise.all(agents.map(async ({ _id, archetypeId, name, objective, instructions, allowedActions, knowledge, permission, maxRunCredits, monthlyBudgetCredits, maxActionsPerRun, successMetric, trigger, nextTriggerAt, modelRouting, status, updatedAt }) => {
        const monthlyCap = monthlyBudgetCredits ?? null;
        const runs = await ctx.db.query("workflowRuns").withIndex("by_org_custom_agent", (q) => q.eq("orgId", org._id).eq("customAgentId", _id).gte("createdAt", monthStart)).take(501);
        // More than 500 rows means this bounded summary is incomplete. Do not
        // replace missing usage with the budget cap; that would report an
        // estimate as if it were recorded spend.
        const usedMicros = runs.length > 500 ? null : runs.reduce((sum, run) => sum + (["cost_reserved", "preparing", "needs_approval", "approved", "scheduled", "executing"].includes(run.status) ? Math.max(run.actualMicros, run.estimateMicros) : run.actualMicros), 0);
        const activity = await ctx.db.query("workflowRuns").withIndex("by_org_custom_agent", (q) => q.eq("orgId", org._id).eq("customAgentId", _id)).order("desc").take(8);
        const feedbackRows = await ctx.db.query("customAgentFeedback").withIndex("by_agent_updated", (q) => q.eq("orgId", org._id).eq("customAgentId", _id).gte("updatedAt", feedbackSince)).order("desc").take(101);
        const feedbackSample = feedbackRows.slice(0, 100);
        const recentOutcomes = feedbackSample.filter((feedback) => feedback.outcome).slice(0, 3).map((feedback) => ({
          ...feedback.outcome!, reportedAt: feedback.updatedAt,
        }));
        const minutesByRun = new Map<string, number[]>();
        for (const feedback of feedbackSample) {
          if (feedback.minutesSaved === undefined) continue;
          const reports = minutesByRun.get(feedback.workflowRunId) ?? [];
          reports.push(feedback.minutesSaved);
          minutesByRun.set(feedback.workflowRunId, reports);
        }
        const perRunMinutes = [...minutesByRun.values()].map((reports) => reports.reduce((sum, minutes) => sum + minutes, 0) / reports.length).sort((a, b) => a - b);
        const medianMinutesSavedPerRun = perRunMinutes.length
          ? perRunMinutes.length % 2
            ? perRunMinutes[Math.floor(perRunMinutes.length / 2)]
            : (perRunMinutes[perRunMinutes.length / 2 - 1] + perRunMinutes[perRunMinutes.length / 2]) / 2
          : null;
        const recentRuns = await Promise.all(activity.map(async (run) => {
          const feedback = await ctx.db.query("customAgentFeedback").withIndex("by_run_user", (q) => q.eq("workflowRunId", run._id).eq("userId", user._id)).unique();
          return { id: run._id, title: run.title, status: run.status, estimateCredits: microsToCredits(run.estimateMicros), actualCredits: microsToCredits(run.actualMicros), createdAt: run.createdAt, rating: feedback?.rating ?? null, feedbackNote: feedback?.note ?? null, minutesSaved: feedback?.minutesSaved ?? null, outcome: feedback?.outcome ?? null };
        }));
        return {
          id: _id, archetypeId, name, objective, instructions, allowedActions, knowledge, permission,
          maxRunCredits, monthlyBudgetCredits: monthlyCap, monthlyCreditsUsed: usedMicros === null ? null : microsToCredits(usedMicros), maxActionsPerRun, successMetric, trigger, nextTriggerAt: nextTriggerAt ?? null, modelRouting, status, updatedAt, recentRuns,
          workspaceReportedFeedback: { source: "workspace_member_report", windowDays: 90, sampleSize: feedbackSample.length, helpful: feedbackSample.filter((entry) => entry.rating === "helpful").length, needsWork: feedbackSample.filter((entry) => entry.rating === "needs_work").length, timeSavedRunCount: perRunMinutes.length, medianMinutesSavedPerRun, outcomeCount: feedbackSample.filter((entry) => entry.outcome).length, recentOutcomes, capped: feedbackRows.length > 100 },
        };
      })),
    };
  },
});

export const create = mutation({
  args: { slug: v.string(), ...configArgs },
  handler: async (ctx, { slug, ...args }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const existing = await ctx.db.query("customAgents").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).take(30);
    if (existing.length >= 30) throw appError("LIMIT_REACHED", "A workspace can have up to 30 specialist profiles.");
    const config = cleanConfiguration(args);
    const now = Date.now();
    const delay = triggerDelay(config.trigger);
    const id = await ctx.db.insert("customAgents", { orgId: org._id, ...config, ...(delay ? { nextTriggerAt: now + delay } : {}), status: "active", createdBy: user._id, updatedBy: user._id, createdAt: now, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "custom_agent.created", subjectType: "customAgent", subjectId: id, summary: `Created specialist profile "${config.name}".` });
    return { id };
  },
});

export const update = mutation({
  args: { slug: v.string(), agentId: v.id("customAgents"), ...configArgs },
  handler: async (ctx, { slug, agentId, ...args }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const agent = assertSameOrg(await ctx.db.get(agentId), org._id, "specialist");
    if (agent.status !== "active") throw appError("INVALID", "Restore this specialist before editing it.");
    const config = cleanConfiguration({ ...args, trigger: args.trigger ?? agent.trigger });
    const now = Date.now();
    const delay = triggerDelay(config.trigger);
    const nextTriggerAt = delay ? config.trigger !== agent.trigger || agent.nextTriggerAt === undefined ? now + delay : agent.nextTriggerAt : undefined;
    await ctx.db.patch(agentId, { ...config, nextTriggerAt, updatedBy: user._id, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "custom_agent.updated", subjectType: "customAgent", subjectId: agentId, summary: `Updated specialist profile "${config.name}".` });
    return { id: agentId };
  },
});

export const archive = mutation({
  args: { slug: v.string(), agentId: v.id("customAgents") },
  handler: async (ctx, { slug, agentId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const agent = assertSameOrg(await ctx.db.get(agentId), org._id, "specialist");
    const status = agent.status === "active" ? "archived" : "active";
    const now = Date.now();
    const delay = triggerDelay(agent.trigger);
    await ctx.db.patch(agentId, { status, nextTriggerAt: status === "active" && delay ? now + delay : undefined, updatedBy: user._id, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: agent.status === "active" ? "custom_agent.archived" : "custom_agent.restored", subjectType: "customAgent", subjectId: agentId, summary: `${agent.status === "active" ? "Archived" : "Restored"} specialist profile "${agent.name}".` });
  },
});

/** Due profiles are claimed before dispatch so overlapping cron ticks cannot double-run them. */
export const dueAgentIds = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const daily = await ctx.db.query("customAgents").withIndex("by_status_trigger_next", (q) => q.eq("status", "active").eq("trigger", "daily").lte("nextTriggerAt", now)).take(50);
    const weekly = await ctx.db.query("customAgents").withIndex("by_status_trigger_next", (q) => q.eq("status", "active").eq("trigger", "weekly").lte("nextTriggerAt", now)).take(50);
    const due = [...daily, ...weekly];
    const orgIds = [...new Set(due.map((agent) => agent.orgId))];
    const orgs = await Promise.all(orgIds.map((orgId) => ctx.db.get(orgId)));
    const enabledOrgIds = new Set(orgs.filter((org) => org && !org.deletedAt && org.scheduledSpecialistsEnabled !== false).map((org) => org!._id));
    return due.filter((agent) => enabledOrgIds.has(agent.orgId)).map((agent) => agent._id);
  },
});

export const claimDueAgent = internalMutation({
  args: { agentId: v.id("customAgents"), now: v.number() },
  handler: async (ctx, { agentId, now }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent || agent.status !== "active" || agent.trigger === "manual" || !agent.nextTriggerAt || agent.nextTriggerAt > now) return null;
    const org = await ctx.db.get(agent.orgId);
    if (!org || org.deletedAt || org.scheduledSpecialistsEnabled === false) return null;
    const delay = triggerDelay(agent.trigger);
    if (!delay) return null;
    await ctx.db.patch(agentId, { nextTriggerAt: now + delay, updatedAt: now });
    return { agentId };
  },
});

/** Workspace-level control for recurring specialist profiles; manually started profile runs remain available. */
export const setScheduledEnabled = mutation({
  args: { slug: v.string(), enabled: v.boolean() },
  handler: async (ctx, { slug, enabled }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    await ctx.db.patch(org._id, { scheduledSpecialistsEnabled: enabled });
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: enabled ? "automation.scheduled_specialists_enabled" : "automation.scheduled_specialists_paused",
      subjectType: "workspace",
      subjectId: org._id,
      summary: enabled ? "Resumed scheduled specialist profiles." : "Paused scheduled specialist profiles; manual runs remain available.",
    });
    return { enabled };
  },
});

/** Fire scheduled profiles through the existing metered chat workflow. Each run still creates reviewable action cards. */
export const runScheduled = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due: Id<"customAgents">[] = await ctx.runQuery(internal.customAgents.dueAgentIds, { now });
    let started = 0;
    let skipped = 0;
    let failed = 0;
    for (const agentId of due) {
      const claimed = await ctx.runMutation(internal.customAgents.claimDueAgent, { agentId, now });
      if (!claimed) { skipped++; continue; }
      try {
        const result = await ctx.runMutation(internal.workspace.runScheduledCustomAgent, { agentId });
        if (result.started) started++;
        else skipped++;
      } catch (error) {
        failed++;
        console.error("Scheduled specialist run failed", agentId, error);
      }
    }
    return { due: due.length, started, skipped, failed };
  },
});
