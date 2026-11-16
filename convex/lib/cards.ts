import { namedSocialChannels } from "../../shared/growth/socialChannels";
import { internal } from "../_generated/api";
import { resolveAiMode } from "./aiMode";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertNoActiveRun, createRunWithReservation } from "../engine";
import { audit } from "./audit";
import { planJob, type JobKind, maxJobMicros } from "./jobPlans";
import { appError } from "./tenancy";
import { startCampaign } from "../outbound";
import { canDriveWork } from "../../shared/agents/quality";
import { PreparedWorkSchema } from "../../shared/agents/preparedWork";

/** A plan channel → the job that drafts its first work once the plan is approved. */
export const CHANNEL_JOBS: Record<string, JobKind> = {
  seo_content: "content_seo",
  social_organic: "content_social",
  search_ads: "content_ads",
  meta_ads: "content_ads",
  email_lifecycle: "content_email",
  sales_outreach: "sales_sequence",
  conversion_optimization: "conversion_audit",
  retention: "retention_plan",
};

const PLAN_CARD: Partial<Record<JobKind, { what: string; channel?: string; quantity?: number }>> = {
  content_social: { what: "first 3 posts", quantity: 3 },
  content_seo: { what: "first page draft", channel: "blog" },
  content_ads: { what: "first ad drafts" },
  content_email: { what: "first email sequence", channel: "email" },
  sales_sequence: { what: "outreach sequence" },
  retention_plan: { what: "retention plan" },
  conversion_audit: { what: "website & social review" },
};

export type PlanWorkResult = { started: string[]; waiting: { title: string; reason: string }[]; covered: string[]; busy: boolean };

/** Reuse only completed, readable starter drafts bound to this exact plan. */
async function firstWinWork(ctx: MutationCtx, org: Doc<"organizations">, strategy: Doc<"strategies">): Promise<Map<string, "covered" | "working" | "uncertain" | "paused">> {
  const grouped = new Map<string, ("covered" | "missing" | "working" | "uncertain" | "paused")[]>();
  if (strategy.version !== 1 || (org.firstWinRunIds?.length ?? 0) > 8) return new Map();
  for (const id of org.firstWinRunIds ?? []) {
    const run = await ctx.db.get(id);
    if (!run || run.orgId !== org._id || !["content_social", "content_email"].includes(run.kind)) continue;
    let input: { firstWin?: boolean; strategyId?: string; channel?: string; quantity?: number };
    try { input = JSON.parse(run.input); } catch { continue; }
    if (!input || input.firstWin !== true || input.strategyId !== strategy._id) continue;
    let state: "covered" | "missing" | "working" | "uncertain" | "paused" = "missing";
    if (run.status === "uncertain") state = "uncertain";
    else if (run.status === "paused") state = "paused";
    else if (!["verified", "failed", "canceled"].includes(run.status)) state = "working";
    else if (run.status === "verified") {
      const artifacts = await ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", run._id)).take(7);
      let usable = 0;
      for (const artifact of artifacts) {
        if (artifact.orgId !== org._id || artifact.businessId !== strategy.businessId || !artifact.currentVersionId || !["draft", "in_review", "approved", "scheduled", "published", "exported"].includes(artifact.status)) continue;
        if (input.channel && artifact.channel !== input.channel) continue;
        if (run.kind === "content_social" ? artifact.kind !== "social_post" : !["email", "email_sequence"].includes(artifact.kind)) continue;
        const version = await ctx.db.get(artifact.currentVersionId);
        if (version?.orgId === org._id && version.artifactId === artifact._id && version.version === artifact.currentVersion && version.body.trim()) usable++;
      }
      const expected = run.kind === "content_email" ? 1 : input.quantity;
      if (expected !== undefined && Number.isInteger(expected) && expected >= 1 && expected <= 6 && usable >= expected) state = "covered";
    }
    grouped.set(run.kind, [...(grouped.get(run.kind) ?? []), state]);
  }
  const result = new Map<string, "covered" | "working" | "uncertain" | "paused">();
  for (const [kind, states] of grouped) {
    if (states.includes("uncertain")) result.set(kind, "uncertain");
    else if (states.includes("paused")) result.set(kind, "paused");
    else if (states.includes("working")) result.set(kind, "working");
    else if (states.every(state => state === "covered")) result.set(kind, "covered");
  }
  return result;
}

/**
 * Approving a plan starts its work: each active channel gets one card that
 * runs its first drafts (drafts only, reserved like any job). Channels that
 * can't start now (credits, a busy team) keep a card to start later.
 */
export async function startPlanWork(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; strategyId: Id<"strategies">; userId: Id<"users">; onlyKeys?: string[] },
): Promise<PlanWorkResult> {
  const out: PlanWorkResult = { started: [], waiting: [], covered: [], busy: false };
  const s = await ctx.db.get(p.strategyId);
  if (!s || s.orgId !== p.org._id || s.status !== "approved") return out;
  // A focused plan already contains the actual starter drafts. Reusing those
  // drafts is deterministic and must not start another set of paid AI jobs.
  if (s.expert?.focusedMove) {
    if (!canDriveWork(s.expert.quality)) throw appError("INVALID", "This plan needs AI fixes before its work can start.");
    const prepared = PreparedWorkSchema.array().min(1).max(3).safeParse(s.expert.preparedWork);
    if (!prepared.success) throw appError("INVALID", "This plan is missing its prepared drafts. Update it before starting work.");
    out.covered = prepared.data.map((work) => work.title);
    return out;
  }
  const now = Date.now();
  const channels = s.channels.map((c) => ({ ...c }));
  const firstWin = await firstWinWork(ctx, p.org, s);
  for (const c of [...channels].sort((a, b) => a.priority - b.priority)) {
    if (c.status !== "active" || (p.onlyKeys && !p.onlyKeys.includes(c.key))) continue;
    const job = CHANNEL_JOBS[c.key];
    const shape = job ? PLAN_CARD[job] : undefined;
    if (!job || !shape) continue;
    const starterState = firstWin.get(job);
    if (starterState) {
      if (starterState === "covered") out.covered.push(c.name);
      else {
        out.waiting.push({ title: c.name, reason: starterState === "working" ? "Your starter drafts are still in progress; no duplicate job was started." : starterState === "paused" ? "Starter drafting is paused. Review its status in AI activity before restarting." : "The starter draft outcome is unknown. Review it in AI activity before starting another job." });
        if (starterState === "working") out.busy = true;
      }
      continue;
    }
    const destinations = job === "content_social" ? namedSocialChannels(c) : [];
    if (job === "content_social" && !destinations.length) {
      out.waiting.push({ title: c.name, reason: "This plan does not clearly select a social platform. Name the platform when requesting these drafts; no extra destinations were chosen." });
      continue;
    }
    let card = c.cardId ? await ctx.db.get(c.cardId) : null;
    if (card && ["running", "done", "failed"].includes(card.status)) continue;
    const title = `${c.name}: ${shape.what}`;
    if (!card) {
      const channel = (destinations.length === 1 ? destinations[0] : shape.channel) ?? (c.key === "meta_ads" ? "meta_ad" : c.key === "search_ads" ? "google_search_ad" : undefined);
      const plan = planJob(job, { quantity: shape.quantity, images: job === "content_social" ? 1 : 0, channel, ...(destinations.length ? { channels: destinations } : {}) }, { fixture: p.org.kind === "demo" });
      const brief = `From your approved growth plan (v${s.version}), channel "${c.name}": ${[c.why, ...c.deliverables.slice(0, 3)].join(" ")}`.slice(0, 1500);
      const cardId = await ctx.db.insert("actionCards", {
        orgId: p.org._id,
        title: title.slice(0, 120),
        description: c.why.slice(0, 400),
        proposedEffect: job.startsWith("content_") ? "Creates drafts only. Nothing is published." : "Prepares a plan for you to review. Nothing is sent.",
        kind: "generate_content",
        roles: plan.roles,
        payload: JSON.stringify({ job, channel, ...(destinations.length ? { channels: destinations } : {}), quantity: shape.quantity, brief, strategyId: s._id, planChannel: c.key }),
        costEstimateMicros: maxJobMicros(plan, { fixture: p.org.kind === "demo" }),
        externalEffect: false,
        status: "proposed",
        priority: c.priority,
        createdAt: now,
        updatedAt: now,
      });
      c.cardId = cardId; // same object as in `channels`
      card = await ctx.db.get(cardId);
    } else if (card.status === "blocked" || card.status === "rejected") {
      await ctx.db.patch(card._id, { status: "proposed", blockedReason: undefined, updatedAt: now });
      card = await ctx.db.get(card._id);
    }
    if (!card || card.status !== "proposed") continue;
    try {
      await startCardRun(ctx, { org: p.org, card, userId: p.userId, auto: true });
      out.started.push(title);
    } catch (e) {
      const data = (e as { data?: { code?: string; message?: string } }).data;
      const credits = data?.code === "LIMIT_REACHED" || data?.code === "PAYMENT_REQUIRED";
      if (data?.code === "RATE_LIMITED") out.busy = true;
      const reason = credits ? "Not enough credits right now" : data?.code === "RATE_LIMITED" ? "Your team is busy; it starts when a job finishes" : (data?.message ?? "Couldn't start");
      await ctx.db.patch(card._id, { blockedReason: reason, updatedAt: now });
      out.waiting.push({ title, reason });
    }
  }
  if (channels.some((c, i) => c.cardId !== s.channels[i]?.cardId)) await ctx.db.patch(s._id, { channels });
  return out;
}

/** Parking a channel holds its waiting card; nothing new starts for it. */
export async function holdPlanChannel(ctx: MutationCtx, strategy: Doc<"strategies">, key: string) {
  const c = strategy.channels.find((x) => x.key === key);
  const card = c?.cardId ? await ctx.db.get(c.cardId) : null;
  if (card && card.status === "proposed") await ctx.db.patch(card._id, { status: "blocked", blockedReason: `${c!.name} is parked in your plan.`, updatedAt: Date.now() });
}

/** Which job an action card kind runs. */
export function jobForAction(kind: string, channel: string): JobKind | null {
  if (kind === "refresh_plan") return "strategy";
  if (kind === "research") return "conversion_audit";
  if (kind === "analyze_results") return "explain_results";
  if (kind === "find_customers") return "outbound";
  if (kind !== "generate_content") return null;
  if (channel === "email") return "content_email";
  if (channel === "google_search_ad" || channel === "meta_ad" || channel === "ads") return "content_ads";
  if (channel === "blog" || channel === "website" || channel === "seo") return "content_seo";
  return "content_social";
}

/** Kinds a wish may start on its own: they only prepare drafts, plans or analysis. */
export const AUTO_RUN_KINDS = new Set(["generate_content", "refresh_plan", "research", "analyze_results", "find_customers"]);
/**
 * Most a single wish may reserve without a second tap (µUSD of the plan's AI
 * allowance, worst case; real runs cost far less and the rest is released).
 * Sized so one headline job (a plan refresh, or finding customers) starts at once.
 */
export const WISH_AUTO_BUDGET_MICROS = 5_000_000;

export type CardPayload = { job?: string; channel?: string; channels?: string[]; quantity?: number; brief?: string; strategyId?: string; planChannel?: string; customAgentId?: string; customAgentParentRunId?: string; agentArchetypeId?: string };

/** Keep dependent work gated even when a card is started outside the chat UI. */
export async function assertCardDependenciesComplete(ctx: MutationCtx, card: Doc<"actionCards">, orgId: Id<"organizations">) {
  for (const dependencyId of card.dependsOnActionCardIds ?? []) {
    const dependency = await ctx.db.get(dependencyId);
    if (!dependency || dependency.orgId !== orgId) throw appError("INVALID", "A prerequisite for this action is unavailable.");
    if (dependency.status !== "done") throw appError("INVALID", `Complete “${dependency.title}” first.`);
  }
}

/**
 * Start exactly the job an action card describes, with the owner's brief.
 * Throws the same app errors as createRunWithReservation (limits, pause).
 */
export async function startCardRun(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; card: Doc<"actionCards">; userId: Id<"users">; auto: boolean },
): Promise<Id<"workflowRuns"> | null> {
  const { org, card } = p;
  await assertCardDependenciesComplete(ctx, card, org._id);
  const payload = JSON.parse(card.payload) as CardPayload;
  // Plan cards name their job; wish cards derive it from the kind and channel.
  const job = ((payload.planChannel && payload.job) || jobForAction(card.kind, payload.channel ?? "") || payload.job) as JobKind | undefined;
  if (!job) return null;
  // Plan work follows the approved plan: a parked channel or an older plan starts nothing.
  if (payload.strategyId && payload.planChannel) {
    const s = await ctx.db.get(payload.strategyId as Id<"strategies">);
    const ch = s?.channels.find((c) => c.key === payload.planChannel);
    if (!s || s.orgId !== org._id || s.status !== "approved") throw appError("INVALID", "This came from a plan that's no longer approved.");
    if (!ch || ch.status === "parked") throw appError("INVALID", `${ch?.name ?? "This channel"} is parked in your plan. Turn it on first.`);
    if (job === "content_social") {
      const destinations = namedSocialChannels(ch);
      if (!destinations.length) throw appError("INVALID", "Choose the social platform for this plan's drafts before starting them.");
      payload.channels = destinations;
      payload.channel = destinations.length === 1 ? destinations[0] : undefined;
    }
    if (job === "content_ads") {
      if (!["search_ads", "meta_ads"].includes(ch.key)) throw appError("INVALID", "This plan channel does not select a supported ad platform.");
      payload.channel = ch.key === "search_ads" ? "google_search_ad" : "meta_ad";
    }
  }
  if (job === "strategy") await assertNoActiveRun(ctx, org._id, "strategy", "Your plan is already being refreshed.");
  if (job === "outbound") {
    // Outbound owns its campaign record; the card follows its run.
    const brief = { who: (payload.brief ?? "").slice(0, 300), where: "", count: Math.max(5, Math.min(Math.round(payload.quantity || 15), 30)) };
    await startCampaign(ctx, { org, userId: p.userId, brief, auto: p.auto, cardId: card._id, customAgentId: payload.customAgentId as Id<"customAgents"> | undefined, customAgentParentRunId: payload.customAgentParentRunId as Id<"workflowRuns"> | undefined, agentArchetypeId: payload.agentArchetypeId });
    const fresh = await ctx.db.get(card._id);
    return fresh?.runId ?? null;
  }
  const images = job === "content_social" ? 1 : 0;
  const aiMode = await resolveAiMode(ctx, org, job);
  const runInput = job === "strategy" ? { ...payload, planStyle: "focused" as const } : payload;
  const plan = planJob(job, { quantity: payload.quantity, images, channel: payload.channel, channels: payload.channels, ...(job === "strategy" ? { planStyle: "focused" } : {}) }, { fixture: org.kind === "demo", mode: aiMode });
  const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: card.title || plan.title, roles: plan.roles, input: runInput, steps: plan.steps, meters: plan.meters, createdBy: p.userId, isFixture: org.kind === "demo", aiMode, customAgentId: payload.customAgentId as Id<"customAgents"> | undefined, customAgentParentRunId: payload.customAgentParentRunId as Id<"workflowRuns"> | undefined, agentArchetypeId: payload.agentArchetypeId });
  await ctx.db.patch(card._id, { status: "running", runId, updatedAt: Date.now() });
  const brief = payload.brief?.slice(0, 1500) || undefined;
  if (job === "content_social" || job === "content_ads" || job === "content_email" || job === "content_seo") {
    await ctx.scheduler.runAfter(0, internal.jobs.createContent, { runId, job, channel: payload.channel || undefined, channels: payload.channels, quantity: payload.quantity, images, brief, cardId: card._id });
  } else if (job === "strategy") {
    await ctx.scheduler.runAfter(0, internal.jobs.buildStrategy, { runId });
  } else if (job === "conversion_audit") {
    await ctx.scheduler.runAfter(0, internal.jobs.conversionAudit, { runId, cardId: card._id });
  } else if (job === "explain_results") {
    await ctx.scheduler.runAfter(0, internal.workspace.startExplain, { runId, cardId: card._id });
  } else if (job === "retention_plan" || job === "sales_sequence") {
    await ctx.scheduler.runAfter(0, internal.jobs.simplePlanJob, { runId, task: job, cardId: card._id });
  }
  await audit(ctx, {
    orgId: org._id,
    actorType: p.auto ? "agent" : "user",
    actorId: p.auto ? undefined : p.userId,
    action: p.auto ? "card.auto_started" : "card.approved",
    subjectType: "actionCard",
    subjectId: card._id,
    summary: `${p.auto ? "Started from your wish" : "Started"}: ${card.title}`,
  });
  return runId;
}
