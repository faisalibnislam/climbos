import { v } from "convex/values";
import { AGENT_ACTIONS, AGENT_ARCHETYPE_BY_ID } from "../shared/agents/registry";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const permission = v.union(v.literal("read_only"), v.literal("draft"), v.literal("request_approval"));
const knowledgeSource = v.union(v.literal("growth_library"));
const READ_ONLY = new Set(["research", "analyze_results", "note"]);
const DRAFT = new Set(AGENT_ACTIONS.filter((kind) => !["ad_change", "email_send", "schedule_content"].includes(kind)));

function cleanConfiguration(input: {
  archetypeId: string; name: string; objective: string; instructions: string;
  allowedActions: string[]; knowledge: string[]; permission: "read_only" | "draft" | "request_approval";
  maxRunCredits: number; maxActionsPerRun: number; successMetric: string;
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
  const maxActionsPerRun = Math.round(input.maxActionsPerRun);
  if (!Number.isFinite(maxRunCredits) || maxRunCredits < 1 || maxRunCredits > 100) throw appError("INVALID", "Set a per-run cap from 1 to 100 credits.");
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
    maxActionsPerRun,
    successMetric: input.successMetric.trim().slice(0, 300),
    trigger: "manual" as const,
    modelRouting: "automatic" as const,
  };
}

const configArgs = {
  archetypeId: v.string(), name: v.string(), objective: v.string(), instructions: v.string(),
  allowedActions: v.array(v.string()), knowledge: v.array(knowledgeSource), permission,
  maxRunCredits: v.number(), maxActionsPerRun: v.number(), successMetric: v.string(),
};

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const agents = await ctx.db.query("customAgents").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(100);
    return {
      canManage: ["owner", "admin", "editor"].includes(role),
      archetypes: [...AGENT_ARCHETYPE_BY_ID.values()],
      agents: agents.map(({ _id, archetypeId, name, objective, instructions, allowedActions, knowledge, permission, maxRunCredits, maxActionsPerRun, successMetric, trigger, modelRouting, status, updatedAt }) => ({
        id: _id, archetypeId, name, objective, instructions, allowedActions, knowledge, permission,
        maxRunCredits, maxActionsPerRun, successMetric, trigger, modelRouting, status, updatedAt,
      })),
    };
  },
});

export const create = mutation({
  args: { slug: v.string(), ...configArgs },
  handler: async (ctx, { slug, ...args }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const config = cleanConfiguration(args);
    const now = Date.now();
    const id = await ctx.db.insert("customAgents", { orgId: org._id, ...config, status: "active", createdBy: user._id, updatedBy: user._id, createdAt: now, updatedAt: now });
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
    const config = cleanConfiguration(args);
    await ctx.db.patch(agentId, { ...config, updatedBy: user._id, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "custom_agent.updated", subjectType: "customAgent", subjectId: agentId, summary: `Updated specialist profile "${config.name}".` });
    return { id: agentId };
  },
});

export const archive = mutation({
  args: { slug: v.string(), agentId: v.id("customAgents") },
  handler: async (ctx, { slug, agentId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const agent = assertSameOrg(await ctx.db.get(agentId), org._id, "specialist");
    await ctx.db.patch(agentId, { status: agent.status === "active" ? "archived" : "active", updatedBy: user._id, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: agent.status === "active" ? "custom_agent.archived" : "custom_agent.restored", subjectType: "customAgent", subjectId: agentId, summary: `${agent.status === "active" ? "Archived" : "Restored"} specialist profile "${agent.name}".` });
  },
});
