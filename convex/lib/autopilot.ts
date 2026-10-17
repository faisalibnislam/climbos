import { DIRECT_PUBLISH_CHANNELS, label, nextTrust, routeDraft, type AutopilotMode, type TrustEvent, type TrustState } from "../../shared/autopilot";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { publishTarget, recordArtifactDecision } from "./approvals";
import { audit } from "./audit";

/**
 * Autopilot glue between the calendar and the existing approval-bound
 * publishing pipeline. Automatic posts get a system approval bound to the
 * exact content, destination and policy version, so the publish executor
 * re-checks them like any owner approval (emergency stop, expiry, edits).
 */

export async function settingsFor(ctx: MutationCtx, orgId: Id<"organizations">) {
  return ctx.db
    .query("autopilotSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
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

/**
 * Put an approved artifact on the clock for its slot. Channels without a
 * connected direct integration become "ready to post" (export pack).
 */
export async function scheduleSlot(ctx: MutationCtx, slot: Doc<"calendarSlots">, artifactId: Id<"artifacts">) {
  const a = await ctx.db.get(artifactId);
  if (!a) return;
  const now = Date.now();
  const { connection } = await publishTarget(ctx, a.orgId, a.channel);
  if (!connection) {
    await ctx.db.patch(slot._id, { status: "ready_to_post", updatedAt: now });
    return;
  }
  // A slot whose time has passed goes out in a couple of minutes instead.
  const when = Math.max(slot.slotAt, now + 120_000);
  await ctx.db.patch(a._id, { status: "scheduled", scheduledFor: when, updatedAt: now });
  await ctx.db.patch(slot._id, { status: "scheduled", updatedAt: now });
  await ctx.scheduler.runAt(when, internal.publish.scheduledPublish, { artifactId: a._id, expectedScheduledFor: when });
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
    route.reasons = ["Instagram posts need an image. Add one in the design studio, then approve."];
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
}

/** Owner approved or sent back an artifact: feed the trust ladder and schedule autopilot slots. */
export async function onOwnerDecision(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; artifactId: Id<"artifacts">; decision: "approve" | "reject"; edited: boolean; userId: Id<"users"> },
) {
  const slot = await ctx.db
    .query("calendarSlots")
    .withIndex("by_artifact", (q) => q.eq("artifactId", p.artifactId))
    .first();
  if (!slot) return;
  const settings = await settingsFor(ctx, p.org._id);
  if (settings) {
    await applyTrustEvent(ctx, settings, slot.channel, p.decision === "reject" ? "rejected" : p.edited ? "approved_edited" : "approved_unedited");
  }
  if (p.decision === "reject") {
    await ctx.db.patch(slot._id, { status: "needs_approval", updatedAt: Date.now() });
    return;
  }
  await scheduleSlot(ctx, slot, p.artifactId);
}

/** Publishing finished for an artifact: mirror it on its calendar slot. */
export async function onPublishOutcome(ctx: MutationCtx, artifactId: Id<"artifacts">, status: "published" | "failed" | "uncertain") {
  const slot = await ctx.db
    .query("calendarSlots")
    .withIndex("by_artifact", (q) => q.eq("artifactId", artifactId))
    .first();
  if (!slot || status === "uncertain") return;
  await ctx.db.patch(slot._id, { status: status === "published" ? "published" : "failed", updatedAt: Date.now() });
}

export function directPublishChannel(channel: string) {
  return DIRECT_PUBLISH_CHANNELS.has(channel);
}
