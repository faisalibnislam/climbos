import { isServiceBusiness } from "../shared/acquisition/library";
import { legacyPlanHash, planContentHash } from "./lib/planHash";
import { minorToMajor } from "../shared/economics/currency";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { ACTIVE_RUN_STATUSES, createRunWithReservation, finishRunImpl, latestRunOfKind, reopenFailedRun } from "./engine";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { approvalHash, can } from "../shared/policy";
import { holdPlanChannel, startCardRun, startPlanWork, type PlanWorkResult } from "./lib/cards";
import { autoStartPlanTargets } from "./targets";
import { notifyOwners } from "./lib/notify";
import { chargeableAccess, isPaid } from "./lib/access";
import { creditBalance } from "./lib/credits";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { aiModeView } from "./lib/aiMode";
import { currentPeriod } from "./lib/periods";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { redactFeedback } from "../shared/lab/redact";
import { canDriveWork, type QualityState } from "../shared/agents/quality";
import { applyOwnerEconomics, decisionQuestions, playsGoalGap, selectPortfolio, withForecasts, type Economics, type OwnerEconomics, type PlayLike } from "../shared/agents/economics";
import { projectGrowthOpportunities, type OpportunityPlayInput } from "../shared/agents/opportunities";
import { AGENT_ARCHETYPE_BY_ID } from "../shared/agents/registry";

/** Everything the Today screen needs, in one bounded query. */
export const today = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role, user } = await requireOrgAccess(ctx, { slug }, "view");
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const pendingApprovals = await ctx.db
      .query("artifacts")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "in_review"))
      .order("desc")
      .take(20);
    const strategy = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .first();
    const cards = await ctx.db
      .query("actionCards")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "proposed"))
      .order("desc")
      .take(20);
    const running = await ctx.db
      .query("actionCards")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "running"))
      .take(10);
    // Real jobs only (not the chat plumbing behind Climb AI and wishes).
    const runs = (
      await ctx.db
        .query("workflowRuns")
        .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
        .order("desc")
        .take(30)
    )
      .filter((r) => r.kind !== "climb_chat" && r.kind !== "chat_intent")
      .slice(0, 6);
    // Real counts for the glance cards (not just the six recent runs shown).
    const isJob = (r: Doc<"workflowRuns">) => r.kind !== "climb_chat" && r.kind !== "chat_intent";
    let workingNow = 0;
    for (const status of ACTIVE_RUN_STATUSES) {
      const rows = await ctx.db
        .query("workflowRuns")
        .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status as Doc<"workflowRuns">["status"]))
        .take(50);
      workingNow += rows.filter(isJob).length;
    }
    const doneThisWeek = (
      await ctx.db
        .query("workflowRuns")
        .withIndex("by_org_created", (q) => q.eq("orgId", org._id).gte("createdAt", Date.now() - 7 * 86_400_000))
        .take(1000)
    ).filter((r) => r.status === "verified" && isJob(r)).length;
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(30);
    const cardIds = new Set(messages.flatMap((m) => m.actionCardIds));
    const chatCards: Doc<"actionCards">[] = [];
    for (const id of [...cardIds].slice(0, 40)) {
      const c = await ctx.db.get(id);
      if (c) chatCards.push(c);
    }
    const period = await currentPeriod(ctx, org);
    const access = await chargeableAccess(ctx, org);
    const uncertain = await ctx.db
      .query("artifacts")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "uncertain"))
      .take(5);

    // Three prioritized next actions: approvals first, then plan approval, then proposed cards.
    const next: { title: string; why: string; href: string; kind: string }[] = [];
    if (strategy?.status === "needs_approval") {
      next.push({ title: "Review your growth plan", why: "Approve it so the team can start working on it.", href: `/app/${slug}/plan`, kind: "plan" });
    }
    if (!strategy) {
      next.push({ title: "Build your growth plan", why: "Your team turns your goal into a short, costed plan you approve.", href: `/app/${slug}/plan`, kind: "plan" });
    }
    if (pendingApprovals.length > 0) {
      next.push({
        title: `Review ${pendingApprovals.length} draft${pendingApprovals.length === 1 ? "" : "s"}`,
        why: "Nothing goes live until you approve it.",
        href: `/app/${slug}/content?status=in_review`,
        kind: "approvals",
      });
    }
    if (uncertain.length > 0) {
      next.push({ title: "Check an uncertain post", why: "We couldn't confirm whether it was posted, so we won't repeat it until it's checked.", href: `/app/${slug}/content/${uncertain[0]._id}`, kind: "uncertain" });
    }
    for (const c of cards.sort((a, b) => a.priority - b.priority)) {
      if (next.length >= 3) break;
      next.push({ title: c.title, why: c.description, href: `/app/${slug}/today#card-${c._id}`, kind: "card" });
    }
    if (next.length < 3 && business && !business.insights) {
      next.push({ title: "Finish understanding your business", why: "Better facts lead to better plans.", href: org.onboardingStep === "done" ? `/app/${slug}/settings/business` : `/onboarding?workspace=${slug}`, kind: "onboarding" });
    }

    return {
      org: { slug: org.slug, name: org.name, kind: org.kind, onboardingStep: org.onboardingStep, currency: org.currency, timezone: org.timezone },
      role,
      userName: user.name ?? user.email ?? null,
      emergencyStop: org.emergencyStop?.active ? { at: org.emergencyStop.at, reason: org.emergencyStop.reason ?? null } : null,
      goal: goal ? { statement: goal.statement, horizonDays: goal.horizonDays, monthlyAdBudget: minorToMajor(goal.monthlyAdBudgetMinor, goal.currency), currency: goal.currency, createdAt: goal.createdAt } : null,
      business: business ? { name: business.name, website: business.website ?? null, summary: business.summary ?? null, type: business.businessType ?? null } : null,
      next: next.slice(0, 3),
      approvals: pendingApprovals.slice(0, 6).map((a) => ({ id: a._id, title: a.title, channel: a.channel, kind: a.kind, createdByRole: a.createdByRole ?? null, updatedAt: a.updatedAt })),
      approvalsCount: pendingApprovals.length,
      strategy: strategy
        ? {
            id: strategy._id,
            status: strategy.status,
            version: strategy.version,
            summary: strategy.summary,
            opportunities: projectGrowthOpportunities((strategy.expert?.plays ?? []) as OpportunityPlayInput[]),
          }
        : null,
      cards: [...cards, ...running]
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 6)
        .map(cardView),
      counts: { workingNow, doneThisWeek },
      recent: runs.map((r) => ({ id: r._id, kind: r.kind, title: r.title, status: r.status, roles: r.roles, createdAt: r.createdAt, userMessage: r.userMessage ?? null, isFixture: r.isFixture })),
      chat: messages
        .reverse()
        .map((m) => ({ id: m._id, author: m.author, text: m.text, understood: m.understood ?? null, status: m.status, runId: m.runId ?? null, replyTo: m.replyTo ?? null, createdAt: m.createdAt, cards: m.actionCardIds.map((id) => chatCards.find((c) => c._id === id)).filter((c): c is Doc<"actionCards"> => Boolean(c)).map(cardView) })),
      usage: period
        ? {
            source: period.source,
            walletFraction: period.walletCapMicros > 0 ? (period.walletSpentMicros + period.walletReservedMicros) / period.walletCapMicros : 1,
            endsAt: period.endsAt,
          }
        : null,
      canRunAi: access.allowed,
      accessCode: access.allowed ? null : access.code,
      accessMessage: access.allowed ? null : access.message,
    };
  },
});

function cardView(c: Doc<"actionCards">) {
  const payload = (() => {
    try {
      return JSON.parse(c.payload) as { job?: string | null; channel?: string; agentArchetypeId?: string };
    } catch {
      return {};
    }
  })();
  return {
    job: payload.job ?? null,
    agentId: payload.agentArchetypeId ?? null,
    agentName: payload.agentArchetypeId ? AGENT_ARCHETYPE_BY_ID.get(payload.agentArchetypeId)?.name ?? null : null,
    channel: payload.channel ?? "",
    id: c._id,
    title: c.title,
    description: c.description,
    proposedEffect: c.proposedEffect,
    kind: c.kind,
    roles: c.roles,
    costEstimateMicros: c.costEstimateMicros,
    externalEffect: c.externalEffect,
    status: c.status,
    blockedReason: c.blockedReason ?? null,
    runId: c.runId ?? null,
  };
}

/** Chat never acts directly: it creates a COO run that proposes action cards. */
export const sendChat = mutation({
  args: { slug: v.string(), text: v.string() },
  handler: async (ctx, { slug, text }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    return postChat(ctx, org, user._id, text);
  },
});

/** Run a saved specialist profile manually through the existing metered COO workflow. */
export const runCustomAgent = mutation({
  args: { slug: v.string(), agentId: v.id("customAgents"), request: v.string() },
  handler: async (ctx, { slug, agentId, request }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const agent = assertSameOrg(await ctx.db.get(agentId), org._id, "specialist");
    if (agent.status !== "active") throw appError("INVALID", "This specialist is archived.");
    if (!AGENT_ARCHETYPE_BY_ID.has(agent.archetypeId)) throw appError("INVALID", "This specialist role is no longer available.");
    const clean = request.trim().slice(0, 1500);
    if (!clean) throw appError("INVALID", "Describe what you want this specialist to do.");
    return postChat(ctx, org, user._id, clean, agentId);
  },
});

/** Scheduled custom-agent work is internal, metered, and produces suggestions for the member to review. */
export const runScheduledCustomAgent = internalMutation({
  args: { agentId: v.id("customAgents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent || agent.status !== "active" || agent.trigger === "manual") return { started: false, reason: "inactive" };
    const org = await ctx.db.get(agent.orgId);
    if (!org || org.deletedAt || org.kind === "demo" || org.emergencyStop?.active) return { started: false, reason: "workspace_unavailable" };
    const memberships = await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(100);
    const creator = memberships.find((membership) => membership.userId === agent.createdBy && membership.status === "active" && ["owner", "admin", "editor"].includes(membership.role));
    const fallbackOwner = memberships.find((membership) => membership.status === "active" && membership.role === "owner" && membership.userId);
    const userId = creator?.userId ?? fallbackOwner?.userId;
    if (!userId) return { started: false, reason: "no_active_member" };
    const recent = await ctx.db.query("workflowRuns").withIndex("by_org_custom_agent", (q) => q.eq("orgId", org._id).eq("customAgentId", agent._id)).order("desc").take(5);
    if (recent.some((run) => ["cost_reserved", "preparing", "needs_approval", "approved", "scheduled", "executing", "paused"].includes(run.status))) return { started: false, reason: "already_running" };
    const request = `Scheduled ${agent.trigger} review. Use the latest approved plan, measured workspace results, and confirmed business facts. Objective: ${agent.objective}. Success measure: ${agent.successMetric}. Identify missing evidence clearly and prepare only the smallest useful next step. Do not publish, send, spend, or change external accounts.`;
    await postChat(ctx, org, userId, request, agent._id);
    return { started: true };
  },
});

/** Record a workspace member's report of usefulness after a custom specialist run finishes. */
export const rateCustomAgentRun = mutation({
  args: { slug: v.string(), runId: v.id("workflowRuns"), rating: v.union(v.literal("helpful"), v.literal("needs_work")), note: v.optional(v.string()) },
  handler: async (ctx, { slug, runId, rating, note }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "specialist run");
    if (!run.customAgentId || !["verified", "failed", "uncertain", "canceled"].includes(run.status)) throw appError("INVALID", "Rate a finished specialist run.");
    assertSameOrg(await ctx.db.get(run.customAgentId), org._id, "specialist");
    const prior = await ctx.db.query("customAgentFeedback").withIndex("by_run_user", (q) => q.eq("workflowRunId", run._id).eq("userId", user._id)).unique();
    const cleanNote = note?.trim().slice(0, 800) || undefined;
    if (prior) await ctx.db.patch(prior._id, { rating, note: cleanNote, updatedAt: Date.now() });
    else await ctx.db.insert("customAgentFeedback", { orgId: org._id, customAgentId: run.customAgentId, workflowRunId: run._id, userId: user._id, rating, note: cleanNote, evidenceKind: "member_reported", createdAt: Date.now(), updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "custom_agent.outcome_rated", subjectType: "workflowRun", subjectId: run._id, summary: `Recorded ${rating === "helpful" ? "helpful" : "needs work"} feedback for a specialist run${cleanNote ? `: ${cleanNote.slice(0, 120)}` : "."}` });
  },
});

/**
 * "Make it happen" on a play (REQ-UX-03): the request is built here from the
 * stored play, found by plan and play ID, never from text the page assembled.
 */
export const startPlay = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), playId: v.string() },
  handler: async (ctx, { slug, strategyId, playId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (hasNewerOwnerEconomics(s, business?.unitEconomics)) throw appError("INVALID", "Your confirmed business numbers changed after this plan was created. Refresh the plan before starting this play.");
    const play = ((s.expert?.plays ?? []) as { id?: string; name: string; oneLiner: string; audience: string; hook: string; climbosCanDo: string }[]).find((p) => p.id === playId);
    if (!play) throw appError("NOT_FOUND", "That play isn't in this plan.");
    return postChat(ctx, org, user._id, `Start the "${play.name}" play (plan v${s.version}, play ${playId}): ${play.oneLiner} Audience: ${play.audience}. Hook: ${play.hook}. Prepare everything your team can do for it now: ${play.climbosCanDo}`);
  },
});

/** Starts a contextual conversation from a saved opportunity, using stored plan data rather than browser-authored context. */
export const askAboutOpportunity = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), opportunityId: v.string(), question: v.optional(v.string()) },
  handler: async (ctx, { slug, strategyId, opportunityId, question }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "chat");
    const strategy = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const play = ((strategy.expert?.plays ?? []) as { id?: string; name: string; oneLiner: string; audience?: string; hook?: string; firstActionToday?: string; biggestUnknown?: string; model?: { reachSource?: { source?: string; ref?: string; quote?: string }; steps?: { source?: string; ref?: string; quote?: string }[] } }[]).find((item) => item.id === opportunityId);
    if (!play) throw appError("NOT_FOUND", "That opportunity isn't in this plan.");
    const ownerQuestion = question?.trim().slice(0, 500) || "Why is this a good opportunity for my business?";
    const evidence = [play.model?.reachSource, ...(play.model?.steps ?? [])]
      .filter((item): item is { source?: string; ref?: string; quote?: string } => Boolean(item))
      .slice(0, 6)
      .map((item) => `${item.source ?? "unlabeled"}${item.ref ? ` · ${item.ref.slice(0, 240)}` : ""}${item.quote ? ` · “${item.quote.slice(0, 180)}”` : ""}`);
    const text = [
      `Help me understand this growth opportunity from plan v${strategy.version}. Plan text is prior analysis, not new proof. Preserve whether each input is owner-reported, research, benchmark, planned, or assumed. Do not start work or change the plan unless I explicitly ask.`,
      `Opportunity: ${play.name}. ${play.oneLiner}`,
      play.audience ? `Audience: ${play.audience}` : "",
      play.hook ? `Approach: ${play.hook}` : "",
      play.firstActionToday ? `Suggested first step: ${play.firstActionToday}` : "",
      play.biggestUnknown ? `Biggest unknown: ${play.biggestUnknown}` : "",
      evidence.length ? `Saved evidence basis (provenance · reference · quote):\n${evidence.join("\n")}` : "No evidence references were saved with this opportunity.",
      `My question: ${ownerQuestion}`,
    ].filter(Boolean).join("\n");
    return postChat(ctx, org, user._id, text);
  },
});

async function postChat(ctx: MutationCtx, org: Doc<"organizations">, userId: Id<"users">, text: string, customAgentId?: Id<"customAgents">): Promise<{ messageId: Id<"chatMessages"> }> {
  const clean = text.trim().slice(0, 2000);
  if (!clean) throw appError("INVALID", "Type a message first.");
  const now = Date.now();
  const recent = await ctx.db
    .query("chatMessages")
    .withIndex("by_org_created", (q) => q.eq("orgId", org._id).gt("createdAt", now - 60_000))
    .take(20);
  if (recent.filter((m) => m.author === "user").length >= 6) {
    throw appError("RATE_LIMITED", "That's a lot of messages in a minute. Give the team a moment to catch up.");
  }
  const messageId = await ctx.db.insert("chatMessages", { orgId: org._id, author: "user", userId, text: clean, customAgentId, roles: [], actionCardIds: [], status: "thinking", createdAt: now });
  const plan = planJob("chat_intent");
  let runId;
  try {
    runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: plan.title, roles: plan.roles, input: { messageId, customAgentId }, steps: plan.steps, meters: plan.meters, createdBy: userId, isFixture: org.kind === "demo", customAgentId });
  } catch (e) {
    await ctx.db.patch(messageId, { status: "failed" });
    throw e;
  }
  await ctx.db.patch(messageId, { runId });
  await ctx.scheduler.runAfter(0, internal.jobs.chatIntent, { runId, messageId, text: clean, customAgentId });
  return { messageId };
}

/** Approving a card starts exactly the job it described, with the estimate it showed. */
export const runCard = mutation({
  args: { slug: v.string(), cardId: v.id("actionCards") },
  handler: async (ctx, { slug, cardId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const card = assertSameOrg(await ctx.db.get(cardId), org._id, "action");
    if (card.status !== "proposed") throw appError("INVALID", "This action has already been handled.");
    if (card.kind === "note") {
      await ctx.db.patch(card._id, { status: "done", updatedAt: Date.now() });
      return { runId: null };
    }
    const runId = await startCardRun(ctx, { org, card, userId: user._id, auto: false });
    if (!runId) throw appError("UNAVAILABLE", card.blockedReason ?? "ClimbOS can't prepare this automatically yet.");
    return { runId };
  },
});

export const dismissCard = mutation({
  args: { slug: v.string(), cardId: v.id("actionCards") },
  handler: async (ctx, { slug, cardId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const card = assertSameOrg(await ctx.db.get(cardId), org._id, "action");
    if (card.status === "proposed" || card.status === "blocked") await ctx.db.patch(card._id, { status: "rejected", updatedAt: Date.now() });
  },
});

export const resultsSnapshot = internalQuery({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return "{}";
    const rows = await ctx.db
      .query("metricDaily")
      .withIndex("by_org_date", (q) => q.eq("orgId", run.orgId).gte("date", new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)))
      .take(2000);
    const totals: Record<string, { last30: number; prev30: number; source: string }> = {};
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const r of rows) {
      if (r.kind !== "observed" || r.channel) continue;
      const t = (totals[r.metricKey] ??= { last30: 0, prev30: 0, source: r.source });
      if (r.date >= cutoff) t.last30 += r.value;
      else t.prev30 += r.value;
    }
    return JSON.stringify({ totals, note: "Observed values from connected sources. Revenue in minor currency units." });
  },
});

export const startExplain = internalAction({
  args: { runId: v.id("workflowRuns"), cardId: v.optional(v.id("actionCards")) },
  handler: async (ctx, { runId, cardId }) => {
    const metricsJson = await ctx.runQuery(internal.workspace.resultsSnapshot, { runId });
    await ctx.runAction(internal.jobs.explainResults, { runId, metricsJson, cardId });
  },
});

/**
 * Pause all activity: cancel queued jobs, block new writes, unschedule posts
 * and attempt provider-side pauses for active ads. Reports what was verified.
 */
export const pauseAll = mutation({
  args: { slug: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { slug, reason }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "pause");
    const now = Date.now();
    await ctx.db.patch(org._id, { emergencyStop: { active: true, at: now, by: user._id, reason: reason?.slice(0, 300) } });
    let canceledRuns = 0;
    for (const status of ["proposed", "cost_reserved", "needs_approval", "approved", "scheduled"] as const) {
      const runs = await ctx.db
        .query("workflowRuns")
        .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status))
        .take(100);
      for (const r of runs) {
        await finishRunImpl(ctx, { runId: r._id, status: "canceled", error: "Paused by owner", userMessage: "Canceled because all activity was paused." });
        canceledRuns++;
      }
    }
    const scheduled = await ctx.db
      .query("artifacts")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "scheduled"))
      .take(300);
    for (const a of scheduled) await ctx.db.patch(a._id, { status: "approved", scheduledFor: undefined, updatedAt: now });
    const activeCampaigns = (
      await ctx.db
        .query("campaigns")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(200)
    ).filter((c) => c.status === "active");
    for (const c of activeCampaigns) {
      await ctx.scheduler.runAfter(0, internal.ads.pauseCampaignForStop, { campaignId: c._id });
    }
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "workspace.paused",
      summary: `Paused all activity: ${canceledRuns} job(s) canceled, ${scheduled.length} post(s) unscheduled, ${activeCampaigns.length} ad campaign pause(s) requested.`,
    });
    return { canceledRuns, unscheduled: scheduled.length, campaignsPausing: activeCampaigns.length };
  },
});

export const resumeAll = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "resume");
    await ctx.db.patch(org._id, { emergencyStop: undefined });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "workspace.resumed", summary: "Resumed activity. Nothing restarts automatically; reschedule posts you still want." });
  },
});

export const pauseStatus = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const campaigns = (
      await ctx.db
        .query("campaigns")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(200)
    ).filter((c) => c.externalId);
    return {
      paused: Boolean(org.emergencyStop?.active),
      at: org.emergencyStop?.at ?? null,
      campaigns: campaigns.map((c) => ({ id: c._id, name: c.name, channel: c.channel, status: c.status })),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Plan                                                                 */
/* ------------------------------------------------------------------ */

export const plan = query({
  args: { slug: v.string(), strategyId: v.optional(v.id("strategies")) },
  handler: async (ctx, { slug, strategyId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const versions = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(10);
    const latest = versions[0] ?? null;
    const approved = versions.find((s) => s.status === "approved") ?? null;
    // The approved plan guides the team, so it shows first; a newer version waiting or sent back gets a banner.
    // Any version can be opened from the history, not only the most recent ones.
    const picked = strategyId ? (versions.find((s) => s._id === strategyId) ?? (await ctx.db.get(strategyId))) : null;
    const strategy = (picked && picked.orgId === org._id ? picked : null) ?? approved ?? latest;
    const newer = approved && latest && latest._id !== approved._id && (latest.status === "needs_approval" || latest.status === "draft") ? latest : null;
    const other = strategy && newer ? (strategy._id === newer._id ? approved : newer) : null;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    const experiments = strategy
      ? (
          await ctx.db
            .query("experiments")
            .withIndex("by_org", (q) => q.eq("orgId", org._id))
            .order("desc")
            .take(20)
        ).filter((e) => e.strategyId === strategy._id)
      : [];
    const facts = [];
    for (const id of (strategy?.sourceFactIds ?? []).slice(0, 40)) {
      const f = await ctx.db.get(id);
      if (f && f.orgId === org._id) facts.push({ id: f._id, statement: f.statement, category: f.category });
    }
    const strategyRun = await latestRunOfKind(ctx, org._id, "strategy");
    const currentEconomics = strategy?.expert?.economics
      ? { ...applyOwnerEconomics(strategy.expert.economics as Economics, business?.unitEconomics), currency: goal?.currency ?? business?.currency }
      : null;
    const currentPlays = strategy?.expert?.plays?.length && currentEconomics
      ? withForecasts({ economics: currentEconomics as Economics, plays: strategy.expert.plays as PlayLike[] })
      : null;
    // Owner edits immediately refresh every deterministic derived number in the returned plan view.
    const currentPortfolio = currentPlays
      ? selectPortfolio(currentPlays, {
          ...(goal ? { monthlyBudgetUsd: minorToMajor(goal.monthlyAdBudgetMinor, goal.currency) } : {}),
          ...(business?.unitEconomics?.ownerHoursPerWeek !== undefined ? { ownerHoursPerWeek: business.unitEconomics.ownerHoursPerWeek } : {}),
          ...(business?.unitEconomics?.newCustomersPerMonth !== undefined ? { newCustomersPerMonth: business.unitEconomics.newCustomersPerMonth } : {}),
          horizonDays: goal?.horizonDays,
        })
      : null;
    return {
      role,
      canApprove: ["owner", "admin", "reviewer"].includes(role),
      canEdit: ["owner", "admin", "editor"].includes(role),
      goal: goal ? { statement: goal.statement, horizonDays: goal.horizonDays, monthlyAdBudget: minorToMajor(goal.monthlyAdBudgetMinor, goal.currency), currency: goal.currency } : null,
      strategy: strategy
        ? {
            id: strategy._id,
            version: strategy.version,
            status: strategy.status,
            summary: strategy.summary,
            positioning: strategy.positioning,
            audiences: strategy.audiences,
            channels: strategy.channels,
            constraints: strategy.constraints,
            measurementPlan: strategy.measurementPlan,
            reviewDate: strategy.reviewDate,
            createdAt: strategy.createdAt,
            // Owner-confirmed unit economics apply on read: cost per customer and payback update at once.
            expert: strategy.expert ? {
              ...strategy.expert,
              ...(currentEconomics ? { economics: currentEconomics } : {}),
              ...(currentPlays ? { plays: currentPlays.plays } : {}),
              ...(currentPortfolio ? { portfolio: currentPortfolio } : {}),
              ...(currentPlays ? { goalGap: playsGoalGap(currentPlays, goal ? { target: goal.target, horizonDays: goal.horizonDays } : null) } : {}),
            } : null,
          }
        : null,
      /** Up to 3 questions whose answers would change this plan's verdicts (computed, not written by the model). */
      questions: strategy?.expert?.plays?.length && strategy.expert.economics ? decisionQuestions({ economics: strategy.expert.economics as Economics, plays: strategy.expert.plays as PlayLike[] }, business?.unitEconomics, 3, { serviceBusiness: isServiceBusiness(business?.acquisition?.types, business?.businessType), horizonDays: goal?.horizonDays }) : [],
      unitEconomics: business?.unitEconomics ?? null,
      funnel: business?.funnel ?? null,
      /** The owner answered after this plan was written: numbers are current, the text may not be. */
      answersNewerThanPlan: Boolean(strategy && business?.unitEconomics && business.unitEconomics.updatedAt > strategy.createdAt),
      strategyRun: strategyRun ? { id: strategyRun._id, status: strategyRun.status, userMessage: strategyRun.userMessage ?? null, createdAt: strategyRun.createdAt } : null,
      /** When the newest version was written (a failed refresh after it is shown). */
      latestVersionAt: latest?.createdAt ?? null,
      /** The other version worth seeing: a newer one waiting or sent back, or the approved one while viewing it. */
      otherVersion: other ? { id: other._id, version: other.version, status: other.status, createdAt: other.createdAt } : null,
      planEstimateMicros: estimateJobMicros(planJob("strategy")),
      experiments: experiments.map((e) => ({ id: e._id, name: e.name, hypothesis: e.hypothesis, population: e.population, method: e.method, primaryMetric: e.primaryMetric, guardrails: e.guardrails, durationDays: e.durationDays, stoppingRule: e.stoppingRule, status: e.status, analyses: (e.analyses ?? []).map(({ reviewedBy: _by, ...x }) => x) })),
      insights: business?.insights ?? null,
      sources: facts,
      currency: org.currency,
    };
  },
});

/** The owner's unit economics: they replace the planner's assumptions in every number and future plan. */
export const setUnitEconomics = mutation({
  args: {
    slug: v.string(),
    revenuePerCustomerMonthUsd: v.optional(v.number()),
    grossMargin: v.optional(v.number()),
    monthlyChurn: v.optional(v.number()),
    ownerHourUsd: v.optional(v.number()),
    ownerHoursPerWeek: v.optional(v.number()),
    newCustomersPerMonth: v.optional(v.number()),
    ranges: v.optional(v.object({ revenue: v.optional(v.object({ low: v.number(), high: v.number() })), margin: v.optional(v.object({ low: v.number(), high: v.number() })), churn: v.optional(v.object({ low: v.number(), high: v.number() })) })),
  },
  handler: async (ctx, { slug, ranges, ...vals }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Add your business first.");
    const check = (x: number | undefined, lo: number, hi: number, what: string) => {
      if (x !== undefined && !(x >= lo && x <= hi)) throw appError("INVALID", `${what} looks wrong.`);
    };
    check(vals.revenuePerCustomerMonthUsd, 0.01, 1_000_000, "Revenue per customer");
    check(vals.grossMargin, 0.01, 1, "Margin");
    check(vals.monthlyChurn, 0.001, 0.95, "Monthly churn");
    check(vals.ownerHourUsd, 1, 5_000, "Hourly value");
    check(vals.ownerHoursPerWeek, 0, 80, "Hours a week");
    check(vals.newCustomersPerMonth, 0, 100_000, "New customers a month");
    // A range must be low < high and pass the same checks; its value is the midpoint (set by the client, re-checked here).
    const pairs = { revenue: ["revenuePerCustomerMonthUsd", 0.01, 1_000_000, "Revenue range"], margin: ["grossMargin", 0.01, 1, "Margin range"], churn: ["monthlyChurn", 0.001, 0.95, "Churn range"] } as const;
    for (const [k, [field, lo, hi, what]] of Object.entries(pairs)) {
      const r = ranges?.[k as keyof typeof pairs];
      if (!r) continue;
      check(r.low, lo, hi, what);
      check(r.high, lo, hi, what);
      if (!(r.low < r.high)) throw appError("INVALID", `${what}: low must be below high.`);
      if (vals[field] === undefined) throw appError("INVALID", `${what}: give the value too.`);
    }
    const prev = business.unitEconomics;
    const next = {
      revenuePerCustomerMonthUsd: vals.revenuePerCustomerMonthUsd ?? prev?.revenuePerCustomerMonthUsd,
      grossMargin: vals.grossMargin ?? prev?.grossMargin,
      monthlyChurn: vals.monthlyChurn ?? prev?.monthlyChurn,
      ownerHourUsd: vals.ownerHourUsd ?? prev?.ownerHourUsd,
      ownerHoursPerWeek: vals.ownerHoursPerWeek ?? prev?.ownerHoursPerWeek,
      newCustomersPerMonth: vals.newCustomersPerMonth ?? prev?.newCustomersPerMonth,
      // A new single number replaces its old range; a new range replaces the old one.
      ...(() => {
        const keep = { ...(prev?.ranges ?? {}) } as Record<string, { low: number; high: number }>;
        if (vals.revenuePerCustomerMonthUsd !== undefined) delete keep.revenue;
        if (vals.grossMargin !== undefined) delete keep.margin;
        if (vals.monthlyChurn !== undefined) delete keep.churn;
        const merged = { ...keep, ...(ranges ?? {}) };
        return Object.keys(merged).length ? { ranges: merged } : {};
      })(),
      updatedAt: Date.now(),
    };
    await ctx.db.patch(business._id, { unitEconomics: next });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business.unit_economics", subjectType: "business", subjectId: business._id, summary: "Unit economics updated." });
  },
});

/** The owner's last-period funnel: the plan's diagnosis reads the weakest link from it (shared/agents/diagnosis.ts). */
export const setFunnel = mutation({
  args: { slug: v.string(), periodDays: v.number(), visitors: v.optional(v.number()), leads: v.optional(v.number()), activated: v.optional(v.number()), newCustomers: v.optional(v.number()), activationKind: v.optional(v.union(v.literal("value"), v.literal("habit"), v.literal("setup"), v.literal("unknown"))), signupKind: v.optional(v.union(v.literal("free_plan"), v.literal("trial_no_card"), v.literal("trial_card"), v.literal("unknown"))) },
  handler: async (ctx, { slug, periodDays, activationKind, signupKind, ...counts }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Add your business first.");
    if (!(periodDays >= 7 && periodDays <= 365)) throw appError("INVALID", "Pick a period between 7 and 365 days.");
    for (const [k, n] of Object.entries(counts)) if (n !== undefined && !(Number.isInteger(n) && n >= 0 && n <= 100_000_000)) throw appError("INVALID", `${k} must be a whole number.`);
    const { visitors, leads, activated, newCustomers } = counts;
    // Each step can't exceed the one before it (when both are given).
    const order = [visitors, leads, activated, newCustomers];
    for (let i = 1; i < order.length; i++) {
      const prev = order.slice(0, i).reverse().find((x) => x !== undefined);
      if (order[i] !== undefined && prev !== undefined && order[i]! > prev) throw appError("INVALID", "Each step should be smaller than the one before (visitors ≥ leads ≥ activated ≥ new customers).");
    }
    await ctx.db.patch(business._id, { funnel: { periodDays, ...counts, ...(activationKind ? { activationKind } : {}), ...(signupKind ? { signupKind } : {}), updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business.funnel", subjectType: "business", subjectId: business._id, summary: "Funnel numbers updated." });
  },
});

export const decidePlan = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), decision: v.union(v.literal("approve"), v.literal("reject")), note: v.optional(v.string()) },
  handler: async (ctx, { slug, strategyId, decision, note }): Promise<PlanWorkResult | null> => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "approve");
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    if (s.status !== "needs_approval") throw appError("INVALID", "This plan isn't waiting for approval.");
    if (decision === "approve") {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
      if (hasNewerOwnerEconomics(s, business?.unitEconomics)) throw appError("INVALID", "Your confirmed business numbers changed after this plan was created. Refresh the plan before approving it.");
    }
    // A plan that failed ClimbOS's hard checks can be read and sent back, never approved into work.
    if (decision === "approve" && !canDriveWork((s.expert as { quality?: { state: QualityState } } | undefined)?.quality)) throw appError("INVALID", "This plan didn't pass ClimbOS checks, so it can't start work. Refresh the plan or send it back.");
    const now = Date.now();
    // The decision follows the current approval rules: who may approve, and a binding that hasn't expired.
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (policy && !policy.approvalRoles.includes(role)) throw appError("FORBIDDEN", "Your approval rules don't let your role approve plans.");
    // Approving needs a binding to this exact content; sending back doesn't.
    if (s.approvalId && decision === "approve") await refreshPlanApproval(ctx, s, user._id);
    let work: PlanWorkResult | null = null;
    if (decision === "approve") {
      const prior = await ctx.db
        .query("strategies")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(20);
      for (const p of prior) {
        if (p._id === s._id || p.status !== "approved") continue;
        await ctx.db.patch(p._id, { status: "superseded" });
        // Work the old plan was still waiting to start no longer applies.
        for (const c of p.channels) {
          const card = c.cardId ? await ctx.db.get(c.cardId) : null;
          if (card && (card.status === "proposed" || card.status === "blocked")) await ctx.db.patch(card._id, { status: "rejected", updatedAt: now });
        }
      }
      await ctx.db.patch(s._id, { status: "approved", channels: s.channels.map((c) => (c.status === "proposed" ? { ...c, status: "active" as const } : c)) });
    } else {
      await ctx.db.patch(s._id, { status: "draft" });
    }
    if (s.approvalId) await ctx.db.patch(s.approvalId, { status: decision === "approve" ? "approved" : "rejected", decidedBy: user._id, decidedAt: now, decisionNote: note?.slice(0, 500) });
    // Outcome signal for the engine (spec §28): the owner's verdict, with any note scrubbed of business details.
    if (s.runId) {
      const business = await ctx.db.get(s.businessId);
      const snap = (s.expert as { snapshot?: { engine?: string; aiMode?: string } } | undefined)?.snapshot;
      await ctx.db.insert("engineQuality", {
        runId: s.runId,
        agentId: "owner_decision",
        mode: snap?.aiMode ?? "basic",
        data: JSON.stringify({ decision, engine: snap?.engine ?? "unknown", note: note?.trim() ? redactFeedback(note, [org.name, business?.name, business?.website]) : undefined }),
        createdAt: now,
      });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `plan.${decision}d`, subjectType: "strategy", subjectId: s._id, summary: `${decision === "approve" ? "Approved" : "Sent back"} growth plan v${s.version}.` });
    if (decision === "approve") {
      // Approving starts the work the plan describes: first drafts for each active channel, within credits.
      work = await startPlanWork(ctx, { org, strategyId: s._id, userId: user._id });
      // plan_targets (S6): the first target-heavy play starts finding named targets too.
      const targets = await autoStartPlanTargets(ctx, { org, strategyId: s._id, userId: user._id });
      if (targets.started) work.started.push(`Targets: ${targets.started}`);
      else if (targets.waiting) work.waiting.push({ title: "Targets for your plays", reason: targets.waiting });
      await afterPlanWork(ctx, org._id, s._id, user._id, work, 0);
    }
    return work;
  },
});

/** Approval and play launch must use the economics the plan actually analyzed. */
function hasNewerOwnerEconomics(
  strategy: Pick<Doc<"strategies">, "createdAt" | "expert">,
  owner: Doc<"businesses">["unitEconomics"],
): boolean {
  if (!owner) return false;
  const snapshot = strategy.expert?.snapshot as { ownerEconomics?: OwnerEconomics } | undefined;
  if (snapshot?.ownerEconomics) {
    const keys = ["revenuePerCustomerMonthUsd", "grossMargin", "monthlyChurn", "ownerHourUsd", "ownerHoursPerWeek", "newCustomersPerMonth", "ranges"] as const;
    return keys.some((key) => JSON.stringify(snapshot.ownerEconomics?.[key]) !== JSON.stringify(owner[key]));
  }
  return owner.updatedAt > strategy.createdAt;
}

/** Re-bind a plan's approval to the current policy version and a fresh expiry (the owner is deciding now, on this version). */
async function refreshPlanApproval(ctx: MutationCtx, s: Doc<"strategies">, userId: Id<"users">) {
  const a = s.approvalId ? await ctx.db.get(s.approvalId) : null;
  if (!a) return;
  // Bound to the plan's content (older plans: to its id and version). A changed plan needs a new review.
  const hash = a.contentHash.startsWith("plan:") ? await planContentHash(s) : legacyPlanHash(s);
  if (a.orgId !== s.orgId || a.subjectId !== s._id || a.contentHash !== hash) throw appError("INVALID", "This plan changed after it was sent for review. Refresh the plan.");
  const now = Date.now();
  const policyVersion = await activePolicyVersion(ctx, s.orgId);
  if (a.status === "pending" && a.expiresAt > now && a.policyVersion === policyVersion) return;
  const expiresAt = now + 14 * 86_400_000;
  const binding = { orgId: s.orgId, subjectType: "strategy", subjectId: s._id, actionKind: "approve_plan", contentHash: hash, scope: {}, policyVersion, expiresAt };
  await ctx.db.patch(a._id, { status: "pending", policyVersion, expiresAt, approvalHash: await approvalHash(binding), invalidatedReason: undefined });
  await audit(ctx, { orgId: s.orgId, actorType: "user", actorId: userId, action: "approval.refreshed", subjectType: "strategy", subjectId: s._id, summary: `Plan v${s.version} approval re-checked against the current approval rules.` });
}

/** Tell owners what's waiting, and try again later when only a busy team held work back. */
async function afterPlanWork(ctx: MutationCtx, orgId: Id<"organizations">, strategyId: Id<"strategies">, userId: Id<"users">, work: PlanWorkResult, attempt: number): Promise<void> {
  if (work.busy && attempt < 3) {
    await ctx.scheduler.runAfter(10 * 60_000, internal.workspace.resumePlanWork, { strategyId, userId, attempt: attempt + 1 });
  } else if (work.waiting.length) {
    const credits = work.waiting.some((w) => w.reason.startsWith("Not enough credits"));
    await notifyOwners(ctx, orgId, `Plan approved. ${work.waiting.length} channel${work.waiting.length === 1 ? "" : "s"} waiting${credits ? " for credits" : ""}: tap Do it on Today when ready.`, "today");
  }
}

/** Start plan work that waited for a busy team. */
export const resumePlanWork = internalMutation({
  args: { strategyId: v.id("strategies"), userId: v.id("users"), attempt: v.number() },
  handler: async (ctx, { strategyId, userId, attempt }): Promise<void> => {
    const s = await ctx.db.get(strategyId);
    const org = s ? await ctx.db.get(s.orgId) : null;
    if (!s || !org || s.status !== "approved" || org.emergencyStop?.active) return;
    const work = await startPlanWork(ctx, { org, strategyId, userId });
    await afterPlanWork(ctx, org._id, strategyId, userId, work, attempt);
  },
});

/** Turn a plan channel on or park it. On the approved plan, turning it on starts its work; parking holds it. */
export const setChannelStatus = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), key: v.string(), status: v.union(v.literal("active"), v.literal("parked")) },
  handler: async (ctx, { slug, strategyId, key, status }): Promise<PlanWorkResult | null> => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    if (!s.channels.some((c) => c.key === key)) throw appError("NOT_FOUND", "That channel isn't in this plan.");
    await ctx.db.patch(s._id, { channels: s.channels.map((c) => (c.key === key ? { ...c, status } : c)) });
    if (s.status !== "approved") return null;
    if (status === "parked") {
      await holdPlanChannel(ctx, s, key);
      return null;
    }
    const work = await startPlanWork(ctx, { org, strategyId: s._id, userId: user._id, onlyKeys: [key] });
    await afterPlanWork(ctx, org._id, s._id, user._id, work, 0);
    return work;
  },
});

export const runs = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(50);
    return rows.map((r) => ({ id: r._id, title: r.title, kind: r.kind, status: r.status, roles: r.roles, estimateMicros: r.estimateMicros, actualMicros: r.actualMicros, userMessage: r.userMessage ?? null, createdAt: r.createdAt, isFixture: r.isFixture }));
  },
});

/** What the COO needs to turn a wish into the right work: plan, autopilot, accounts, recent activity. */
export const wishContext = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const autopilot = await ctx.db
      .query("autopilotSettings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const recentRuns = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(8);
    const history = await ctx.db
      .query("chatMessages")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(6);
    return {
      autopilot: autopilot?.enabled ? `on (${autopilot.mode.replace("_", " ")}): ${autopilot.channels.map((c) => `${c.channel} ${c.postsPerWeek}/week`).join(", ")}` : "off",
      connected: connections.filter((c) => c.status === "connected").map((c) => c.provider),
      recentWork: recentRuns.map((r) => `${r.title} (${r.status})`),
      conversation: history
        .reverse()
        .map((m) => `${m.author === "user" ? "Owner" : "ClimbOS"}: ${m.text.slice(0, 300)}`)
        .join("\n"),
    };
  },
});

/** Internal jobs receive the saved profile only after the caller has tenant-checked it. */
export const customAgentForRun = internalQuery({
  args: { orgId: v.id("organizations"), agentId: v.id("customAgents") },
  handler: async (ctx, { orgId, agentId }) => {
    const agent = assertSameOrg(await ctx.db.get(agentId), orgId, "specialist");
    if (agent.status !== "active") return null;
    const archetype = AGENT_ARCHETYPE_BY_ID.get(agent.archetypeId);
    if (!archetype) return null;
    return {
      id: agent._id,
      archetypeId: agent.archetypeId,
      name: agent.name,
      objective: agent.objective,
      instructions: agent.instructions,
      allowedActions: agent.allowedActions,
      knowledge: agent.knowledge,
      permission: agent.permission,
      maxRunCredits: agent.maxRunCredits,
      maxActionsPerRun: agent.maxActionsPerRun,
      successMetric: agent.successMetric,
      role: archetype.role,
    };
  },
});

const ACTIVE_RUN = new Set(["cost_reserved", "preparing", "executing"]);

/** Live "team at work" feed for the top bar: what's running now and what just finished. */
export const activeWork = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(25);
    const now = Date.now();
    const active = runs.filter((r) => ACTIVE_RUN.has(r.status));
    const views = await Promise.all(
      active.slice(0, 8).map(async (r) => {
        const steps = await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", r._id))
          .take(40);
        const current = [...steps].reverse().find((s) => s.status === "running");
        return { id: r._id, title: r.title, roles: r.roles, kind: r.kind, startedAt: r.createdAt, step: current?.label ?? "Getting started", done: steps.filter((s) => s.status === "succeeded").length };
      }),
    );
    const justFinished = runs
      .filter((r) => r.status === "verified" && r.updatedAt > now - 15 * 60_000)
      .slice(0, 5)
      .map((r) => ({ id: r._id, title: r.title, kind: r.kind, finishedAt: r.updatedAt }));
    return { active: views, justFinished };
  },
});

/** Everything one job produced, for the work receipt page that wish results link to. */
export const runDetail = query({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "job");
    const steps = await ctx.db
      .query("workflowSteps")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(60);
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(20);
    let input: Record<string, unknown> = {};
    let output: unknown = null;
    try {
      input = JSON.parse(run.input) as Record<string, unknown>;
    } catch {
      // Older runs stored plain text.
    }
    try {
      output = run.output ? JSON.parse(run.output) : null;
    } catch {
      output = run.output ?? null;
    }
    return {
      id: run._id,
      title: run.title,
      kind: run.kind,
      status: run.status,
      roles: run.roles,
      brief: typeof input.brief === "string" ? input.brief : null,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      estimateMicros: run.estimateMicros,
      actualMicros: run.actualMicros,
      userMessage: run.userMessage ?? null,
      isFixture: run.isFixture,
      engine: run.engine ?? null,
      output,
      steps: steps.map((s) => ({ label: s.label, status: s.status, role: s.role ?? null, kind: s.kind })),
      artifacts: artifacts.map((a) => ({ id: a._id, title: a.title, channel: a.channel, status: a.status, kind: a.kind })),
    };
  },
});

/**
 * Retry a stopped job from where it stopped: finished steps are reused, only
 * the unfinished ones run again (and only those are charged).
 */
export const retryRun = mutation({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "job");
    await reopenFailedRun(ctx, run, org);
    // Undo what the failure marked on related work.
    const args = (() => {
      try {
        return JSON.parse(run.resumeWith?.args ?? "{}") as { campaignId?: Id<"outboundCampaigns">; cardId?: Id<"actionCards"> };
      } catch {
        return {};
      }
    })();
    const now = Date.now();
    if (args.campaignId) {
      const c = await ctx.db.get(args.campaignId);
      if (c && c.orgId === org._id && c.status === "failed") await ctx.db.patch(c._id, { status: "researching", updatedAt: now });
    }
    if (args.cardId) {
      const card = await ctx.db.get(args.cardId);
      if (card && card.orgId === org._id && card.status === "failed") await ctx.db.patch(card._id, { status: "running", updatedAt: now });
    }
    const slots = await ctx.db.query("calendarSlots").withIndex("by_draft_run", (q) => q.eq("draftRunId", runId)).take(50);
    for (const sl of slots) if (sl.status === "failed") await ctx.db.patch(sl._id, { status: "drafting", updatedAt: now });
    return { ok: true };
  },
});

/** The Basic/Expert picker: default mode, whether Expert is unlocked, and what each mode costs at most for the key jobs. */
export const aiMode = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const view = await aiModeView(ctx, org);
    const fixture = org.kind === "demo";
    const estimates = (kind: "onboarding_research" | "strategy" | "content_ads" | "social_calendar") => ({
      basic: estimateJobMicros(planJob(kind, {}, { fixture, mode: "basic" })),
      expert: estimateJobMicros(planJob(kind, {}, { fixture, mode: "expert" })),
    });
    return {
      ...view,
      saved: org.aiMode ?? null,
      canEdit: can(role, "manage_policies"),
      estimates: { onboarding_research: estimates("onboarding_research"), strategy: estimates("strategy"), content_ads: estimates("content_ads"), social_calendar: estimates("social_calendar") },
    };
  },
});

/** Save the workspace's default Climb AI mode (Expert needs a paid plan). */
export const setAiMode = mutation({
  args: { slug: v.string(), mode: v.union(v.literal("basic"), v.literal("expert")) },
  handler: async (ctx, { slug, mode }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_policies");
    if (mode === "expert" && !(await aiModeView(ctx, org)).expertUnlocked) throw appError("PAYMENT_REQUIRED", "Climb AI Expert comes with a paid plan.");
    await ctx.db.patch(org._id, { aiMode: mode });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "settings.ai_mode", subjectType: "organization", subjectId: org._id, summary: `Default Climb AI mode set to ${mode === "expert" ? "Expert" : "Basic"}.` });
  },
});

/** Sidebar credit meter: the account's credits left this month and in top-ups (never dollars). */
export const credits = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const period = await currentPeriod(ctx, org);
    const [balance, paid] = await Promise.all([creditBalance(ctx, org, period), isPaid(ctx, org)]);
    return { ...balance, paid, isDemo: org.kind === "demo" };
  },
});
