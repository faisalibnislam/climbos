import { DIRECT_PUBLISH_CHANNELS, label, nextTrust, routeDraft, type AutopilotMode, type TrustEvent, type TrustState } from "../../shared/autopilot";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { featureAllowed } from "./access";
import { autonomyMode, extendApprovalUntil, publishTarget, recordArtifactDecision, SCHEDULE_GRACE_MS } from "./approvals";
import { audit } from "./audit";
import { scheduleHeadsUp } from "../emailActions";

/**
 * Autopilot glue between the calendar and the existing approval-bound
 * publishing pipeline. Automatic posts get a system approval bound to the
 * exact content, destination and policy version, so the publish executor
 * re-checks them like any owner approval (emergency stop, expiry, edits).
 */

/** Posts closer than this to their slot time aren't put on the clock automatically. */
const MIN_LEAD_MS = 120_000;

export async function settingsFor(ctx: MutationCtx, orgId: Id<"organizations">) {
  return ctx.db
    .query("autopilotSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
}

/** Autopilot may act for this workspace: switched on and included in its package. */
export async function autopilotLive(ctx: MutationCtx, org: Doc<"organizations">, settings: Doc<"autopilotSettings"> | null) {
  return Boolean(settings?.enabled) && (await featureAllowed(ctx, org, "autopilot"));
}

export function trustFor(settings: Doc<"autopilotSettings"> | null, channel: string): TrustState {
  const t = settings?.trust.find((x) => x.channel === channel);
  return { channel, streak: t?.streak ?? 0, unlocked: t?.unlocked ?? false };
}

export async function applyTrustEvent(ctx: MutationCtx, settings: Doc<"autopilotSettings">, channel: string, event: TrustEvent) {
  const before = trustFor(settings, channel);
  const after = nextTrust(before, event);
  const now = Date.now();
  const trust = [...settings.trust.filter((t) => t.channel !== channel), { channel, streak: after.streak, unlocked: after.unlocked, updatedAt: now }];
  await ctx.db.patch(settings._id, { trust, updatedAt: now });
  if (after.unlocked && !before.unlocked) {
    await audit(ctx, { orgId: settings.orgId, actorType: "system", action: "autopilot.trust_unlocked", subjectType: "autopilot", subjectId: settings._id, summary: `${label(channel)} earned auto-posting after ${after.streak} approvals without edits.` });
  } else if (!after.unlocked && before.unlocked) {
    await audit(ctx, { orgId: settings.orgId, actorType: "system", action: "autopilot.trust_reset", subjectType: "autopilot", subjectId: settings._id, summary: `${label(channel)} is back to asking first.` });
  }
  return after;
}

export type SlotScheduleResult = "scheduled" | "ready_to_post" | "needs_time" | "needs_approval";

/**
 * Put an approved artifact on the clock for its slot. Channels without a
 * connected direct integration (or without publishing on the package) become
 * "ready to post" (export pack). A slot whose time has passed is never posted
 * late on its own: the owner picks a new time.
 */
export async function scheduleSlot(ctx: MutationCtx, slot: Doc<"calendarSlots">, artifactId: Id<"artifacts">): Promise<SlotScheduleResult> {
  const a = await ctx.db.get(artifactId);
  const org = a ? await ctx.db.get(a.orgId) : null;
  if (!a || !org) return "needs_approval";
  const now = Date.now();
  const { connection } = await publishTarget(ctx, a.orgId, a.channel);
  if (!connection || !(await featureAllowed(ctx, org, "publishing"))) {
    await ctx.db.patch(slot._id, { status: "ready_to_post", updatedAt: now });
    return "ready_to_post";
  }
  if (slot.slotAt < now + MIN_LEAD_MS) {
    await ctx.db.patch(slot._id, { status: "needs_approval", routing: { decision: "ask", reasons: ["Its planned time has passed. Open the post and pick a new time."] }, updatedAt: now });
    return "needs_time";
  }
  // Approvals expire after a few days; a post planned further out keeps its approval until its slot.
  if (!(await extendApprovalUntil(ctx, a, slot.slotAt + SCHEDULE_GRACE_MS, slot.slotAt))) {
    await ctx.db.patch(slot._id, { status: "needs_approval", updatedAt: now });
    return "needs_approval";
  }
  await ctx.db.patch(a._id, { status: "scheduled", scheduledFor: slot.slotAt, lastPublishError: undefined, updatedAt: now });
  await ctx.db.patch(slot._id, { status: "scheduled", updatedAt: now });
  await ctx.scheduler.runAt(slot.slotAt, internal.publish.scheduledPublish, { artifactId: a._id, expectedScheduledFor: slot.slotAt });
  return "scheduled";
}

async function firstOnChannel(ctx: MutationCtx, orgId: Id<"organizations">, channel: string) {
  const published = await ctx.db
    .query("artifacts")
    .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "published"))
    .take(200);
  return !published.some((a) => a.channel === channel);
}

/** Decide whether a fresh autopilot draft posts on its own or waits for the owner. */
export async function routeSlotDraft(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; settings: Doc<"autopilotSettings">; slot: Doc<"calendarSlots">; artifact: Doc<"artifacts">; reviewShipped: boolean | null },
) {
  const { org, settings, slot, artifact } = p;
  const version = artifact.currentVersionId ? await ctx.db.get(artifact.currentVersionId) : null;
  if (!version) return;
  const { connection } = await publishTarget(ctx, org._id, artifact.channel);
  const text = [version.headline, version.body, version.callToAction, ...version.hashtags].filter(Boolean).join("\n");
  const route = routeDraft({
    mode: settings.mode as AutopilotMode,
    channel: artifact.channel,
    text,
    trust: trustFor(settings, artifact.channel),
    unsupportedClaims: version.unsupportedClaims,
    reviewShipped: p.reviewShipped,
    plannerNeedsOwner: slot.needsOwner,
    plannerNote: slot.ownerNote,
    alwaysAskTopics: settings.alwaysAskTopics,
    firstOnChannel: await firstOnChannel(ctx, org._id, artifact.channel),
    canPublish: Boolean(connection),
  });
  if (route.decision === "auto" && artifact.channel === "instagram" && !version.imageStorageId && !version.imageR2Key) {
    route.decision = "ask";
    route.reasons = ["Instagram posts need an image. Add one in the post editor, then approve."];
  }
  // Auto-posting is Bounded Autopilot only; Review and Copilot always ask.
  if (route.decision === "auto" && (await autonomyMode(ctx, org._id)) !== "bounded_autopilot") {
    route.decision = "ask";
    route.reasons = ["Your approval mode asks before anything goes out. Choose Bounded Autopilot in Settings → Policies to let trusted posts go automatically."];
  }
  if (route.decision === "auto" && !(await autopilotLive(ctx, org, settings))) {
    route.decision = "ask";
    route.reasons = ["Autopilot is off, so this waits for you."];
  }
  if (route.decision === "auto" && slot.slotAt < Date.now() + MIN_LEAD_MS) {
    route.decision = "ask";
    route.reasons = ["Its planned time has passed. Open the post and pick a new time."];
  }
  if (org.emergencyStop?.active) {
    route.decision = "ask";
    route.reasons = ["All activity is paused, so nothing posts on its own."];
  }
  const now = Date.now();
  await ctx.db.patch(artifact._id, { scheduledFor: slot.slotAt, updatedAt: now });
  await ctx.db.patch(slot._id, { artifactId: artifact._id, routing: route, status: "needs_approval", updatedAt: now });
  if (route.decision === "ask") return;

  await recordArtifactDecision(ctx, { org, artifact, version, decision: "approve", note: `Autopilot (${settings.mode.replace("_", " ")}): ${route.reasons[0]}` });
  await audit(ctx, { orgId: org._id, actorType: "system", action: "autopilot.approved", subjectType: "artifact", subjectId: artifact._id, summary: `Autopilot approved "${artifact.title}" for ${label(artifact.channel)}: ${route.reasons[0]}` });
  const fresh = await ctx.db.get(slot._id);
  if (fresh) await scheduleSlot(ctx, fresh, artifact._id);
  // Safety window: approvers get a "going out soon, stop it?" email two hours before.
  const scheduled = await ctx.db.get(artifact._id);
  if (scheduled?.status === "scheduled" && scheduled.scheduledFor) await scheduleHeadsUp(ctx, artifact._id, scheduled.scheduledFor);
}

/**
 * Owner approved or sent back an artifact: feed the trust ladder and schedule
 * autopilot slots. Skipped slots stay skipped and, with autopilot off, the
 * post is simply approved (the owner schedules it from the post).
 */
export async function onOwnerDecision(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; artifactId: Id<"artifacts">; decision: "approve" | "reject"; edited: boolean; userId: Id<"users"> },
): Promise<SlotScheduleResult | "not_autopilot"> {
  const slot = await ctx.db
    .query("calendarSlots")
    .withIndex("by_artifact", (q) => q.eq("artifactId", p.artifactId))
    .first();
  if (!slot || slot.status === "skipped") return "not_autopilot";
  const settings = await settingsFor(ctx, p.org._id);
  if (settings) {
    await applyTrustEvent(ctx, settings, slot.channel, p.decision === "reject" ? "rejected" : p.edited ? "approved_edited" : "approved_unedited");
  }
  if (p.decision === "reject") {
    await ctx.db.patch(slot._id, { status: "needs_approval", updatedAt: Date.now() });
    return "needs_approval";
  }
  if (!(await autopilotLive(ctx, p.org, settings))) {
    await ctx.db.patch(slot._id, { status: "ready_to_post", routing: { decision: "ask", reasons: ["Autopilot is off: schedule or post it from the post page."] }, updatedAt: Date.now() });
    return "not_autopilot";
  }
  return scheduleSlot(ctx, slot, p.artifactId);
}

/** Publishing finished for an artifact: mirror it on its calendar slot. */
export async function onPublishOutcome(ctx: MutationCtx, artifactId: Id<"artifacts">, status: "published" | "failed" | "uncertain") {
  const slot = await ctx.db
    .query("calendarSlots")
    .withIndex("by_artifact", (q) => q.eq("artifactId", artifactId))
    .first();
  if (!slot || status === "uncertain" || slot.status === "skipped") return;
  await ctx.db.patch(slot._id, { status: status === "published" ? "published" : "failed", updatedAt: Date.now() });
}

/** A publish was stopped before reaching the platform: the slot waits for the owner, with the reason. */
export async function onPublishBlocked(ctx: MutationCtx, artifactId: Id<"artifacts">, reason: string) {
  const slot = await ctx.db
    .query("calendarSlots")
    .withIndex("by_artifact", (q) => q.eq("artifactId", artifactId))
    .first();
  if (!slot || slot.status === "skipped" || slot.status === "published") return;
  await ctx.db.patch(slot._id, { status: "needs_approval", routing: { decision: "ask", reasons: [`Not posted: ${reason}`] }, updatedAt: Date.now() });
}

export function directPublishChannel(channel: string) {
  return DIRECT_PUBLISH_CHANNELS.has(channel);
}
