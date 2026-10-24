import { paginationOptsValidator } from "convex/server";
import { featureAllowed, requirePaid } from "./lib/access";
import { aiModeView, resolveAiMode } from "./lib/aiMode";
import { EXPERT_KINDS } from "../shared/agents/routes";
import { v } from "convex/values";

/** A running job's early output, filled in as it arrives (first take, channels that fit, chosen plays). */
export interface RunPreview {
  headline?: string;
  points?: string[];
  channels?: string[];
  budget?: string;
  plays?: { name: string; kind: string; p50: number; unit: string }[];
}
import { recordVoiceSample } from "./brand";
import { findingsFor, plannedSteps } from "../shared/progress";
import { buildManualExportPack, manualExportToCsv, type DraftPlatform } from "../shared/integrations/drafts";
import { contentHash } from "../shared/policy";
import { findRiskyClaims } from "../shared/ai/tasks";
import { localDate, thisWeekOf } from "../shared/autopilot";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { artifactStatusValidator, channelValidator } from "./schema";
import { createRunWithReservation, MAX_RETRIES } from "./engine";
import { audit } from "./lib/audit";
import { approvalProblem, DIRECT_PUBLISH, extendApprovalUntil, invalidateApprovals, publishTarget, recordArtifactDecision, refuseInCopilot, autonomyMode, SCHEDULE_GRACE_MS } from "./lib/approvals";
import { onOwnerDecision, onPublishOutcome } from "./lib/autopilot";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { imageUrlFor } from "./lib/media";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/** Read-only source set for the conversion/social audit; restricted to one tenant and confirmed published posts. */
export const auditPublishedSocial = internalQuery({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, limit }) => {
    const take = Math.max(1, Math.min(Math.floor(limit ?? 20), 30));
    const channels = ["linkedin", "instagram", "facebook", "x", "tiktok", "youtube", "pinterest"] as const;
    const posts = (await Promise.all(channels.map((channel) => ctx.db.query("artifacts")
      .withIndex("by_org_status_channel", (q) => q.eq("orgId", orgId).eq("status", "published").eq("channel", channel))
      .order("desc")
      .take(take)))).flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, take);
    const social = posts;
    return await Promise.all(social.map(async (post) => {
      const version = post.currentVersionId ? await ctx.db.get(post.currentVersionId) : null;
      return {
        artifactId: post._id,
        platform: post.channel,
        title: post.title.slice(0, 160),
        publishedAt: post.updatedAt,
        headline: version?.headline?.slice(0, 300) ?? "",
        body: (version?.body ?? "").slice(0, 1600),
        angle: version?.contentAngle?.slice(0, 240) ?? "",
        callToAction: version?.callToAction?.slice(0, 240) ?? "",
      };
    }));
  },
});

/** The honest label shown with a library image on a post. */
function assetPostLabel(a: Doc<"assets">): string {
  if (a.kind === "ai_image") return "AI-generated illustration";
  if (a.illustrative) return "Your product with sample data";
  if (a.kind === "screenshot") return "Screenshot of your website";
  if (a.kind === "product_photo") return "Your product photo";
  return "Your image";
}

async function versionView(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> }; db: { get: (id: Id<"users">) => Promise<Doc<"users"> | null> } },
  v: Doc<"artifactVersions">,
) {
  const editor = v.editedByUser ? await ctx.db.get(v.editedByUser) : null;
  return {
    editedByName: editor ? (editor.name ?? editor.email ?? "A teammate") : null,
    id: v._id,
    version: v.version,
    headline: v.headline ?? null,
    body: v.body,
    contentAngle: v.contentAngle ?? null,
    copyBrief: v.copyBrief ?? null,
    callToAction: v.callToAction ?? null,
    destinationUrl: v.destinationUrl ?? null,
    hashtags: v.hashtags,
    altText: v.altText ?? null,
    imageUrl: await imageUrlFor(ctx, v),
    imageLabel: v.imageLabel ?? null,
    imagePrompt: v.imagePrompt ?? null,
    unsupportedClaims: v.unsupportedClaims,
    claimFactIds: v.claimFactIds,
    editedByRole: v.editedByRole ?? null,
    editedByUser: v.editedByUser ?? null,
    createdAt: v.createdAt,
  };
}

export const list = query({
  args: {
    slug: v.string(),
    status: v.optional(artifactStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { slug, status, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const page = status
      ? await ctx.db
          .query("artifacts")
          .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db
          .query("artifacts")
          .withIndex("by_org_updated", (q) => q.eq("orgId", org._id))
          .order("desc")
          // "All" means active work: archived items have their own filter.
          .filter((q) => q.neq(q.field("status"), "archived"))
          .paginate(paginationOpts);
    const items = await Promise.all(
      page.page.map(async (a) => {
        const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
        return {
          id: a._id,
          kind: a.kind,
          channel: a.channel,
          title: a.title,
          status: a.status,
          scheduledFor: a.scheduledFor ?? null,
          createdByRole: a.createdByRole ?? null,
          updatedAt: a.updatedAt,
          preview: ver?.body.slice(0, 220) ?? "",
          hasImage: Boolean(ver?.imageStorageId || ver?.imageR2Key),
          flags: ver?.unsupportedClaims.length ?? 0,
        };
      }),
    );
    return { ...page, page: items };
  },
});

export const calendar = query({
  args: { slug: v.string(), from: v.number(), to: v.number() },
  handler: async (ctx, { slug, from, to }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (to - from > 62 * 86_400_000) throw appError("INVALID", "Pick a shorter date range.");
    const rows = await ctx.db
      .query("artifacts")
      .withIndex("by_org_scheduled", (q) => q.eq("orgId", org._id).gte("scheduledFor", from).lt("scheduledFor", to))
      .take(300);
    type CalendarItem = {
      id: string;
      artifactId: Id<"artifacts"> | null;
      slotId: Id<"calendarSlots"> | null;
      title: string;
      channel: string;
      status: string;
      scheduledFor: number;
      autopilot: boolean;
      autopilotStatus: string | null;
    };
    const events = new Map<string, CalendarItem>(rows.map((a) => [String(a._id), {
      id: String(a._id),
      artifactId: a._id,
      slotId: null as Id<"calendarSlots"> | null,
      title: a.title,
      channel: a.channel,
      status: a.status,
      scheduledFor: a.scheduledFor!,
      autopilot: false,
      autopilotStatus: null as string | null,
    }]));
    const slots = await ctx.db
      .query("calendarSlots")
      .withIndex("by_org_slot", (q) => q.eq("orgId", org._id).gte("slotAt", from).lt("slotAt", to))
      .take(300);
    for (const slot of slots) {
      if (slot.status === "skipped") continue;
      const linked = slot.artifactId ? await ctx.db.get(slot.artifactId) : null;
      const artifact = linked?.orgId === org._id ? linked : null;

      if (artifact && artifact.scheduledFor !== undefined && (artifact.scheduledFor < from || artifact.scheduledFor >= to)) {
        // A post may have been rescheduled since this slot was planned. Its actual schedule wins.
        continue;
      }
      const existing = artifact ? events.get(String(artifact._id)) : undefined;
      if (existing) {
        events.set(existing.id, { ...existing, slotId: slot._id, autopilot: true, autopilotStatus: slot.status });
        continue;
      }

      events.set(String(slot._id), {
        id: String(slot._id),
        artifactId: artifact?._id ?? null,
        slotId: slot._id,
        title: artifact?.title ?? slot.idea,
        channel: slot.channel,
        status: artifact?.status ?? slot.status,
        scheduledFor: artifact?.scheduledFor ?? slot.slotAt,
        autopilot: true,
        autopilotStatus: slot.status,
      });
    }
    return [...events.values()].sort((a, b) => a.scheduledFor - b.scheduledFor);
  },
});

/** Small calendar bootstrap query so calendar boundaries use the workspace's posting timezone. */
export const calendarTimezone = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    return org.timezone;
  },
});

export const get = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const versions = await ctx.db
      .query("artifactVersions")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .order("desc")
      .take(20);
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_subject", (q) => q.eq("subjectType", "artifact").eq("subjectId", a._id))
      .order("desc")
      .take(10);
    const receipts = await ctx.db
      .query("actionReceipts")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .order("desc")
      .take(50);
    const current = versions[0];
    const copyBriefFactIds = current?.copyBrief
      ? [...current.copyBrief.offerFactIds, ...current.copyBrief.proofFactIds, ...current.copyBrief.supportingFactIds]
      : [];
    const factIds = Array.from(new Set([...(current?.claimFactIds ?? []), ...copyBriefFactIds]));
    const facts = [];
    for (const id of factIds.slice(0, 40)) {
      const f = await ctx.db.get(id);
      if (!f || f.orgId !== org._id || f.businessId !== a.businessId) continue;
      const sources = await Promise.all(f.sourceIds.slice(0, 3).map((sourceId) => ctx.db.get(sourceId)));
      facts.push({
        id: f._id,
        statement: f.statement,
        reviewState: f.reviewState,
        category: f.category,
        confidence: f.confidence,
        provenance: f.provenance,
        verifiedAt: f.verifiedAt ?? null,
        sources: sources.flatMap((source) => source && source.orgId === org._id && source.businessId === a.businessId
          ? [{ kind: source.kind, url: source.url ?? null, title: source.title ?? null, excerpt: source.excerpt ?? null, fetchedAt: source.fetchedAt, expiresAt: source.expiresAt, expired: source.expiresAt < Date.now(), status: source.status }]
          : []),
      });
    }
    const target = DIRECT_PUBLISH[a.channel];
    const conn = target
      ? await ctx.db
          .query("connections")
          .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", target))
          .first()
      : null;
    const currentApproval = a.approvalId ? await ctx.db.get(a.approvalId) : null;
    const curVer = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const wordpressConnection = a.kind === "blog_post" && a.channel === "blog"
      ? await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "wordpress")).first()
      : null;
    const wordpressDrafts = a.kind === "blog_post" && a.channel === "blog"
      ? (await ctx.db.query("wordpressDraftOperations").withIndex("by_artifact", (q) => q.eq("artifactId", a._id)).order("desc").take(5))
        .filter((row) => row.orgId === org._id)
        .map((row) => ({ id: row._id, status: row.status, summary: row.summary, externalPostId: row.externalPostId ?? null, editUrl: row.editUrl ?? null, createdAt: row.createdAt }))
      : [];
    const slot = await ctx.db
      .query("calendarSlots")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .first();
    const reel = a.reelId ? await ctx.db.get(a.reelId) : null;
    return {
      id: a._id,
      kind: a.kind,
      channel: a.channel,
      title: a.title,
      status: a.status,
      scheduledFor: a.scheduledFor ?? null,
      lastPublishError: a.lastPublishError ?? null,
      /** Why the current approval can't be used to publish (null when it can). */
      approvalProblem: a.status === "approved" || a.status === "scheduled" ? approvalProblem(currentApproval, curVer, conn?.status === "connected" ? conn : null) : null,
      autopilotSlot: slot && slot.status !== "skipped" ? { slotAt: slot.slotAt, status: slot.status } : null,
      reel: reel ? { id: reel._id, status: reel.status, videoUrl: reel.videoStorageId ? await ctx.storage.getUrl(reel.videoStorageId) : null, seconds: reel.seconds ?? null } : null,
      createdByRole: a.createdByRole ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      current: versions[0] ? await versionView(ctx as never, versions[0]) : null,
      versions: await Promise.all(versions.map((ver) => versionView(ctx as never, ver))),
      campaignIds: (
        await ctx.db
          .query("campaigns")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .take(200)
      )
        .filter((c) => c.artifactId === a._id)
        .map((c) => c._id),
      approvals: approvals.map((ap) => ({
        id: ap._id,
        status: ap.status,
        expiresAt: ap.expiresAt,
        decidedAt: ap.decidedAt ?? null,
        invalidatedReason: ap.invalidatedReason ?? null,
        contentHash: ap.contentHash,
        actionKind: ap.actionKind,
        destination: ap.scope.destination ?? null,
        isCurrent: ap.contentHash === versions[0]?.contentHash,
      })),
      receipts: receipts.map((r) => ({ id: r._id, provider: r.provider, action: r.action, status: r.status, externalId: r.externalId ?? null, summary: r.summary, createdAt: r.createdAt })),
      facts,
      wordpressConnection: wordpressConnection?.status === "connected"
        ? { accountLabel: wordpressConnection.accountLabel ?? null, siteUrl: wordpressConnection.externalAccountId ?? null }
        : null,
      wordpressDrafts,
      /** Copilot mode: the owner posts it themselves from the export pack. */
      copilot: (await autonomyMode(ctx, org._id)) === "copilot",
      publishTarget: target
        ? {
            provider: target,
            connected: conn?.status === "connected",
            isFixture: conn?.isFixture ?? false,
            accountLabel: conn?.accountLabel ?? null,
          }
        : null,
      canEdit: ["owner", "admin", "editor"].includes(role),
      canApprove: ["owner", "admin", "reviewer"].includes(role),
      isDemo: org.kind === "demo",
    };
  },
});

/** Editing creates a new version. Any material change invalidates existing approvals. */
export const edit = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    title: v.optional(v.string()),
    headline: v.optional(v.string()),
    body: v.string(),
    contentAngle: v.optional(v.string()),
    callToAction: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    hashtags: v.array(v.string()),
    altText: v.optional(v.string()),
    removeImage: v.optional(v.boolean()),
    /** Use this image from the asset library (replaces any current image). */
    imageAssetId: v.optional(v.id("assets")),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "draft");
    if (["publishing", "published"].includes(a.status)) throw appError("INVALID", "Published content can't be edited. Duplicate it instead.");
    if (a.status === "uncertain") throw appError("INVALID", "Check whether it was posted first, then edit it.");
    const pendingWordPressDraft = await ctx.db.query("wordpressDraftOperations").withIndex("by_artifact", (q) => q.eq("artifactId", a._id)).order("desc").take(5);
    if (pendingWordPressDraft.some((operation) => operation.orgId === org._id && operation.status === "pending")) throw appError("INVALID", "A WordPress draft request is still running. Wait for its result before editing this article.");
    const prev = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const body = args.body.trim().slice(0, 20_000);
    if (!body) throw appError("INVALID", "The text can't be empty.");
    if (args.destinationUrl && !/^https:\/\//i.test(args.destinationUrl.trim())) {
      throw appError("INVALID", "Links must start with https://");
    }
    const asset = args.imageAssetId ? assertSameOrg(await ctx.db.get(args.imageAssetId), org._id, "image") : null;
    if (asset && (asset.archived || (!asset.storageId && !asset.r2Key))) throw appError("INVALID", "That image isn't available any more. Pick another.");
    const imageStorageId = asset ? asset.storageId : args.removeImage ? undefined : prev?.imageStorageId;
    const imageR2Key = asset ? asset.r2Key : args.removeImage ? undefined : prev?.imageR2Key;
    const imageLabel = asset ? assetPostLabel(asset) : imageStorageId || imageR2Key ? prev?.imageLabel : undefined;
    // Re-run the same deterministic claim screen after every owner edit. An
    // edit is not evidence that a performance, guarantee, scale or medical
    // claim has become supportable; stale warnings must not disappear silently.
    const unsupportedClaims = findRiskyClaims([
      args.title,
      args.headline,
      body,
      args.callToAction,
      args.altText,
      ...args.hashtags,
    ].filter(Boolean).join(" "))
      .map((claim) => `Check claim: "${claim}"`);
    const ch = await contentHash({
      headline: args.headline,
      body,
      contentAngle: args.contentAngle ?? prev?.contentAngle,
      copyBrief: prev?.copyBrief,
      callToAction: args.callToAction,
      destinationUrl: args.destinationUrl,
      hashtags: args.hashtags,
      altText: args.altText,
      imageRef: imageR2Key ?? imageStorageId,
      channel: a.channel,
    });
    if (prev && prev.contentHash === ch && (!args.title || args.title === a.title)) return { changed: false };
    const version = a.currentVersion + 1;
    const now = Date.now();
    const versionId = await ctx.db.insert("artifactVersions", {
      orgId: org._id,
      artifactId: a._id,
      version,
      headline: args.headline?.slice(0, 500),
      body,
      contentAngle: (args.contentAngle ?? prev?.contentAngle)?.slice(0, 500),
      copyBrief: prev?.copyBrief,
      callToAction: args.callToAction?.slice(0, 120),
      destinationUrl: args.destinationUrl?.trim(),
      hashtags: args.hashtags.slice(0, 30).map((h) => h.slice(0, 60)),
      altText: args.altText?.slice(0, 1000),
      imageStorageId,
      imageR2Key,
      imagePrompt: asset ? undefined : prev?.imagePrompt,
      imageLabel,
      claimFactIds: prev?.claimFactIds ?? [],
      unsupportedClaims,
      contentHash: ch,
      editedByUser: user._id,
      createdAt: now,
    });
    // Voice learning: the owner rewrote an AI draft.
    if (prev && !prev.editedByUser && prev.body !== body) await recordVoiceSample(ctx, org._id, a.channel, prev.body, body);
    await invalidateApprovals(ctx, a._id, "Edited after approval");
    await ctx.db.patch(a._id, {
      title: args.title?.trim().slice(0, 140) || a.title,
      currentVersionId: versionId,
      currentVersion: version,
      status: a.status === "archived" ? "archived" : "in_review",
      updatedAt: now,
    });
    // An edited autopilot post no longer goes out at its slot until it's approved again.
    const slot = await ctx.db
      .query("calendarSlots")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .first();
    if (slot && slot.status === "scheduled") await ctx.db.patch(slot._id, { status: "needs_approval", updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.edited", subjectType: "artifact", subjectId: a._id, summary: `Edited "${a.title}" (v${version}). Any earlier approval no longer applies.` });
    return { changed: true, version };
  },
});

/** Approve or reject the CURRENT version. The approval binds to its content hash, destination and policy. */
export const decide = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "draft");
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver) throw appError("INVALID", "Nothing to approve yet.");
    if (a.status === "uncertain") throw appError("INVALID", "Check whether it was posted first.");
    if (!["draft", "in_review", "failed", "approved"].includes(a.status)) throw appError("INVALID", "This can't be approved or sent back in its current state.");
    const { connection } = await publishTarget(ctx, org._id, a.channel);
    if (a.status === "approved" && !approvalProblem(a.approvalId ? await ctx.db.get(a.approvalId) : null, ver, connection)) {
      throw appError("INVALID", "This version is already approved.");
    }
    // Instagram can't take a text-only post (demo publishing is simulated, so it's exempt).
    if (args.decision === "approve" && a.channel === "instagram" && org.kind !== "demo" && !ver.imageStorageId && !ver.imageR2Key && !a.reelId) {
      throw appError("INVALID", "Instagram posts need an image. Add one in the editor first.");
    }
    const approvalId = await recordArtifactDecision(ctx, { org, artifact: a, version: ver, decision: args.decision, decidedBy: user._id, note: args.note });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `content.${args.decision}d`, subjectType: "artifact", subjectId: a._id, summary: `${args.decision === "approve" ? "Approved" : "Sent back"} "${a.title}" (v${ver.version}).` });
    // Autopilot slots: approving schedules the post for its planned time; decisions feed the trust ladder.
    const slot = await onOwnerDecision(ctx, { org, artifactId: a._id, decision: args.decision, edited: ver.version > 1 && Boolean(ver.editedByUser), userId: user._id });
    return { approvalId, slot };
  },
});

/** Refuse to schedule or publish on an approval the executor would reject (expired, edited, or made before connecting). */
async function requireUsableApproval(ctx: MutationCtx, org: Doc<"organizations">, a: Doc<"artifacts">) {
  const { connection } = await publishTarget(ctx, org._id, a.channel);
  if (!connection) throw appError("INVALID", "Connect the account first, or use the export pack.");
  const problem = approvalProblem(a.approvalId ? await ctx.db.get(a.approvalId) : null, a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null, connection);
  if (problem) throw appError("INVALID", problem);
}

/**
 * Schedule an approved item. "Scheduled in ClimbOS" is distinct from
 * "Accepted by platform": the provider receipt is recorded only after publishing.
 */
export const schedule = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), when: v.number() },
  handler: async (ctx, { slug, artifactId, when }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    await requirePaid(ctx, org, "publishing");
    await refuseInCopilot(ctx, org._id, "post");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "approved" && a.status !== "scheduled") throw appError("INVALID", "Approve this before scheduling it.");
    if (when < Date.now() + 60_000) throw appError("INVALID", "Pick a time at least a minute from now.");
    if (when > Date.now() + 90 * 86_400_000) throw appError("INVALID", "Schedule within the next 90 days.");
    await requireUsableApproval(ctx, org, a);
    // Approvals expire after a few days: a post scheduled further out keeps its approval until it goes.
    if (!(await extendApprovalUntil(ctx, a, when + SCHEDULE_GRACE_MS))) throw appError("INVALID", "The approval expired. Approve it again first.");
    await ctx.db.patch(a._id, { status: "scheduled", scheduledFor: when, lastPublishError: undefined, updatedAt: Date.now() });
    const slot = await ctx.db.query("calendarSlots").withIndex("by_artifact", (q) => q.eq("artifactId", a._id)).first();
    if (slot && slot.orgId === org._id) {
      const local = localDate(when, org.timezone);
      await ctx.db.patch(slot._id, { slotAt: when, weekOf: thisWeekOf(when, org.timezone), day: local.weekday, updatedAt: Date.now() });
    }
    await ctx.scheduler.runAt(when, internal.publish.scheduledPublish, { artifactId, expectedScheduledFor: when });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.scheduled", subjectType: "artifact", subjectId: a._id, summary: `Scheduled "${a.title}" in ClimbOS for ${new Date(when).toISOString()}.` });
  },
});

export const unschedule = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "scheduled") return;
    await ctx.db.patch(a._id, { status: "approved", scheduledFor: undefined, updatedAt: Date.now() });
  },
});

export const publishNow = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    await requirePaid(ctx, org, "publishing");
    await refuseInCopilot(ctx, org._id, "post");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "approved" && a.status !== "scheduled") throw appError("INVALID", "Approve this first.");
    if (org.emergencyStop?.active) throw appError("PAUSED", "All activity is paused. Resume activity first.");
    await requireUsableApproval(ctx, org, a);
    await ctx.db.patch(a._id, { status: "publishing", lastPublishError: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.publish.publishArtifact, { artifactId, requestedBy: user._id });
  },
});

export const archive = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status === "publishing") throw appError("INVALID", "It's being sent right now. Wait for the result, then archive it.");
    if (a.status === "uncertain") throw appError("INVALID", "Check whether it was posted first, then archive it.");
    await invalidateApprovals(ctx, a._id, "Archived");
    await ctx.db.patch(a._id, { status: "archived", scheduledFor: undefined, updatedAt: Date.now() });
    // Its autopilot slot won't post either.
    const slot = await ctx.db
      .query("calendarSlots")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .first();
    if (slot && slot.status !== "published") await ctx.db.patch(slot._id, { status: "skipped", updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.archived", subjectType: "artifact", subjectId: a._id, summary: `Archived "${a.title}".` });
  },
});

/** Manual export pack for platforms without a verified integration (or when not connected). */
export const exportPack = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver) return null;
    const imageUrl = await imageUrlFor(ctx, ver);
    const reel = a.reelId ? await ctx.db.get(a.reelId) : null;
    const videoUrl = reel?.videoStorageId ? await ctx.storage.getUrl(reel.videoStorageId) : null;
    const social: DraftPlatform[] = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"];
    // A reel goes to every short-video platform from one export.
    const platforms = reel ? (["instagram", "tiktok", "youtube"] as DraftPlatform[]) : (social as string[]).includes(a.channel) ? [a.channel as DraftPlatform] : (["linkedin", "x", "facebook"] as DraftPlatform[]);
    const media = [videoUrl, imageUrl].filter((u): u is string => Boolean(u));
    const pack = buildManualExportPack(
      { title: a.title, text: [ver.headline, ver.body].filter(Boolean).join("\n\n"), hashtags: ver.hashtags, altText: ver.altText, link: ver.destinationUrl, mediaUrls: media },
      platforms,
    );
    // Free accounts: exports carry a small "Made with ClimbOS" line (removed on packages).
    const badge = (await featureAllowed(ctx, org, "no_badge")) ? null : "Made with ClimbOS · climbos.app";
    const csv = manualExportToCsv(pack);
    return { pack: badge ? { ...pack, badge } : pack, csv: badge ? `${csv}# ${badge}\r\n` : csv, badge };
  },
});

export const markExported = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const now = Date.now();
    await ctx.db.insert("actionReceipts", {
      orgId: org._id,
      artifactId: a._id,
      provider: "manual",
      action: "export",
      idempotencyKey: `${org._id}:export:${a._id}:v${a.currentVersion}`,
      status: "exported",
      summary: "Copied or downloaded for manual posting. ClimbOS can't confirm whether it was posted.",
      createdAt: now,
    });
    await ctx.db.patch(a._id, { status: "exported", updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.exported", subjectType: "artifact", subjectId: a._id, summary: `Exported "${a.title}" for manual posting.` });
  },
});

/** Start a content job (social, ads, email, SEO) with a visible cost estimate already shown in the UI. */
export const generate = mutation({
  args: {
    slug: v.string(),
    job: v.union(v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo")),
    channel: v.optional(channelValidator),
    quantity: v.optional(v.number()),
    images: v.optional(v.number()),
    brief: v.optional(v.string()),
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const aiMode = await resolveAiMode(ctx, org, args.job, args.aiMode);
    const plan = planJob(args.job, { quantity: args.quantity, images: args.images, channel: args.channel }, { fixture: org.kind === "demo", mode: aiMode });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { channel: args.channel, quantity: args.quantity, images: args.images },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: org.kind === "demo",
      aiMode,
    });
    await ctx.scheduler.runAfter(0, internal.jobs.createContent, {
      runId,
      job: args.job,
      channel: args.channel,
      quantity: args.quantity,
      images: args.images,
      brief: args.brief?.slice(0, 1500),
    });
    return { runId };
  },
});

export const estimate = query({
  args: {
    slug: v.string(),
    job: v.union(v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo")),
    quantity: v.optional(v.number()),
    images: v.optional(v.number()),
    channel: v.optional(channelValidator),
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
  },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "view");
    const view = await aiModeView(ctx, org);
    const mode = EXPERT_KINDS.has(args.job) && view.expertUnlocked ? (args.aiMode ?? view.mode) : "basic";
    const plan = planJob(args.job, { quantity: args.quantity, images: args.images, channel: args.channel }, { fixture: org.kind === "demo", mode });
    return { title: plan.title, roles: plan.roles, maxCostMicros: estimateJobMicros(plan), meters: plan.meters, aiMode: mode, expertUnlocked: view.expertUnlocked, expertApplies: EXPERT_KINDS.has(args.job) };
  },
});

export const runStatus = query({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "job");
    const steps = await ctx.db
      .query("workflowSteps")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(30);
    const parse = (o?: string) => {
      if (!o) return null;
      try {
        return JSON.parse(o) as unknown;
      } catch {
        return null;
      }
    };
    return {
      id: run._id,
      title: run.title,
      kind: run.kind,
      engine: run.engine ?? null,
      status: run.status,
      roles: run.roles,
      userMessage: run.userMessage ?? null,
      estimateMicros: run.estimateMicros,
      actualMicros: run.actualMicros,
      isFixture: run.isFixture,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt ?? null,
      /** Quick first take while the full job works. */
      preview: (() => {
        try {
          return run.preview ? (JSON.parse(run.preview) as RunPreview) : null;
        } catch {
          return null;
        }
      })(),
      /** A stopped run can continue from its last finished step. */
      canRetry: run.status === "failed" && Boolean(run.resumeWith) && (run.retries ?? 0) < MAX_RETRIES && !steps.some((s) => s.status === "uncertain"),
      planned: plannedSteps(run.kind, run.engine, { website: steps.length === 0 || steps.some((s) => s.label === "Read your website") }),
      steps: steps.map((s) => ({
        label: s.label,
        status: s.status,
        role: s.role ?? null,
        kind: s.kind,
        startedAt: s.startedAt ?? null,
        finishedAt: s.finishedAt ?? null,
        model: s.model ?? null,
        findings: s.status === "succeeded" ? findingsFor(s.label, parse(s.output)) : [],
      })),
    };
  },
});

/** Drafts created by a specific job (for "See the drafts" links after a run). */
export const byRun = query({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("artifacts")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .take(50);
    return rows.filter((a) => a.orgId === org._id).map((a) => ({ id: a._id, title: a.title, channel: a.channel, status: a.status }));
  },
});

/**
 * The owner checked the platform after an "Outcome uncertain" result. Recorded
 * as an owner confirmation (not a provider receipt) and never re-sends.
 */
export const resolveUncertain = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), outcome: v.union(v.literal("posted"), v.literal("not_posted")) },
  handler: async (ctx, { slug, artifactId, outcome }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "uncertain") throw appError("INVALID", "This item isn't marked uncertain.");
    const now = Date.now();
    const receipts = (
      await ctx.db
        .query("actionReceipts")
        .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
        .order("desc")
        .take(50)
    ).filter((r) => r.status === "uncertain");
    for (const r of receipts) {
      await ctx.db.patch(r._id, {
        status: outcome === "posted" ? "verified" : "failed",
        summary: outcome === "posted" ? "Confirmed by the owner after checking the platform." : "Owner checked the platform: it wasn't posted.",
        verifiedAt: outcome === "posted" ? now : undefined,
      });
    }
    // "Not posted" marks it failed: approving it again is a deliberate new attempt (a new approval means a new receipt key).
    await ctx.db.patch(a._id, { status: outcome === "posted" ? "published" : "failed", updatedAt: now });
    if (outcome === "posted" && a.approvalId) await ctx.db.patch(a.approvalId, { status: "consumed" });
    await onPublishOutcome(ctx, a._id, outcome === "posted" ? "published" : "failed");
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.uncertain_resolved", subjectType: "artifact", subjectId: a._id, summary: `Owner marked "${a.title}" as ${outcome === "posted" ? "posted" : "not posted"}.` });
  },
});

export const unarchive = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status === "archived") await ctx.db.patch(a._id, { status: "draft", updatedAt: Date.now() });
  },
});

/** First win (after the first plan): 3 social posts on the best-fit channel + 1 welcome email, if credits allow. */
export const startFirstWin = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, { orgId, userId }) => {
    const org = await ctx.db.get(orgId);
    if (!org || org.kind === "demo" || org.firstWinRunIds?.length) return;
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
    const b2b = /saas|b2b|agency|services|consult|software/i.test(business?.businessType ?? "");
    const channel = b2b ? "linkedin" : "instagram";
    const runIds: Id<"workflowRuns">[] = [];
    const jobs: { job: "content_social" | "content_email"; quantity?: number; channel?: "linkedin" | "instagram" | "email"; brief: string }[] = [
      { job: "content_social", quantity: 3, channel, brief: "First posts from the new growth plan: introduce what makes the business different, one customer problem it solves, and one clear next step." },
      { job: "content_email", channel: "email", brief: "A short welcome email for new subscribers or customers based on the growth plan." },
    ];
    for (const j of jobs) {
      try {
        // Instagram can't post without an image, so its first posts come with one.
        const images = j.channel === "instagram" ? 1 : 0;
        const plan = planJob(j.job, { quantity: j.quantity, images, channel: j.channel });
        const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: j.job === "content_social" ? "Your first 3 posts" : "Your welcome email", roles: plan.roles, input: { firstWin: true, channel: j.channel }, steps: plan.steps, meters: plan.meters, createdBy: userId, isFixture: false });
        await ctx.scheduler.runAfter(0, internal.jobs.createContent, { runId, job: j.job, channel: j.channel, quantity: j.quantity, images, brief: j.brief });
        runIds.push(runId);
      } catch {
        // Not enough credits or too many jobs at once: skip quietly; the owner can draft from Content.
      }
    }
    if (runIds.length) await ctx.db.patch(orgId, { firstWinRunIds: runIds });
  },
});
