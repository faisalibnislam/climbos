import { v } from "convex/values";
import {
  instagramApprovalValue,
  publishImage,
  PUBLISH_INSTAGRAM_ACTION,
  reconcilePublish,
} from "../shared/integrations/instagram";
import {
  pagePostApprovalValue,
  publishPagePost,
  PUBLISH_PAGE_POST_ACTION,
  reconcilePagePost,
} from "../shared/integrations/facebookPages";
import { linkedInApprovalValue, publishPost as publishLinkedInPost, PUBLISH_LINKEDIN_ACTION, reconcilePost as reconcileLinkedInPost } from "../shared/integrations/linkedin";
import { normalizeHashtag } from "../shared/integrations/drafts";
import { publishTweet, PUBLISH_X_ACTION, reconcileTweet, xApprovalValue } from "../shared/integrations/x";
import { checkApprovalForExecution } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "./_generated/server";
import { appError } from "./lib/tenancy";
import { emitEvent } from "./webhooks";
import { audit } from "./lib/audit";
import { onPublishBlocked, onPublishOutcome } from "./lib/autopilot";
import { notifyOwners } from "./lib/notify";
import { fleetStopped } from "./lib/access";
import { imageUrlFor } from "./lib/media";

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
    };
  },
});

export const beginReceipt = internalMutation({
  args: { artifactId: v.id("artifacts"), idempotencyKey: v.string(), provider: v.string(), action: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("actionReceipts")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return { receiptId: existing._id, existingStatus: existing.status };
    const a = await ctx.db.get(args.artifactId);
    if (!a) throw new Error("missing artifact");
    // Intent marker written BEFORE the provider call: if we crash, the outcome stays "uncertain".
    const receiptId = await ctx.db.insert("actionReceipts", {
      orgId: a.orgId,
      artifactId: a._id,
      provider: args.provider,
      action: args.action,
      idempotencyKey: args.idempotencyKey,
      status: "uncertain",
      summary: "Sending to the platform…",
      createdAt: Date.now(),
    });
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
    const now = Date.now();
    await ctx.db.patch(args.receiptId, {
      status: args.status,
      externalId: args.externalId,
      summary: args.summary.slice(0, 400),
      verifiedAt: args.status === "verified" || args.status === "fixture_verified" ? now : undefined,
    });
    const a = await ctx.db.get(args.artifactId);
    if (!a) return;
    await settleArtifact(ctx, a, args.status, args.summary, args.externalId);
  },
});

/** Mirror a receipt outcome on its artifact and calendar slot, and tell approvers when it didn't go out. */
async function settleArtifact(ctx: MutationCtx, a: Doc<"artifacts">, outcome: Doc<"actionReceipts">["status"], summary: string, externalId?: string) {
  const now = Date.now();
  const status = outcome === "verified" || outcome === "fixture_verified" ? "published" : outcome === "uncertain" ? "uncertain" : "failed";
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
  args: { artifactId: v.id("artifacts"), reason: v.string(), backTo: v.union(v.literal("approved"), v.literal("in_review")) },
  handler: async (ctx, { artifactId, reason, backTo }) => {
    const a = await ctx.db.get(artifactId);
    if (!a) return;
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
  handler: async (ctx, { artifactId }) => {
    const c = await ctx.runQuery(internal.publish.publishContext, { artifactId });
    // Only an approved post on its way out is sent (published, archived or edited ones are left alone).
    if (!c || !SENDABLE.includes(c.artifact.status)) return;
    if (!c.version) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: "There's nothing to post yet.", backTo: "in_review" });
      return;
    }
    const { artifact, version, approval } = c;

    if (c.existingReceipt) {
      // This approval was already attempted: never duplicate. Uncertain outcomes go to reconciliation.
      if (c.existingReceipt.status === "uncertain") await ctx.runAction(internal.publish.reconcile, { receiptId: c.existingReceipt._id });
      await ctx.runMutation(internal.publish.settleFromReceipt, { artifactId, receiptId: c.existingReceipt._id });
      return;
    }
    if (!c.provider || !c.connection || c.connection.status !== "connected") {
      await ctx.runMutation(internal.publish.blockPublish, {
        artifactId,
        reason: c.provider ? "The account isn't connected. Connect it, or use the export pack." : "This channel has no verified integration. Use the export pack.",
        backTo: "approved",
      });
      return;
    }
    const conn = await freshConnection(ctx, c.connection);
    if (REFRESH_BEFORE_USE.has(c.provider) && !conn.isFixture && conn.expiresAt && conn.expiresAt <= Date.now()) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: `${PLATFORM_NAME[c.provider]} sign-in expired. Reconnect it in Connections, then publish again.`, backTo: "approved" });
      return;
    }
    const capabilityReady =
      conn.isFixture ||
      (c.provider === "instagram"
        ? ["business", "media_creator", "creator"].includes((conn.accountType ?? "").toLowerCase())
        : true) && (!conn.expiresAt || conn.expiresAt > Date.now());
    if (!approval) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: "No approval on record.", backTo: "in_review" });
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
        scope: { connectionId: c.connection._id, destination: artifact.channel, ...(artifact.scheduledFor !== undefined ? { scheduledFor: artifact.scheduledFor } : {}) },
        policyVersion: c.policyVersion,
        expiresAt: approval.expiresAt,
      },
      now: Date.now(),
      emergencyStop: c.emergencyStop,
      capabilityReady,
    });
    if (!check.ok) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: check.message, backTo: check.reason === "emergency_stop" ? "approved" : "in_review" });
      return;
    }
    // Copilot mode: the owner posts it themselves (export pack), even if it was scheduled before switching.
    if (c.copilot) {
      await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: "Copilot mode is on: post it yourself from the export pack, or switch to Review in Settings → Policies.", backTo: "approved" });
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
        await ctx.runMutation(internal.publish.blockPublish, { artifactId, reason: `${detail} Check or remove the link, then approve the post again.`, backTo: "approved" });
        return;
      }
    }

    // Warning only: record whether the destination still shows an approved offer price; publishing continues either way.
    const offerPrices = [...new Set((version.approvedOfferTermsSnapshot ?? []).flatMap((term) => term.allowedPrices))];
    if (version.destinationUrl && offerPrices.length) {
      const offer = await ctx.runAction(internal.publishLinks.checkOfferDestination, { url: version.destinationUrl, prices: offerPrices }).catch(() => ({ status: "unavailable" as const, found: [] as number[] }));
      await ctx.runMutation(internal.publish.recordDestinationOfferCheck, { versionId: version._id, url: version.destinationUrl, ...offer });
    }

    const action = ACTION_FOR[c.provider];
    const begin = await ctx.runMutation(internal.publish.beginReceipt, { artifactId, idempotencyKey: c.idempotencyKey, provider: c.provider, action });
    if (begin.existingStatus) {
      await ctx.runMutation(internal.publish.settleFromReceipt, { artifactId, receiptId: begin.receiptId });
      return;
    }

    if (c.connection.isFixture) {
      await ctx.runMutation(internal.publish.finishReceipt, {
        receiptId: begin.receiptId,
        artifactId,
        status: "fixture_verified",
        externalId: `demo_${artifact._id.slice(-6)}`,
        summary: "Demo: simulated platform acceptance. Nothing was posted to a real account.",
      });
      return;
    }

    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connection._id });
    if (!secret) {
      await ctx.runMutation(internal.publish.finishReceipt, { receiptId: begin.receiptId, artifactId, status: "failed", summary: "The connection's access was removed. Reconnect the account." });
      return;
    }
    const { accessToken } = JSON.parse(secret.value) as { accessToken: string };
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
        const post = { igUserId: c.connection.externalAccountId ?? "", imageUrl: c.imageUrl, caption, altText: version.altText };
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
        const post = { authorUrn: c.connection.externalAccountId ?? "", text: socialText(version), imageUrl: c.imageUrl ?? undefined, altText: c.imageUrl ? version.altText : undefined };
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
        const post = { userId: c.connection.externalAccountId ?? "", text: socialText(version) };
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
        const post = { pageId: c.connection.externalAccountId ?? "", message: caption, link: c.imageUrl ? undefined : version.destinationUrl, imageUrl: c.imageUrl ?? undefined };
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

/** Look up the provider before any retry of an uncertain write. */
export const reconcile = internalAction({
  args: { receiptId: v.id("actionReceipts") },
  handler: async (ctx, { receiptId }) => {
    const r = await ctx.runQuery(internal.publish.receipt, { receiptId });
    if (!r || r.status !== "uncertain" || !r.artifactId) return;
    const c = await ctx.runQuery(internal.publish.publishContext, { artifactId: r.artifactId });
    if (!c?.connection || !c.version) return;
    if (c.connection.isFixture) return;
    await freshConnection(ctx, c.connection);
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connection._id });
    if (!secret) return;
    const { accessToken } = JSON.parse(secret.value) as { accessToken: string };
    const caption = [c.version.body, c.version.hashtags.join(" ")].filter(Boolean).join("\n\n");
    const since = Math.floor(r.createdAt / 1000) - 300;
    let found: { outcome: "found"; externalId: string } | { outcome: "not_found" } | { outcome: "unknown"; providerMessage: string };
    if (c.provider === "instagram") {
      const containerId = r.externalId?.startsWith("container:") ? r.externalId.slice(10) : null;
      if (!containerId) return; // No container id recorded: needs operator review.
      found = await reconcilePublish({ accessToken, igUserId: c.connection.externalAccountId ?? "", containerId, caption });
    } else if (c.provider === "linkedin") {
      found = await reconcileLinkedInPost({ accessToken, authorUrn: c.connection.externalAccountId ?? "", text: socialText(c.version), postUrn: r.externalId });
    } else if (c.provider === "x") {
      found = await reconcileTweet({ accessToken, userId: c.connection.externalAccountId ?? "", text: socialText(c.version), tweetId: r.externalId, sinceMs: since * 1000 });
    } else {
      found = await reconcilePagePost({ accessToken, pageId: c.connection.externalAccountId ?? "", message: caption, sinceUnix: since });
    }
    if (found.outcome === "found") {
      await ctx.runMutation(internal.publish.finishReceipt, { receiptId, artifactId: r.artifactId as Id<"artifacts">, status: "verified", externalId: found.externalId, summary: "Confirmed on the platform after checking." });
    } else if (found.outcome === "not_found") {
      await ctx.runMutation(internal.publish.finishReceipt, { receiptId, artifactId: r.artifactId as Id<"artifacts">, status: "failed", summary: "Checked the platform: it wasn't posted. You can try again." });
    }
    // "unknown": stay uncertain; operators see it in /ops.
  },
});

export const receipt = internalQuery({
  args: { receiptId: v.id("actionReceipts") },
  handler: async (ctx, { receiptId }) => ctx.db.get(receiptId),
});
