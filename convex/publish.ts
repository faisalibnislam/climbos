import { unsupportedClaimIssue } from "./lib/claimCheck";
import { trendFreshnessIssue } from "../shared/agents/trendFreshness";
import { v } from "convex/values";
import {
  instagramApprovalValue,
  publishImage,
  PUBLISH_INSTAGRAM_ACTION,
  getMedia,
} from "../shared/integrations/instagram";
import {
  pagePostApprovalValue,
  publishPagePost,
  PUBLISH_PAGE_POST_ACTION,
  getPost as getPagePost,
} from "../shared/integrations/facebookPages";
import { linkedInApprovalValue, publishPost as publishLinkedInPost, PUBLISH_LINKEDIN_ACTION, getPost as getLinkedInPost } from "../shared/integrations/linkedin";
import { normalizeHashtag } from "../shared/integrations/drafts";
import { publishTweet, PUBLISH_X_ACTION, getTweet, xApprovalValue } from "../shared/integrations/x";
import { can, checkApprovalForExecution } from "../shared/policy";
import { scopesFor, type ScopedCapability } from "../shared/integrations/oauth";
import { routeDraft } from "../shared/autopilot";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";
import { appError } from "./lib/tenancy";
import { emitEvent } from "./webhooks";
import { audit } from "./lib/audit";
import { autopilotLive, onPublishBlocked, onPublishOutcome, settingsFor, trustFor } from "./lib/autopilot";
import { notifyOwners } from "./lib/notify";
import { featureAllowed, fleetStopped } from "./lib/access";
import { imageUrlFor } from "./lib/media";
import { publicationMatchesArtifact } from "./lib/approvals";

/**
 * Publishing executor. Immediately before any external write it re-checks:
 * approval status/expiry/hash against the CURRENT content, scope and policy;
 * emergency stops; and the connected account's capability. Idempotency keys
 * are scoped to tenant + artifact + version. A write whose outcome is unknown
 * is recorded as "uncertain" and is never blindly retried.
 */

const TARGET = { instagram: "instagram", facebook: "facebook_pages", linkedin: "linkedin", x: "x" } as const;

const ACTION_FOR = {
  instagram: PUBLISH_INSTAGRAM_ACTION,
  facebook_pages: PUBLISH_PAGE_POST_ACTION,
  linkedin: PUBLISH_LINKEDIN_ACTION,
  x: PUBLISH_X_ACTION,
} as const;

const PLATFORM_NAME = { instagram: "Instagram", facebook_pages: "Facebook", linkedin: "LinkedIn", x: "X" } as const;

/** Providers with short-lived tokens that we renew right before use. */
const REFRESH_BEFORE_USE = new Set(["linkedin", "x"]);
const REFRESH_MARGIN_MS = 5 * 60_000;

/** Text for LinkedIn/X: body, the link (if not already in it), then hashtags. */
function socialText(ver: Doc<"artifactVersions">): string {
  let body = ver.body.trim();
  if (ver.destinationUrl && !body.includes(ver.destinationUrl)) body = `${body}\n\n${ver.destinationUrl}`;
  const tags = [...new Set(ver.hashtags.map(normalizeHashtag).filter((h): h is string => Boolean(h)))].filter((h) => !body.includes(h));
  return tags.length ? `${body}\n\n${tags.join(" ")}` : body;
}

/** Renew an about-to-expire LinkedIn/X token, then return the current connection row. */
async function freshConnection(ctx: ActionCtx, conn: Doc<"connections">): Promise<Doc<"connections">> {
  if (conn.isFixture || !REFRESH_BEFORE_USE.has(conn.provider) || !conn.expiresAt || conn.expiresAt > Date.now() + REFRESH_MARGIN_MS) return conn;
  await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId: conn._id });
  return (await ctx.runQuery(internal.connections.connectionFor, { orgId: conn.orgId, provider: conn.provider })) ?? conn;
}

export const publishContext = internalQuery({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }) => {
    const a = await ctx.db.get(artifactId);
    if (!a) return null;
    const org = await ctx.db.get(a.orgId);
    if (!org) return null;
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const approval = a.approvalId ? await ctx.db.get(a.approvalId) : null;
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    const provider = TARGET[a.channel as keyof typeof TARGET];
    const conn = provider
      ? await ctx.db
          .query("connections")
          .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider))
          .first()
      : null;
    // One attempt per version AND approval: a deliberate re-approval after a
    // failed attempt is a new attempt; repeating the same approval never is.
    const legacyKey = `${org._id}:publish:${a._id}:v${a.currentVersion}`;
    const idempotencyKey = approval ? `${legacyKey}:${approval._id}` : legacyKey;
    const byKey = (key: string) =>
      ctx.db
        .query("actionReceipts")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", key))
        .first();
    const legacy = idempotencyKey === legacyKey ? null : await byKey(legacyKey);
    const receipt = (await byKey(idempotencyKey)) ?? (legacy && legacy.status !== "failed" ? legacy : null);
    const imageUrl = ver ? await imageUrlFor(ctx, ver) : null;
    return {
      artifact: a,
      org,
      version: ver,
      approval,
      policyVersion: policy?.version ?? 1,
      copilot: policy?.mode === "copilot",
      provider: provider ?? null,
      connection: conn,
      emergencyStop: Boolean(org.emergencyStop?.active || org.suspendedAt || org.deletedAt) || (await fleetStopped(ctx)),
      idempotencyKey,
      existingReceipt: receipt,
      imageUrl,
      claimIssue: ver ? await unsupportedClaimIssue(ctx, a.businessId, [a.title, ver.headline, ver.body, ver.callToAction, ...ver.hashtags, ver.altText]) : null,
    };
  },
});

export const beginReceipt = internalMutation({
  args: { artifactId: v.id("artifacts"), versionId: v.id("artifactVersions"), approvalId: v.id("approvals"), approvalHash: v.string(), connectionId: v.id("connections"), connectionUpdatedAt: v.number(), secretId: v.optional(v.id("connectionSecrets")), requestedBy: v.optional(v.id("users")), idempotencyKey: v.string(), provider: v.string(), action: v.string() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.artifactId);
    if (!a) return { blocked: "The post is unavailable." };
    const provider = TARGET[a.channel as keyof typeof TARGET];
    const key = `${a.orgId}:publish:${a._id}:v${a.currentVersion}:${args.approvalId}`;
    if (!provider || args.provider !== provider || args.action !== ACTION_FOR[provider] || args.idempotencyKey !== key) return { blocked: "The publishing destination or attempt changed. Review it again." };
    const existing = await ctx.db
      .query("actionReceipts")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing.orgId === a.orgId && existing.artifactId === a._id
      ? { receiptId: existing._id, existingStatus: existing.status }
      : { blocked: "The publishing attempt belongs to another post." };
    if (a.currentVersionId !== args.versionId || a.approvalId !== args.approvalId || !SENDABLE.includes(a.status)) return { blocked: "The post or its approval changed during the publishing check. Review it again." };
    const version = await ctx.db.get(args.versionId);
    if (!version || version.orgId !== a.orgId || version.artifactId !== a._id) return { blocked: "The approved post version is unavailable." };
    const business = await ctx.db.get(a.businessId);
    if (!business || business.orgId !== a.orgId) return { blocked: "The post's business evidence is unavailable." };
    if (a.status === "scheduled" && (a.scheduledFor === undefined || a.scheduledFor > Date.now())) return { blocked: "This scheduled post is not due yet." };
    const org = await ctx.db.get(a.orgId);
    const approval = await ctx.db.get(args.approvalId);
    const connection = await ctx.db.get(args.connectionId);
    if (!org || !approval || approval.orgId !== a.orgId || approval.subjectType !== "artifact" || approval.subjectId !== a._id || approval.actionKind !== "publish" || approval.approvalHash !== args.approvalHash) return { blocked: "The publishing approval changed. Review it again." };
    if (!connection || connection.orgId !== a.orgId || connection.provider !== provider || connection.status !== "connected" || connection.updatedAt !== args.connectionUpdatedAt) return { blocked: "The connected account changed during preparation. Check Connections and try again." };
    const policy = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", a.orgId).eq("active", true)).first();
    const capability: ScopedCapability = provider === "linkedin" && connection.externalAccountId?.startsWith("urn:li:organization:")
      ? "linkedin.publish_org_post" : provider === "instagram" ? "instagram.publish_media" : ACTION_FOR[provider];
    const capabilityReady = Boolean(connection.isFixture) || Boolean(connection.externalAccountId
      && (!connection.expiresAt || connection.expiresAt > Date.now())
      && scopesFor([capability]).every(scope => connection.scopes.includes(scope))
      && (provider !== "instagram" || ["business", "media_creator", "creator"].includes((connection.accountType ?? "").toLowerCase())));
    const check = await checkApprovalForExecution({
      approval,
      current: { orgId: a.orgId, subjectType: "artifact", subjectId: a._id, actionKind: "publish", contentHash: version.contentHash,
        scope: { connectionId: connection._id, externalAccountId: connection.externalAccountId, destination: a.channel, ...(a.scheduledFor !== undefined ? { scheduledFor: a.scheduledFor } : {}) },
        policyVersion: policy?.version ?? 1, expiresAt: approval.expiresAt },
      now: Date.now(), emergencyStop: Boolean(org.emergencyStop?.active || org.suspendedAt || org.deletedAt) || await fleetStopped(ctx), capabilityReady,
    });
    if (!check.ok) return { blocked: check.message };
    if (policy?.mode === "copilot") return { blocked: "Copilot mode is on. Use the export pack or review the publishing policy." };
    if (!(await featureAllowed(ctx, org, "publishing"))) return { blocked: "Publishing needs an active package. Check Billing before trying again." };
    if (args.requestedBy) {
      const requester = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", a.orgId).eq("userId", args.requestedBy)).unique();
      if (requester?.status !== "active" || !can(requester.role, "approve")) return { blocked: "The person requesting publication no longer has permission." };
    }
    if (approval.decidedBy) {
      const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", a.orgId).eq("userId", approval.decidedBy)).unique();
      if (member?.status !== "active" || !can(member.role, "approve")) return { blocked: "The approver no longer has permission. Ask a current approver to review this post." };
    } else {
      const settings = await settingsFor(ctx, a.orgId);
      const slot = await ctx.db.query("calendarSlots").withIndex("by_artifact", q => q.eq("artifactId", a._id)).first();
      if (policy?.mode !== "bounded_autopilot" || !settings || !(await autopilotLive(ctx, org, settings)) || !settings.channels.some(c => c.channel === a.channel && c.postsPerWeek > 0)
        || !slot || slot.orgId !== a.orgId || slot.status !== "scheduled" || slot.routing?.decision !== "auto" || slot.slotAt !== a.scheduledFor) return { blocked: "Autopilot no longer authorizes this post. Review it before publishing." };
      const route = routeDraft({ mode: settings.mode, channel: a.channel, text: [version.headline, version.body, version.callToAction, ...version.hashtags].filter(Boolean).join("\n"), trust: trustFor(settings, a.channel), unsupportedClaims: version.unsupportedClaims,
        reviewShipped: null, plannerNeedsOwner: slot.needsOwner, plannerNote: slot.ownerNote, alwaysAskTopics: settings.alwaysAskTopics, firstOnChannel: false, canPublish: true });
      if (route.decision !== "auto") return { blocked: route.reasons.join(" ") };
    }
    if (!connection.isFixture) {
      const secret = args.secretId ? await ctx.db.get(args.secretId) : null;
      if (!secret || secret.orgId !== a.orgId || secret.connectionId !== connection._id) return { blocked: "The account credentials changed during preparation. Reconnect or try again." };
    }
    const trendIssue = trendFreshnessIssue(version.copyBrief, Date.now(), a.scheduledFor);
    if (trendIssue) return { blocked: trendIssue };
    const claimIssue = await unsupportedClaimIssue(ctx, a.businessId, [a.title, version.headline, version.body, version.callToAction, ...version.hashtags, version.altText]);
    if (claimIssue) return { blocked: `The business evidence needs review. ${claimIssue}` };
    // Intent marker written BEFORE the provider call: if we crash, the outcome stays "uncertain".
    const receiptId = await ctx.db.insert("actionReceipts", {
      orgId: a.orgId,
      artifactId: a._id,
      provider: args.provider,
      action: args.action,
      idempotencyKey: args.idempotencyKey,
      publication: { versionId: version._id, version: a.currentVersion, contentHash: version.contentHash, approvalId: approval._id, approvalHash: approval.approvalHash, connectionId: connection._id, externalAccountId: connection.externalAccountId, channel: a.channel, isFixture: Boolean(connection.isFixture) },
      status: "uncertain",
      summary: "Sending to the platform…",
      createdAt: Date.now(),
    });
    // Lock edits and rescheduling with the same transaction that claims the write.
    await ctx.db.patch(a._id, { status: "publishing", updatedAt: Date.now() });
    return { receiptId, existingStatus: null };
  },
});

export const finishReceipt = internalMutation({
  args: {
    receiptId: v.id("actionReceipts"),
    artifactId: v.id("artifacts"),
    status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain"), v.literal("fixture_verified")),
    externalId: v.optional(v.string()),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    const a = await ctx.db.get(args.artifactId);
    if (!receipt || !a || receipt.orgId !== a.orgId || receipt.artifactId !== a._id || receipt.status !== "uncertain" || receipt.providerResult || receipt.resolution) return;
    const now = Date.now();
    await ctx.db.patch(args.receiptId, {
      status: args.status,
      externalId: args.externalId,
      summary: args.summary.slice(0, 400),
      verifiedAt: args.status === "verified" || args.status === "fixture_verified" ? now : undefined,
      providerResult: { status: args.status, externalId: args.externalId, summary: args.summary.slice(0, 400), at: now },
    });
    const approval = a.approvalId ? await ctx.db.get(a.approvalId) : null;
    if (publicationMatchesArtifact(receipt, a, approval) && ["publishing", "uncertain"].includes(a.status)) await settleArtifact(ctx, a, args.status, args.summary, args.externalId);
    else await audit(ctx, { orgId: receipt.orgId, actorType: "system", action: "publish.previous_attempt_result", subjectType: "receipt", subjectId: receipt._id, summary: `Recorded ${args.status} for the original publishing attempt; current content was left unchanged.` });
  },
});

/** Mirror a receipt outcome on its artifact and calendar slot, and tell approvers when it didn't go out. */
async function settleArtifact(ctx: MutationCtx, a: Doc<"artifacts">, outcome: Doc<"actionReceipts">["status"], summary: string, externalId?: string) {
  const now = Date.now();
  const status = outcome === "verified" || outcome === "fixture_verified" ? "published" : outcome === "uncertain" ? "uncertain" : "failed";
  if (a.status === status) return;
  await ctx.db.patch(a._id, { status, updatedAt: now, lastPublishError: status === "failed" ? { message: summary.slice(0, 400), at: now } : undefined });
  if (status === "published" && a.approvalId) await ctx.db.patch(a.approvalId, { status: "consumed" });
  if (status === "published") await emitEvent(ctx, a.orgId, "post.published", { title: a.title, channel: a.channel, externalId: externalId ?? null });
  await onPublishOutcome(ctx, a._id, status);
  if (status !== "published") await notifyOwners(ctx, a.orgId, `"${a.title}" ${status === "failed" ? "wasn't posted" : "may not have posted"}: ${summary}`, `content/${a._id}`, APPROVERS);
  await audit(ctx, { orgId: a.orgId, actorType: "system", action: `publish.${outcome}`, subjectType: "artifact", subjectId: a._id, summary: `${a.title}: ${summary}` });
}

const APPROVERS = ["owner", "admin", "reviewer"];
const SENDABLE: string[] = ["approved", "publishing", "scheduled"];

/** A repeat call found an earlier attempt for this approval: make sure the artifact isn't left "Sending…". */
export const settleFromReceipt = internalMutation({
  args: { artifactId: v.id("artifacts"), receiptId: v.id("actionReceipts") },
  handler: async (ctx, { artifactId, receiptId }) => {
    const a = await ctx.db.get(artifactId);
    const r = await ctx.db.get(receiptId);
    if (!a || !r || !SENDABLE.includes(a.status)) return;
    const approval = a.approvalId ? await ctx.db.get(a.approvalId) : null;
    if (!publicationMatchesArtifact(r, a, approval)) return;
    await settleArtifact(ctx, a, r.status, r.summary, r.externalId);
  },
});

/** Store the latest destination-offer check on the exact version it ran for (warning only; never blocks). */
export const recordDestinationOfferCheck = internalMutation({
  args: { versionId: v.id("artifactVersions"), url: v.string(), status: v.union(v.literal("found"), v.literal("not_found"), v.literal("unavailable")), found: v.array(v.number()) },
  handler: async (ctx, { versionId, url, status, found }) => {
    const version = await ctx.db.get(versionId);
    if (!version) return;
    await ctx.db.patch(versionId, { destinationOfferCheck: { checkedAt: Date.now(), url: url.slice(0, 500), status, found: found.slice(0, 10) } });
  },
});

/** Owner-started check that the approved post's link still shows the approved offer price. */
export const checkDestinationOffer = action({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }): Promise<{ status: "found" | "not_found" | "unavailable"; found: number[] } | null> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "edit" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const target = await ctx.runQuery(internal.publish.offerCheckTarget, { orgId: access.orgId, artifactId });
    if (!target) return null;
    const result = await ctx.runAction(internal.publishLinks.checkOfferDestination, { url: target.url, prices: target.prices });
    await ctx.runMutation(internal.publish.recordDestinationOfferCheck, { versionId: target.versionId, url: target.url, ...result });
    return result;
  },
});

export const offerCheckTarget = internalQuery({
  args: { orgId: v.id("organizations"), artifactId: v.id("artifacts") },
  handler: async (ctx, { orgId, artifactId }) => {
    const artifact = await ctx.db.get(artifactId);
    if (!artifact || artifact.orgId !== orgId || !artifact.currentVersionId) return null;
    const version = await ctx.db.get(artifact.currentVersionId);
    const prices = [...new Set((version?.approvedOfferTermsSnapshot ?? []).flatMap((term) => term.allowedPrices))];
    return version?.destinationUrl && prices.length ? { versionId: version._id, url: version.destinationUrl, prices } : null;
  },
});

export const blockPublish = internalMutation({
  args: { artifactId: v.id("artifacts"), expected: v.object({ versionId: v.union(v.id("artifactVersions"), v.null()), approvalId: v.union(v.id("approvals"), v.null()), approvalHash: v.union(v.string(), v.null()), status: v.string(), scheduledFor: v.union(v.number(), v.null()) }), reason: v.string(), backTo: v.union(v.literal("approved"), v.literal("in_review")) },
  handler: async (ctx, { artifactId, expected, reason, backTo }) => {
    const a = await ctx.db.get(artifactId);
    if (!a || !SENDABLE.includes(a.status) || a.status !== expected.status || (a.currentVersionId ?? null) !== expected.versionId || (a.approvalId ?? null) !== expected.approvalId || (a.scheduledFor ?? null) !== expected.scheduledFor) return;
    const approval = a.approvalId ? await ctx.db.get(a.approvalId) : null;
    if ((approval?.approvalHash ?? null) !== expected.approvalHash) return;
    // A second worker's late refusal must not undo an already claimed send.
    const legacyKey = `${a.orgId}:publish:${a._id}:v${a.currentVersion}`;
    const key = a.approvalId ? `${legacyKey}:${a.approvalId}` : legacyKey;
    const claimed = await ctx.db.query("actionReceipts").withIndex("by_idempotency", q => q.eq("idempotencyKey", key)).first();
    const legacy = key === legacyKey ? null : await ctx.db.query("actionReceipts").withIndex("by_idempotency", q => q.eq("idempotencyKey", legacyKey)).first();
    if (claimed || (legacy && legacy.status !== "failed")) return;
    const now = Date.now();
    await ctx.db.patch(a._id, { status: backTo, scheduledFor: undefined, lastPublishError: { message: reason.slice(0, 400), at: now }, updatedAt: now });
    await onPublishBlocked(ctx, a._id, reason);
    await notifyOwners(ctx, a.orgId, `"${a.title}" wasn't posted: ${reason}`, `content/${a._id}`, APPROVERS);
    await audit(ctx, { orgId: a.orgId, actorType: "system", action: "publish.blocked", subjectType: "artifact", subjectId: a._id, summary: `Not published: ${reason}` });
  },
});

export const scheduledPublish = internalAction({
  args: { artifactId: v.id("artifacts"), expectedScheduledFor: v.number() },
  handler: async (ctx, { artifactId, expectedScheduledFor }) => {
    const c = await ctx.runQuery(internal.publish.publishContext, { artifactId });
    // Rescheduled or unscheduled since: this timer is stale.
    if (!c || c.artifact.status !== "scheduled" || c.artifact.scheduledFor !== expectedScheduledFor) return;
    await ctx.runAction(internal.publish.publishArtifact, { artifactId });
  },
});

export const publishArtifact = internalAction({
  args: { artifactId: v.id("artifacts"), requestedBy: v.optional(v.id("users")) },
  handler: async (ctx, { artifactId, requestedBy }) => {
    const c = await ctx.runQuery(internal.publish.publishContext, { artifactId });
    // Only an approved post on its way out is sent (published, archived or edited ones are left alone).
    if (!c || !SENDABLE.includes(c.artifact.status)) return;
    if (c.artifact.status === "scheduled" && c.artifact.scheduledFor !== undefined && c.artifact.scheduledFor > Date.now()) return;
    const expected = { versionId: c.artifact.currentVersionId ?? null, approvalId: c.artifact.approvalId ?? null, approvalHash: c.approval?.approvalHash ?? null, status: c.artifact.status, scheduledFor: c.artifact.scheduledFor ?? null };
    if (!c.version) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "There's nothing to post yet.", backTo: "in_review" });
      return;
    }
    const { artifact, version, approval } = c;

    if (c.existingReceipt) {
      // This approval was already attempted: never duplicate. Uncertain outcomes go to reconciliation.
      if (c.existingReceipt.status === "uncertain") await ctx.runAction(internal.publish.reconcile, { receiptId: c.existingReceipt._id });
      await ctx.runMutation(internal.publish.settleFromReceipt, { artifactId, receiptId: c.existingReceipt._id });
      return;
    }
    if (c.claimIssue) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: `The business evidence needs review. ${c.claimIssue}`, backTo: "in_review" });
      return;
    }
    const trendIssue = trendFreshnessIssue(version.copyBrief, Date.now(), artifact.scheduledFor);
    if (trendIssue) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: trendIssue, backTo: "in_review" });
      return;
    }
    if (!c.provider || !c.connection || c.connection.status !== "connected") {
      await ctx.runMutation(internal.publish.blockPublish, {
        artifactId, expected,
        reason: c.provider ? "The account isn't connected. Connect it, or use the export pack." : "This channel has no verified integration. Use the export pack.",
        backTo: "approved",
      });
      return;
    }
    const conn = await freshConnection(ctx, c.connection).catch(() => null);
    if (!conn) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "The account access could not be refreshed. Check Connections and try again.", backTo: "approved" });
      return;
    }
    if (REFRESH_BEFORE_USE.has(c.provider) && !conn.isFixture && conn.expiresAt && conn.expiresAt <= Date.now()) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: `${PLATFORM_NAME[c.provider]} sign-in expired. Reconnect it in Connections, then publish again.`, backTo: "approved" });
      return;
    }
    const capabilityReady =
      conn.isFixture ||
      (c.provider === "instagram"
        ? ["business", "media_creator", "creator"].includes((conn.accountType ?? "").toLowerCase())
        : true) && (!conn.expiresAt || conn.expiresAt > Date.now());
    if (!approval) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "No approval on record.", backTo: "in_review" });
      return;
    }
    const check = await checkApprovalForExecution({
      approval: { status: approval.status, approvalHash: approval.approvalHash, expiresAt: approval.expiresAt, scope: approval.scope, contentHash: approval.contentHash, policyVersion: approval.policyVersion },
      current: {
        orgId: c.org._id,
        subjectType: "artifact",
        subjectId: artifact._id,
        actionKind: approval.actionKind,
        contentHash: version.contentHash,
        scope: { connectionId: conn._id, externalAccountId: conn.externalAccountId, destination: artifact.channel, ...(artifact.scheduledFor !== undefined ? { scheduledFor: artifact.scheduledFor } : {}) },
        policyVersion: c.policyVersion,
        expiresAt: approval.expiresAt,
      },
      now: Date.now(),
      emergencyStop: c.emergencyStop,
      capabilityReady,
    });
    if (!check.ok) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: check.message, backTo: check.reason === "emergency_stop" ? "approved" : "in_review" });
      return;
    }
    // Copilot mode: the owner posts it themselves (export pack), even if it was scheduled before switching.
    if (c.copilot) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "Copilot mode is on: post it yourself from the export pack, or switch to Review in Settings → Policies.", backTo: "approved" });
      return;
    }

    const outboundLinks = [...new Set([
      ...(version.destinationUrl ? [version.destinationUrl] : []),
      ...[...`${version.body}\n${version.hashtags.join(" ")}`.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map((match) => match[0].replace(/[.,;!?]+$/, "")),
    ])];
    if (outboundLinks.length) {
      const linkChecks = await ctx.runAction(internal.publishLinks.check, { urls: outboundLinks });
      const unavailable = linkChecks.filter((link) => link.status !== "reachable");
      if (unavailable.length) {
        const detail = unavailable.length === 1
          ? `The link ${unavailable[0]?.url} could not be safely confirmed (HTTP ${unavailable[0]?.httpStatus ?? "status unavailable"}).`
          : `${unavailable.length} links could not be safely confirmed before posting.`;
        await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: `${detail} Check or remove the link, then approve the post again.`, backTo: "approved" });
        return;
      }
    }

    // Warning only: record whether the destination still shows an approved offer price; publishing continues either way.
    const offerPrices = [...new Set((version.approvedOfferTermsSnapshot ?? []).flatMap((term) => term.allowedPrices))];
    if (version.destinationUrl && offerPrices.length) {
      const offer = await ctx.runAction(internal.publishLinks.checkOfferDestination, { url: version.destinationUrl, prices: offerPrices }).catch(() => ({ status: "unavailable" as const, found: [] as number[] }));
      await ctx.runMutation(internal.publish.recordDestinationOfferCheck, { versionId: version._id, url: version.destinationUrl, ...offer });
    }

    // Freeze the prepared credentials before the atomic authorization claim. A
    // refresh/reconnection cannot substitute a token after the final check.
    const secret = conn.isFixture ? null : await ctx.runQuery(internal.connections.getSecret, { connectionId: conn._id }).catch(() => null);
    if (!conn.isFixture && (!secret || secret.orgId !== artifact.orgId || secret.provider !== c.provider || secret.externalAccountId !== conn.externalAccountId)) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "The account credentials changed. Reconnect or try again.", backTo: "in_review" });
      return;
    }
    let accessToken = "";
    if (secret) {
      try {
        const parsed = JSON.parse(secret.value) as { accessToken?: unknown } | null;
        accessToken = typeof parsed?.accessToken === "string" ? parsed.accessToken.trim() : "";
      } catch { /* Invalid credentials remain blocked. */ }
      if (!accessToken) {
        await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: "The connection has no usable access token. Reconnect the account.", backTo: "approved" });
        return;
      }
    }
    const action = ACTION_FOR[c.provider];
    const begin = await ctx.runMutation(internal.publish.beginReceipt, { artifactId, versionId: version._id, approvalId: approval._id, approvalHash: approval.approvalHash, connectionId: conn._id, connectionUpdatedAt: conn.updatedAt, secretId: secret?.secretId, requestedBy, idempotencyKey: c.idempotencyKey, provider: c.provider, action });
    if ("blocked" in begin) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, expected, reason: begin.blocked!, backTo: "in_review" });
      return;
    }
    if (begin.existingStatus) {
      await ctx.runMutation(internal.publish.settleFromReceipt, { artifactId, receiptId: begin.receiptId });
      return;
    }

    if (conn.isFixture) {
      await ctx.runMutation(internal.publish.finishReceipt, {
        receiptId: begin.receiptId,
        artifactId,
        status: "fixture_verified",
        externalId: `demo_${artifact._id.slice(-6)}`,
        summary: "Demo: simulated platform acceptance. Nothing was posted to a real account.",
      });
      return;
    }

    const caption = [version.body, version.hashtags.join(" ")].filter(Boolean).join("\n\n");
    // The stored approval (status, expiry, content and scope hash) was re-verified just above, so the
    // adapters' freshness guard measures that check. Posts scheduled days ahead would otherwise be refused.
    const approvedAt = Date.now();
    const approvedBy = approval.decidedBy ?? "owner";
    try {
      if (c.provider === "instagram") {
        if (!c.imageUrl) {
          await ctx.runMutation(internal.publish.finishReceipt, { receiptId: begin.receiptId, artifactId, status: "failed", summary: "Instagram posts need an image. Add one and approve again." });
          return;
        }
        const post = { igUserId: conn.externalAccountId ?? "", imageUrl: c.imageUrl, caption, altText: version.altText };
        const res = await publishImage({
          accessToken,
          post,
          approval: { kind: PUBLISH_INSTAGRAM_ACTION, targetId: post.igUserId, value: await instagramApprovalValue(post), approvedBy, approvedAt },
          maxPolls: 10,
          pollIntervalMs: 3000,
        });
        await ctx.runMutation(internal.publish.finishReceipt, {
          receiptId: begin.receiptId,
          artifactId,
          status: res.status,
          // Keep the media container id for reconciliation when the outcome is unknown.
          externalId: res.status === "uncertain" && res.containerId ? `container:${res.containerId}` : res.externalId,
          summary: res.status === "verified" ? "Accepted by Instagram and confirmed on read-back." : (res.providerMessage ?? "Instagram didn't accept the post."),
        });
      } else if (c.provider === "linkedin") {
        const post = { authorUrn: conn.externalAccountId ?? "", text: socialText(version), imageUrl: c.imageUrl ?? undefined, altText: c.imageUrl ? version.altText : undefined };
        const res = await publishLinkedInPost({
          accessToken,
          post,
          approval: { kind: PUBLISH_LINKEDIN_ACTION, targetId: post.authorUrn, value: await linkedInApprovalValue(post), approvedBy, approvedAt },
        });
        await ctx.runMutation(internal.publish.finishReceipt, {
          receiptId: begin.receiptId,
          artifactId,
          status: res.status,
          externalId: res.externalId,
          summary: res.status === "verified" ? "Accepted by LinkedIn and confirmed on read-back." : (res.providerMessage ?? "LinkedIn didn't accept the post."),
        });
      } else if (c.provider === "x") {
        const post = { userId: conn.externalAccountId ?? "", text: socialText(version) };
        const res = await publishTweet({
          accessToken,
          post,
          approval: { kind: PUBLISH_X_ACTION, targetId: post.userId, value: await xApprovalValue(post), approvedBy, approvedAt },
        });
        const noImage = c.imageUrl && res.status !== "failed" ? " Posted without the image: X image upload isn't enabled yet." : "";
        await ctx.runMutation(internal.publish.finishReceipt, {
          receiptId: begin.receiptId,
          artifactId,
          status: res.status,
          externalId: res.externalId,
          summary: (res.status === "verified" ? "Accepted by X and confirmed on read-back." : (res.providerMessage ?? "X didn't accept the post.")) + noImage,
        });
      } else {
        const post = { pageId: conn.externalAccountId ?? "", message: caption, link: c.imageUrl ? undefined : version.destinationUrl, imageUrl: c.imageUrl ?? undefined };
        const res = await publishPagePost({
          accessToken,
          post,
          approval: { kind: PUBLISH_PAGE_POST_ACTION, targetId: post.pageId, value: await pagePostApprovalValue(post), approvedBy, approvedAt },
        });
        await ctx.runMutation(internal.publish.finishReceipt, {
          receiptId: begin.receiptId,
          artifactId,
          status: res.status,
          externalId: res.externalId,
          summary: res.status === "verified" ? "Accepted by Facebook and confirmed on read-back." : (res.providerMessage ?? "Facebook didn't accept the post."),
        });
      }
    } catch {
      await ctx.runMutation(internal.publish.finishReceipt, {
        receiptId: begin.receiptId,
        artifactId,
        status: "uncertain",
        summary: "We lost contact with the platform mid-request. We'll check whether it was posted before trying again.",
      });
    }
  },
});

/** Read only the identity frozen when this send was claimed, never the current destination. */
async function recoveryContext(ctx: QueryCtx | MutationCtx, receiptId: Id<"actionReceipts">) {
  const receipt = await ctx.db.get(receiptId);
  const p = receipt?.publication;
  if (!receipt || receipt.status !== "uncertain" || !receipt.artifactId || !p || p.isFixture || !p.externalAccountId) return null;
  const artifact = await ctx.db.get(receipt.artifactId);
  const version = await ctx.db.get(p.versionId);
  const connection = await ctx.db.get(p.connectionId);
  const provider = TARGET[p.channel as keyof typeof TARGET];
  if (!artifact || artifact.orgId !== receipt.orgId || !version || version.orgId !== receipt.orgId || version.artifactId !== receipt.artifactId || version.version !== p.version || version.contentHash !== p.contentHash
    || !provider || provider !== receipt.provider || ACTION_FOR[provider] !== receipt.action
    || !connection || connection.orgId !== receipt.orgId || connection.provider !== provider || connection.status !== "connected" || connection.isFixture || connection.externalAccountId !== p.externalAccountId) return null;
  return { receipt, version, connection, provider };
}

export const recoveryContextFor = internalQuery({ args: { receiptId: v.id("actionReceipts") }, handler: recoveryContextQuery });
async function recoveryContextQuery(ctx: QueryCtx, args: { receiptId: Id<"actionReceipts"> }) { return recoveryContext(ctx, args.receiptId); }

/** A provider read is an observation, not another publishing attempt. Recheck its account and credential identity after I/O. */
export const recordRecovery = internalMutation({
  args: { receiptId: v.id("actionReceipts"), externalId: v.string(), connectionUpdatedAt: v.number(), secretId: v.id("connectionSecrets"), requestedBy: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const c = await recoveryContext(ctx, args.receiptId);
    if (!c || c.receipt.externalId !== args.externalId || c.connection.updatedAt !== args.connectionUpdatedAt) return;
    if (args.requestedBy) {
      const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", c.receipt.orgId).eq("userId", args.requestedBy)).unique();
      if (member?.status !== "active" || !can(member.role, "approve")) return;
    }
    const secret = await ctx.db.get(args.secretId);
    if (!secret || secret.orgId !== c.receipt.orgId || secret.connectionId !== c.connection._id) return;
    const now = Date.now();
    const summary = "Confirmed by reading the original provider post and matching its content.";
    await ctx.db.patch(c.receipt._id, { status: "verified", summary, verifiedAt: now, resolution: { source: "provider_read", outcome: "posted", at: now, previousSummary: c.receipt.summary.slice(0, 400) } });
    const a = await ctx.db.get(c.receipt.artifactId!);
    const approval = a?.approvalId ? await ctx.db.get(a.approvalId) : null;
    if (a && publicationMatchesArtifact(c.receipt, a, approval) && ["publishing", "uncertain"].includes(a.status)) await settleArtifact(ctx, a, "verified", summary, args.externalId);
    await audit(ctx, { orgId: c.receipt.orgId, actorType: "system", action: "publish.reconciled", subjectType: "receipt", subjectId: c.receipt._id, summary });
  },
});

/** Exact-ID read-back only. Missing IDs, inaccessible posts and incomplete feeds never prove non-publication. */
export const reconcile = internalAction({
  args: { receiptId: v.id("actionReceipts"), requestedBy: v.optional(v.id("users")) },
  handler: async (ctx, { receiptId, requestedBy }) => {
    let c = await ctx.runQuery(internal.publish.recoveryContextFor, { receiptId });
    if (!c || !c.receipt.externalId || c.receipt.externalId.startsWith("container:")) return;
    await freshConnection(ctx, c.connection).catch(() => null);
    c = await ctx.runQuery(internal.publish.recoveryContextFor, { receiptId });
    if (!c || !c.receipt.externalId || (c.connection.expiresAt !== undefined && c.connection.expiresAt <= Date.now())) return;
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connection._id }).catch(() => null);
    if (!secret || secret.orgId !== c.receipt.orgId || secret.provider !== c.provider || secret.externalAccountId !== c.connection.externalAccountId) return;
    let accessToken: string;
    try {
      const parsed = JSON.parse(secret.value) as { accessToken?: unknown } | null;
      if (typeof parsed?.accessToken !== "string" || !parsed.accessToken.trim()) return;
      accessToken = parsed.accessToken;
    } catch { return; }
    const id = c.receipt.externalId;
    const account = c.connection.externalAccountId;
    const caption = [c.version.body, c.version.hashtags.join(" ")].filter(Boolean).join("\n\n");
    const same = (a: string, b: string | undefined) => b !== undefined && a.normalize("NFC").trim() === b.normalize("NFC").trim();
    let matches = false;
    try {
      if (c.provider === "linkedin") {
        const read = await getLinkedInPost({ accessToken, postUrn: id });
        matches = read.ok && read.data.id === id && read.data.author === account && read.data.lifecycleState === "PUBLISHED" && same(socialText(c.version), read.data.text);
      } else if (c.provider === "x") {
        const read = await getTweet({ accessToken, tweetId: id });
        matches = read.ok && read.data.id === id && read.data.authorId === account && same(socialText(c.version), read.data.text);
      } else if (c.provider === "facebook_pages") {
        if (id.includes("_") && id.split("_")[0] !== account) return;
        const read = await getPagePost({ accessToken, postId: id });
        matches = read.ok && read.data.id === id && same(caption, read.data.message);
      } else if (/^\d+$/.test(id)) {
        const read = await getMedia({ accessToken, mediaId: id });
        matches = read.ok && read.data.id === id && same(caption, read.data.caption);
      }
    } catch { return; }
    if (matches) await ctx.runMutation(internal.publish.recordRecovery, { receiptId, externalId: id, connectionUpdatedAt: c.connection.updatedAt, secretId: secret.secretId, requestedBy });
    // Unknown observations keep the original result. No resend and no "not posted" inference.
  },
});

/** Owner-requested, read-only recovery of the exact attempt shown in the review panel. */
export const checkResult = action({
  args: { slug: v.string(), artifactId: v.id("artifacts"), receiptId: v.id("actionReceipts"), versionId: v.id("artifactVersions"), approvalId: v.union(v.id("approvals"), v.null()), approvalHash: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<"verified" | "uncertain"> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug: args.slug, permission: "approve" });
    const view = await ctx.runQuery(api.content.get, { slug: args.slug, artifactId: args.artifactId });
    const r = view.recovery;
    if (view.status !== "uncertain" || !r || r.receiptId !== args.receiptId || r.versionId !== args.versionId || r.approvalId !== args.approvalId || r.approvalHash !== args.approvalHash) throw appError("INVALID", "This publishing attempt changed. Reload before checking its result.");
    await ctx.runAction(internal.publish.reconcile, { receiptId: args.receiptId, requestedBy: access.userId });
    const result = await ctx.runQuery(internal.publish.receipt, { receiptId: args.receiptId });
    return result?.orgId === access.orgId && result.status === "verified" && result.resolution?.source === "provider_read" ? "verified" : "uncertain";
  },
});

export const receipt = internalQuery({
  args: { receiptId: v.id("actionReceipts") },
  handler: async (ctx, { receiptId }) => ctx.db.get(receiptId),
});
