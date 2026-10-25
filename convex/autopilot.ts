import { v } from "convex/values";
import { expertUnlocked, resolveAiMode } from "./lib/aiMode";
import { featureAllowed, requirePaid } from "./lib/access";
import {
  AUTOPILOT_CHANNELS,
  DEFAULT_HOURS,
  DIRECT_PUBLISH_CHANNELS,
  clampCadence,
  localDate,
  nextWeekOf,
  slotTime,
  thisWeekOf,
  TRUST_THRESHOLD,
  tzOffsetMinutes,
} from "../shared/autopilot";
import type { SocialCalendar } from "../shared/agents/specs";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { autonomyMode, invalidateApprovals } from "./lib/approvals";
import { audit } from "./lib/audit";
import { applyTrustEvent, autopilotLive, onPublishOutcome, routeSlotDraft, settingsFor, trustFor } from "./lib/autopilot";
import { planJob } from "./lib/jobPlans";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Social autopilot: plans next week's posts, drafts them through the normal
 * content agents, then either schedules them under an autopilot approval or
 * asks the owner, depending on the mode and safety gates (shared/autopilot).
 */

const MAX_PER_CHANNEL = 6; // one drafting run per channel per week
const MAX_PER_WEEK = 21;
const DAY = 86_400_000;

const modeValidator = v.union(v.literal("always_ask"), v.literal("trust_ladder"), v.literal("auto"));

/* ---------------- Owner-facing API ---------------- */

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const settings = await ctx.db
      .query("autopilotSettings")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const now = Date.now();
    const weeks = [thisWeekOf(now, org.timezone), nextWeekOf(now, org.timezone)];
    const slotsByWeek = await Promise.all(
      weeks.map(async (weekOf) => {
        const slots = await ctx.db
          .query("calendarSlots")
          .withIndex("by_org_week", (q) => q.eq("orgId", org._id).eq("weekOf", weekOf))
          .collect();
        const plan = await ctx.db
          .query("weekPlans")
          .withIndex("by_org_week", (q) => q.eq("orgId", org._id).eq("weekOf", weekOf))
          .order("desc")
          .first();
        const views = await Promise.all(
          slots
            .filter((s) => s.status !== "skipped")
            .sort((a, b) => a.slotAt - b.slotAt)
            .map(async (s) => {
              const a = s.artifactId ? await ctx.db.get(s.artifactId) : null;
              const ver = a?.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
              return {
                id: s._id,
                channel: s.channel,
                slotAt: s.slotAt,
                pillar: s.pillar,
                purpose: s.purpose,
                format: s.format,
                idea: s.idea,
                approvedOfferPlayName: s.approvedOfferPlayName ?? null,
                hookDraft: s.hookDraft,
                status: s.status,
                needsOwner: s.needsOwner,
                ownerNote: s.ownerNote ?? null,
                routing: s.routing ?? null,
                artifact: a ? { id: a._id, title: a.title, status: a.status, preview: ver?.body.slice(0, 220) ?? "", hasImage: Boolean(ver?.imageStorageId || ver?.imageR2Key) } : null,
              };
            }),
        );
        return { weekOf, plan: plan ? { theme: plan.weekTheme, pillars: plan.pillars, learnings: plan.learningsApplied } : null, slots: views };
      }),
    );
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id))
      .collect();
    const connected = new Set(connections.filter((c) => c.status === "connected").map((c) => (c.provider === "facebook_pages" ? "facebook" : c.provider)));
    const recentRuns = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(20);
    const activeRuns = recentRuns
      .filter((r) => ["social_calendar", "content_social"].includes(r.kind) && ["cost_reserved", "preparing", "executing"].includes(r.status))
      .map((r) => ({ id: r._id, title: r.title }));
    return {
      activeRuns,
      timezone: org.timezone,
      canManage: ["owner", "admin"].includes(role),
      /** Skip, redraft and report on slots (approver roles). */
      canApprove: ["owner", "admin", "reviewer"].includes(role),
      /** Channels ClimbOS posts to directly (others go out from the export pack). */
      directChannels: [...DIRECT_PUBLISH_CHANNELS],
      settings: settings
        ? {
            enabled: settings.enabled,
            mode: settings.mode,
            channels: settings.channels,
            postingHours: settings.postingHours,
            alwaysAskTopics: settings.alwaysAskTopics,
            imagesPerWeek: settings.imagesPerWeek,
            aiMode: settings.aiMode ?? null,
            pausedReason: settings.pausedReason ?? null,
            lastPlannedWeek: settings.lastPlannedWeek ?? null,
          }
        : null,
      trust: AUTOPILOT_CHANNELS.map((c) => ({ ...trustFor(settings, c), threshold: TRUST_THRESHOLD })),
      connected: [...connected],
      weeks: slotsByWeek,
      defaults: DEFAULT_HOURS,
    };
  },
});

export const save = mutation({
  args: {
    slug: v.string(),
    enabled: v.boolean(),
    mode: modeValidator,
    channels: v.array(v.object({ channel: v.string(), postsPerWeek: v.number() })),
    postingHours: v.array(v.number()),
    alwaysAskTopics: v.array(v.string()),
    imagesPerWeek: v.number(),
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    if (args.aiMode === "expert" && !(await expertUnlocked(ctx, org))) throw appError("PAYMENT_REQUIRED", "Climb AI Expert comes with a paid plan.");
    if (args.enabled) await requirePaid(ctx, org, "autopilot");
    if (args.enabled && args.mode !== "always_ask" && (await autonomyMode(ctx, org._id)) !== "bounded_autopilot") throw appError("INVALID", "Posting without asking needs Bounded Autopilot. Choose it in Settings → Policies, or keep “Always ask”.");
    const channels = args.channels
      .filter((c) => (AUTOPILOT_CHANNELS as readonly string[]).includes(c.channel))
      .map((c) => ({ channel: c.channel, postsPerWeek: Math.min(MAX_PER_CHANNEL, clampCadence(c.postsPerWeek)) }))
      .filter((c) => c.postsPerWeek > 0);
    if (args.enabled && channels.length === 0) throw appError("INVALID", "Pick at least one channel and how often to post.");
    if (channels.reduce((s, c) => s + c.postsPerWeek, 0) > MAX_PER_WEEK) throw appError("INVALID", `Keep it to ${MAX_PER_WEEK} posts a week or fewer.`);
    const patch = {
      enabled: args.enabled,
      mode: args.mode,
      channels,
      postingHours: [...new Set(args.postingHours.map((h) => Math.round(h)).filter((h) => h >= 0 && h <= 23))].sort((a, b) => a - b).slice(0, 4),
      alwaysAskTopics: args.alwaysAskTopics.map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 20),
      imagesPerWeek: Math.max(0, Math.min(2, Math.round(args.imagesPerWeek))),
      ...(args.aiMode ? { aiMode: args.aiMode } : {}),
      updatedBy: user._id,
      updatedAt: Date.now(),
      pausedReason: undefined,
    };
    const existing = await settingsFor(ctx, org._id);
    let wasEnabled = false;
    let settingsId: Id<"autopilotSettings">;
    if (existing) {
      wasEnabled = existing.enabled;
      await ctx.db.patch(existing._id, patch);
      settingsId = existing._id;
    } else {
      settingsId = await ctx.db.insert("autopilotSettings", { orgId: org._id, ...patch, trust: [], createdAt: Date.now() });
    }
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "autopilot.settings",
      subjectType: "autopilot",
      subjectId: settingsId,
      summary: args.enabled ? `Autopilot on (${args.mode.replace("_", " ")}): ${channels.map((c) => `${c.channel} ×${c.postsPerWeek}`).join(", ")}.` : "Autopilot off. Scheduled posts stay scheduled.",
    });
    // First switch-on: plan the rest of this week right away (or next week from Thursday on).
    if (args.enabled && !wasEnabled) await startPlanning(ctx, org, await ctx.db.get(settingsId), user._id);
    return settingsId;
  },
});

/** Free accounts: plan one week once to see what autopilot would do (ideas only: nothing is drafted or posted). */
export const previewWeek = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const settings = await settingsFor(ctx, org._id);
    if (!settings || settings.channels.length === 0) throw appError("INVALID", "Pick your channels and how often to post first.");
    if (settings.lastPlannedWeek && !(await featureAllowed(ctx, org, "autopilot"))) throw appError("PAYMENT_REQUIRED", "Your free preview week is used. Choose a package for weekly autopilot.");
    return startPlanning(ctx, org, settings, user._id, { force: true, preview: true });
  },
});

export const planNow = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const settings = await settingsFor(ctx, org._id);
    if (!settings?.enabled) throw appError("INVALID", "Turn on autopilot first.");
    return startPlanning(ctx, org, settings, user._id, { force: true });
  },
});

export const skipSlot = mutation({
  args: { slug: v.string(), slotId: v.id("calendarSlots") },
  handler: async (ctx, { slug, slotId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const slot = assertSameOrg(await ctx.db.get(slotId), org._id, "slot");
    if (slot.status === "published") throw appError("INVALID", "This one has already been posted.");
    const a = slot.artifactId ? await ctx.db.get(slot.artifactId) : null;
    if (a && ["publishing", "uncertain"].includes(a.status)) throw appError("INVALID", "It's being posted right now. Open the post to see what happened.");
    await ctx.db.patch(slot._id, { status: "skipped", updatedAt: Date.now() });
    if (a) {
      // Skipped means it won't go out: the approval goes too (it'd need a fresh one to post later).
      await invalidateApprovals(ctx, a._id, "Skipped on the autopilot calendar");
      // Unscheduling flips status, which makes any pending publish timer stale.
      if (a.status === "scheduled" || a.status === "approved") await ctx.db.patch(a._id, { status: "in_review", scheduledFor: undefined, updatedAt: Date.now() });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "autopilot.skipped", subjectType: "slot", subjectId: slot._id, summary: `Skipped the ${slot.channel} post planned for ${new Date(slot.slotAt).toISOString()}.` });
  },
});

/** A slot whose drafting didn't finish: draft it again (the week's other planned slots go with it). */
export const redraftSlot = mutation({
  args: { slug: v.string(), slotId: v.id("calendarSlots") },
  handler: async (ctx, { slug, slotId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const slot = assertSameOrg(await ctx.db.get(slotId), org._id, "slot");
    if (slot.status !== "failed" || slot.artifactId) throw appError("INVALID", "Only posts that didn't finish drafting can be drafted again.");
    const settings = await settingsFor(ctx, org._id);
    if (!(await autopilotLive(ctx, org, settings))) throw appError("INVALID", "Turn on autopilot first.");
    if (slot.slotAt < Date.now() + 30 * 60_000) throw appError("INVALID", "Its planned time has passed. Skip it, or write a post from Content.");
    await ctx.db.patch(slot._id, { status: "planned", draftRunId: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.autopilot.startDrafts, { orgId: org._id, weekOf: slot.weekOf, createdBy: user._id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "autopilot.redraft", subjectType: "slot", subjectId: slot._id, summary: `Drafting the ${slot.channel} post again.` });
  },
});

/** The owner flags a problem with an automatic post: the channel goes back to asking first. */
export const reportProblem = mutation({
  args: { slug: v.string(), slotId: v.id("calendarSlots"), note: v.optional(v.string()) },
  handler: async (ctx, { slug, slotId, note }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const slot = assertSameOrg(await ctx.db.get(slotId), org._id, "slot");
    const settings = await settingsFor(ctx, org._id);
    if (settings) await applyTrustEvent(ctx, settings, slot.channel, "auto_problem");
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "autopilot.problem", subjectType: "slot", subjectId: slot._id, summary: `Problem reported on an automatic ${slot.channel} post${note ? `: ${note.slice(0, 200)}` : "."} It will ask first from now on.` });
  },
});

/* ---------------- Planning ---------------- */

/**
 * Posts still to plan per channel for a week: the cadence (pro-rated when
 * planning mid-week) minus slots already drafted, scheduled or posted, so
 * planning again never doubles the week.
 */
async function remainingCadence(ctx: QueryCtx, orgId: Id<"organizations">, settings: Doc<"autopilotSettings">, weekOf: string, fromDay: number) {
  const existing = await ctx.db
    .query("calendarSlots")
    .withIndex("by_org_week", (q) => q.eq("orgId", orgId).eq("weekOf", weekOf))
    .collect();
  const taken = new Map<string, number>();
  for (const s of existing) if (s.status !== "planned" && s.status !== "skipped") taken.set(s.channel, (taken.get(s.channel) ?? 0) + 1);
  const daysLeft = 8 - fromDay;
  const cadence: Record<string, number> = {};
  for (const c of settings.channels) {
    const prorated = fromDay === 1 ? c.postsPerWeek : Math.ceil((c.postsPerWeek * daysLeft) / 7);
    const n = Math.min(MAX_PER_CHANNEL, prorated, c.postsPerWeek - (taken.get(c.channel) ?? 0));
    if (n > 0) cadence[c.channel] = n;
  }
  return cadence;
}

function runInput(run: Doc<"workflowRuns">): Record<string, unknown> {
  try {
    return JSON.parse(run.input) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function socialParked(ctx: MutationCtx, orgId: Id<"organizations">): Promise<boolean> {
  const plans = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(10);
  const approved = plans.find((p) => p.status === "approved");
  return Boolean(approved?.channels.some((c) => c.key === "social_organic" && c.status === "parked"));
}

async function startPlanning(
  ctx: MutationCtx,
  org: Doc<"organizations">,
  settings: Doc<"autopilotSettings"> | null,
  createdBy: Id<"users">,
  opts: { force?: boolean; weekOf?: string; preview?: boolean } = {},
) {
  if (!settings || (!settings.enabled && !opts.preview)) return null;
  // A parked social channel in the approved plan means no new social posts.
  if (!opts.preview && (await socialParked(ctx, org._id))) {
    if (!settings.pausedReason) await ctx.db.patch(settings._id, { pausedReason: "Social posting is parked in your growth plan. Turn it on in Plan to keep planning.", updatedAt: Date.now() });
    return null;
  }
  if (settings.pausedReason?.startsWith("Social posting is parked")) await ctx.db.patch(settings._id, { pausedReason: undefined, updatedAt: Date.now() });
  const now = Date.now();
  const today = localDate(now, org.timezone);
  // Monday–Wednesday: plan the rest of this week; later: plan next week.
  const thisWeek = thisWeekOf(now, org.timezone);
  const useThisWeek = !opts.weekOf && today.weekday <= 3;
  const weekOf = opts.weekOf ?? (useThisWeek ? thisWeek : nextWeekOf(now, org.timezone));
  const fromDay = weekOf === thisWeek ? Math.min(7, today.weekday + 1) : 1;
  if (!opts.force && settings.lastPlannedWeek === weekOf) return null;
  if (Object.keys(await remainingCadence(ctx, org._id, settings, weekOf, fromDay)).length === 0) {
    if (opts.force) throw appError("INVALID", "This week is already planned. Skip a post to make room, or wait for next week's plan.");
    await ctx.db.patch(settings._id, { lastPlannedWeek: weekOf, updatedAt: now });
    return null;
  }
  // Autopilot runs unattended: its saved mode (Expert only while paid), else the workspace default.
  const saved = settings.aiMode === "expert" && !(await expertUnlocked(ctx, org)) ? "basic" : settings.aiMode;
  const aiMode = await resolveAiMode(ctx, org, "social_calendar", saved);
  const plan = planJob("social_calendar", {}, { fixture: org.kind === "demo", mode: aiMode });
  let runId: Id<"workflowRuns">;
  try {
    runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { weekOf, fromDay, ...(opts.preview ? { preview: true } : {}) },
      steps: plan.steps,
      meters: plan.meters,
      createdBy,
      isFixture: org.kind === "demo",
      aiMode,
    });
  } catch (e) {
    const message = (e as { data?: { message?: string } }).data?.message ?? "Autopilot couldn't start planning.";
    await ctx.db.patch(settings._id, { pausedReason: message, updatedAt: now });
    return null;
  }
  await ctx.db.patch(settings._id, { lastPlannedWeek: weekOf, lastPlanRunId: runId, pausedReason: undefined, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.jobs.planSocialWeek, { runId, weekOf, fromDay });
  return runId;
}

/** Hourly: plan next week for every enabled workspace once it's Thursday 9:00 or later locally. */
export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const enabled = await ctx.db
      .query("autopilotSettings")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(500);
    const now = Date.now();
    for (const s of enabled) {
      const org = await ctx.db.get(s.orgId);
      if (!org || org.emergencyStop?.active || org.suspendedAt || org.deletedAt) continue;
      // The package lapsed: don't plan (or spend) until it's back.
      if (!(await featureAllowed(ctx, org, "autopilot"))) {
        if (!s.pausedReason) await ctx.db.patch(s._id, { pausedReason: "Autopilot comes with a package. Choose one in Settings → Billing to keep planning.", updatedAt: now });
        continue;
      }
      const local = localDate(now, org.timezone);
      const hour = new Date(now + tzOffsetMinutes(now, org.timezone) * 60_000).getUTCHours();
      const weekOf = nextWeekOf(now, org.timezone);
      if (local.weekday < 4 || (local.weekday === 4 && hour < 9) || s.lastPlannedWeek === weekOf) continue;
      await startPlanning(ctx, org, s, s.updatedBy, { weekOf });
    }
  },
});

/** Everything the planner needs: cadence, preferences, and what happened in recent weeks. */
export const planningContext = internalQuery({
  args: { runId: v.id("workflowRuns"), weekOf: v.string(), fromDay: v.number() },
  handler: async (ctx, { runId, weekOf, fromDay }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const org = await ctx.db.get(run.orgId);
    const settings = await ctx.db
      .query("autopilotSettings")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
    if (!org || !settings) return null;
    const cadence = await remainingCadence(ctx, org._id, settings, weekOf, fromDay);
    // History: the last four weeks of slots with outcomes, edits and rejections.
    const since = Date.now() - 28 * DAY;
    const recent = await ctx.db
      .query("calendarSlots")
      .withIndex("by_org_slot", (q) => q.eq("orgId", run.orgId).gte("slotAt", since))
      .take(120);
    const lines: string[] = [];
    for (const s of recent) {
      if (!s.artifactId) {
        lines.push(`- ${s.channel} · ${s.pillar} · "${s.idea}" → ${s.status}`);
        continue;
      }
      const versions = await ctx.db
        .query("artifactVersions")
        .withIndex("by_artifact", (q) => q.eq("artifactId", s.artifactId!))
        .collect();
      const first = versions.find((x) => x.version === 1);
      const last = versions.reduce<Doc<"artifactVersions"> | null>((m, x) => (!m || x.version > m.version ? x : m), null);
      const metrics = await ctx.db
        .query("postMetrics")
        .withIndex("by_artifact", (q) => q.eq("artifactId", s.artifactId!))
        .order("desc")
        .first();
      const rejected = await ctx.db
        .query("approvals")
        .withIndex("by_subject", (q) => q.eq("subjectType", "artifact").eq("subjectId", s.artifactId!))
        .filter((q) => q.eq(q.field("status"), "rejected"))
        .first();
      let line = `- ${s.channel} · ${s.purpose}/${s.format} · pillar "${s.pillar}" · idea "${s.idea}" → ${s.status}`;
      if (metrics) {
        const m = metrics;
        line += ` · results: ${[m.reach !== undefined && `reach ${m.reach}`, m.likes !== undefined && `likes ${m.likes}`, m.comments !== undefined && `comments ${m.comments}`, m.shares !== undefined && `shares ${m.shares}`, m.saves !== undefined && `saves ${m.saves}`, m.clicks !== undefined && `clicks ${m.clicks}`].filter(Boolean).join(", ")}`;
      }
      if (rejected) line += ` · OWNER REJECTED${rejected.decisionNote ? `: "${rejected.decisionNote.slice(0, 200)}"` : ""}`;
      if (first && last && last.version > 1 && last.editedByUser) line += `\n    OWNER EDITED. Before: "${first.body.slice(0, 280)}"\n    After: "${last.body.slice(0, 280)}"`;
      lines.push(line);
    }
    const [y, m, d] = weekOf.split("-").map(Number);
    const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
    return {
      orgKind: org.kind,
      timezone: org.timezone,
      cadence,
      fromDay,
      dates,
      postingHours: settings.postingHours,
      alwaysAskTopics: settings.alwaysAskTopics,
      history: lines.join("\n"),
    };
  },
});

/** Save the planner's week and kick off drafting, one run per channel. */
export const saveWeekPlan = internalMutation({
  args: { runId: v.id("workflowRuns"), weekOf: v.string(), fromDay: v.number(), plan: v.any() },
  handler: async (ctx, { runId, weekOf, fromDay, plan: raw }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    const org = await ctx.db.get(run.orgId);
    const settings = await settingsFor(ctx, run.orgId);
    if (!org || !settings) return;
    const plan = raw as SocialCalendar;
    const now = Date.now();
    const preview = runInput(run).preview === true;
    // Room left per channel (before this plan's old not-yet-drafted slots are replaced below).
    const room = await remainingCadence(ctx, org._id, settings, weekOf, fromDay);
    await ctx.db.insert("weekPlans", {
      orgId: org._id,
      weekOf,
      runId,
      weekTheme: plan.weekTheme.slice(0, 300),
      pillars: plan.pillars.slice(0, 4).map((p) => ({ name: p.name.slice(0, 80), why: p.why.slice(0, 300) })),
      learningsApplied: plan.learningsApplied.slice(0, 8).map((l) => l.slice(0, 300)),
      createdAt: now,
    });
    // Replace any not-yet-drafted slots from an earlier plan of the same week.
    const old = await ctx.db
      .query("calendarSlots")
      .withIndex("by_org_week", (q) => q.eq("orgId", org._id).eq("weekOf", weekOf))
      .collect();
    for (const s of old) if (s.status === "planned") await ctx.db.delete(s._id);

    const perDay = new Map<string, number>();
    const kept = new Map<string, number>();
    const slots = plan.slots
      .filter((s) => {
        const n = kept.get(s.channel) ?? 0;
        if (n >= (room[s.channel] ?? 0)) return false;
        kept.set(s.channel, n + 1);
        return true;
      })
      .map((s) => ({ ...s, day: Math.min(7, Math.max(fromDay, Math.round(s.day))) }))
      .sort((a, b) => a.day - b.day);
    for (const s of slots) {
      const key = `${s.channel}:${s.day}`;
      const indexOnDay = perDay.get(key) ?? 0;
      perDay.set(key, indexOnDay + 1);
      const at = slotTime({ weekOf, day: s.day, channel: s.channel, timeZone: org.timezone, preferredHours: settings.postingHours, indexOnDay });
      await ctx.db.insert("calendarSlots", {
        orgId: org._id,
        weekOf,
        planRunId: runId,
        channel: s.channel,
        day: s.day,
        slotAt: at,
        pillar: s.pillar.slice(0, 80),
        purpose: s.purpose,
        format: s.format,
        idea: s.idea.slice(0, 400),
        angle: s.angle.slice(0, 300),
        approvedOfferPlayName: s.approvedOfferPlayName?.slice(0, 120),
        hookDraft: s.hookDraft.slice(0, 300),
        callToAction: s.callToAction.slice(0, 200),
        needsOwner: s.needsOwner,
        ownerNote: s.ownerNote?.slice(0, 300) || undefined,
        status: "planned",
        createdAt: now,
        updatedAt: now,
      });
    }
    await audit(ctx, { orgId: org._id, actorType: "agent", action: "autopilot.planned", subjectType: "run", subjectId: runId, summary: `Planned ${slots.length} post${slots.length === 1 ? "" : "s"} for the week of ${weekOf}${preview ? " (preview: ideas only)" : ""}: ${plan.weekTheme.slice(0, 160)}` });
    // A free preview shows the plan only: nothing is drafted (or charged) beyond planning.
    if (!preview) await ctx.scheduler.runAfter(0, internal.autopilot.startDrafts, { orgId: org._id, weekOf, createdBy: run.createdBy ?? settings.updatedBy });
  },
});

export const startDrafts = internalMutation({
  args: { orgId: v.id("organizations"), weekOf: v.string(), createdBy: v.id("users") },
  handler: async (ctx, { orgId, weekOf, createdBy }) => {
    const org = await ctx.db.get(orgId);
    const settings = await settingsFor(ctx, orgId);
    if (!org || !settings) return;
    // Switched off or the package lapsed since planning: draft nothing (and charge nothing).
    if (!(await autopilotLive(ctx, org, settings))) return;
    const planned = (
      await ctx.db
        .query("calendarSlots")
        .withIndex("by_org_week", (q) => q.eq("orgId", orgId).eq("weekOf", weekOf))
        .collect()
    )
      .filter((s) => s.status === "planned")
      .sort((a, b) => a.slotAt - b.slotAt);
    const byChannel = new Map<string, Doc<"calendarSlots">[]>();
    for (const s of planned) byChannel.set(s.channel, [...(byChannel.get(s.channel) ?? []), s]);
    let imagesLeft = settings.imagesPerWeek;
    let delay = 0;
    // Instagram first so it gets the image budget (it can't post without one).
    const order = [...byChannel.keys()].sort((a, b) => (a === "instagram" ? -1 : b === "instagram" ? 1 : 0));
    for (const channel of order) {
      const slots = byChannel.get(channel)!.slice(0, MAX_PER_CHANNEL);
      const images = Math.min(imagesLeft, slots.length, 2);
      imagesLeft -= images;
      const plan = planJob("content_social", { quantity: slots.length, images, channel }, { fixture: org.kind === "demo" });
      let runId: Id<"workflowRuns">;
      try {
        runId = await createRunWithReservation(ctx, {
          org,
          kind: plan.kind,
          title: `Autopilot: ${plan.title.toLowerCase()} for ${channel}`,
          roles: plan.roles,
          input: { channel, quantity: slots.length, images, autopilot: weekOf },
          steps: plan.steps,
          meters: plan.meters,
          createdBy,
          isFixture: org.kind === "demo",
        });
      } catch (e) {
        const message = (e as { data?: { message?: string } }).data?.message ?? "Autopilot couldn't start drafting.";
        await ctx.db.patch(settings._id, { pausedReason: message, updatedAt: Date.now() });
        return;
      }
      for (const s of slots) await ctx.db.patch(s._id, { status: "drafting", draftRunId: runId, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(delay, internal.jobs.createContent, { runId, job: "content_social", channel, quantity: slots.length, images, brief: draftBrief(slots, org.timezone) });
      delay += 5_000;
    }
  },
});

function draftBrief(slots: Doc<"calendarSlots">[], timeZone: string) {
  const day = (t: number) => new Date(t).toLocaleString("en-US", { timeZone, weekday: "long", hour: "numeric", minute: "2-digit" });
  return [
    `Write exactly ${slots.length} post${slots.length === 1 ? "" : "s"}, one per planned slot below, in this order. Follow each slot's idea, format and call to action; the hook draft is a starting point you may improve.`,
    ...slots.map((s, i) => `${i + 1}. ${day(s.slotAt)} · ${s.format} · ${s.purpose} · pillar "${s.pillar}"\n   Idea: ${s.idea}\n   Angle: ${s.angle}${s.approvedOfferPlayName ? `\n   Exact approved offer play: ${s.approvedOfferPlayName}` : ""}\n   Hook draft: ${s.hookDraft}\n   Call to action: ${s.callToAction}${s.ownerNote ? `\n   Note: ${s.ownerNote}` : ""}`),
  ].join("\n");
}

/** Called by createContent after drafts are saved: attach them to slots and route each. */
export const routeDrafts = internalMutation({
  args: { runId: v.id("workflowRuns"), artifactIds: v.array(v.id("artifacts")), reviewShipped: v.union(v.boolean(), v.null()) },
  handler: async (ctx, { runId, artifactIds, reviewShipped }) => {
    const slots = (
      await ctx.db
        .query("calendarSlots")
        .withIndex("by_draft_run", (q) => q.eq("draftRunId", runId))
        .collect()
    ).sort((a, b) => a.slotAt - b.slotAt);
    if (!slots.length) return;
    const org = await ctx.db.get(slots[0].orgId);
    const settings = await settingsFor(ctx, slots[0].orgId);
    if (!org || !settings) return;
    for (let i = 0; i < slots.length; i++) {
      const artifact = artifactIds[i] ? await ctx.db.get(artifactIds[i]) : null;
      if (!artifact) {
        await ctx.db.patch(slots[i]._id, { status: "failed", updatedAt: Date.now() });
        continue;
      }
      await routeSlotDraft(ctx, { org, settings, slot: slots[i], artifact, reviewShipped });
    }
  },
});

export const draftingFailed = internalMutation({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const slots = await ctx.db
      .query("calendarSlots")
      .withIndex("by_draft_run", (q) => q.eq("draftRunId", runId))
      .collect();
    for (const s of slots) if (s.status === "drafting") await ctx.db.patch(s._id, { status: "failed", updatedAt: Date.now() });
  },
});

export const publishOutcome = internalMutation({
  args: { artifactId: v.id("artifacts"), status: v.union(v.literal("published"), v.literal("failed"), v.literal("uncertain")) },
  handler: async (ctx, { artifactId, status }) => onPublishOutcome(ctx, artifactId, status),
});
