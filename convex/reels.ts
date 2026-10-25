import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { contentHash } from "../shared/policy";
import { featureAllowed, requirePaid } from "./lib/access";
import { invalidateApprovals } from "./lib/approvals";
import { audit } from "./lib/audit";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { r2SignedUrl } from "./lib/r2";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Reels: short vertical videos made from the business's own screenshots,
 * product photos and uploads (plus a couple of generated images when
 * needed), rendered by our own worker. Free accounts carry a small
 * "Made with ClimbOS" badge.
 */

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("reels").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(30);
    return Promise.all(
      rows.map(async (r) => ({
        id: r._id,
        title: r.title,
        status: r.status,
        runId: r.runId ?? null,
        seconds: r.seconds ?? null,
        caption: r.caption ?? null,
        badge: r.badge,
        error: r.error ?? null,
        url: r.videoStorageId ? await ctx.storage.getUrl(r.videoStorageId) : null,
        artifactId: r.artifactId ?? null,
        isDemo: Boolean(r.isDemo),
        createdAt: r.createdAt,
      })),
    );
  },
});

/** A finished reel becomes a post (kind video_script), so it goes through approval and export like any post. */
export const createPost = internalMutation({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => {
    const reel = await ctx.db.get(reelId);
    if (!reel || reel.artifactId || reel.status !== "ready") return;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", reel.orgId))
      .first();
    if (!business) return;
    const now = Date.now();
    const body = (reel.caption ?? reel.brief).slice(0, 2200);
    // Reels go out from the export pack (download the video, post it), so they use a channel with no direct publishing.
    const channel = "tiktok" as const;
    const artifactId = await ctx.db.insert("artifacts", {
      orgId: reel.orgId,
      businessId: business._id,
      kind: "video_script",
      channel,
      title: `Reel: ${reel.title}`.slice(0, 140),
      status: "in_review",
      currentVersion: 1,
      createdByRole: "creative_director",
      createdBy: reel.createdBy,
      runId: reel.runId,
      reelId: reel._id,
      createdAt: now,
      updatedAt: now,
    });
    const versionId = await ctx.db.insert("artifactVersions", {
      orgId: reel.orgId,
      artifactId,
      version: 1,
      body,
      hashtags: [],
      claimFactIds: [],
      unsupportedClaims: [],
      // Bound to the exact video, so a different render needs a new approval.
      contentHash: await contentHash({ body, hashtags: [], imageRef: reel.videoStorageId ? `reel:${reel.videoStorageId}` : `reel:${reel._id}`, channel }),
      editedByRole: "creative_director",
      createdAt: now,
    });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    await ctx.db.patch(reel._id, { artifactId, updatedAt: now });
  },
});

/** Delete a reel and its video. Its post is archived (anything already posted stays on the platform). */
export const remove = mutation({
  args: { slug: v.string(), reelId: v.id("reels") },
  handler: async (ctx, { slug, reelId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const reel = assertSameOrg(await ctx.db.get(reelId), org._id, "reel");
    if (reel.status === "working") throw appError("INVALID", "It's still being made. Delete it when it's done.");
    const post = reel.artifactId ? await ctx.db.get(reel.artifactId) : null;
    if (post && ["publishing", "uncertain"].includes(post.status)) throw appError("INVALID", "Its post is being sent. Wait for the result first.");
    if (post && post.status !== "archived") {
      await invalidateApprovals(ctx, post._id, "Reel deleted");
      await ctx.db.patch(post._id, { status: "archived", scheduledFor: undefined, updatedAt: Date.now() });
    }
    if (reel.videoStorageId) await ctx.storage.delete(reel.videoStorageId).catch(() => undefined);
    await ctx.db.delete(reel._id);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reel.deleted", subjectType: "reel", subjectId: reel._id, summary: `Deleted the reel "${reel.title}".` });
  },
});

/** Start a reel from a brief; optionally pick which of your images to use. */
export const create = mutation({
  args: { slug: v.string(), brief: v.string(), assetIds: v.optional(v.array(v.id("assets"))), clips: v.optional(v.number()) },
  handler: async (ctx, { slug, brief, assetIds, clips: wanted }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const clips = Math.max(0, Math.min(Math.round(wanted ?? 0), 2));
    // AI video clips use a premium model: packages only (same lock as Climb AI Expert).
    if (clips > 0) await requirePaid(ctx, org, "expert");
    const text = brief.trim().slice(0, 600);
    if (text.length < 4) throw appError("INVALID", "Say what the reel is about.");
    for (const id of assetIds ?? []) assertSameOrg(await ctx.db.get(id), org._id, "image");
    const plan = planJob("reel", { images: 2, clips }, { fixture: org.kind === "demo" });
    const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: plan.title, roles: plan.roles, input: { brief: text }, steps: plan.steps, meters: plan.meters, createdBy: user._id, isFixture: org.kind === "demo" });
    const now = Date.now();
    const reelId = await ctx.db.insert("reels", { orgId: org._id, title: text.slice(0, 80), brief: text, status: "working", runId, scenes: [], badge: !(await featureAllowed(ctx, org, "no_badge")), clips, createdBy: user._id, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.jobs.makeReel, { runId, reelId, assetIds: (assetIds ?? []).slice(0, 8) });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reel.started", subjectType: "reel", subjectId: reelId, summary: `Started a reel: ${text.slice(0, 80)}` });
    return { reelId, runId };
  },
});

/** Images the reel can use, with fetchable URLs for the renderer. */
export const assetsFor = internalQuery({
  args: { orgId: v.id("organizations"), assetIds: v.array(v.id("assets")) },
  handler: async (ctx, { orgId, assetIds }) => {
    const picked = (await Promise.all(assetIds.map((id) => ctx.db.get(id)))).filter((a) => a && a.orgId === orgId && !a.archived);
    const recent = picked.length ? [] : (await ctx.db.query("assets").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").take(40)).filter((a) => !a.archived && a.kind !== "logo");
    const rows = [...picked, ...recent].slice(0, 16);
    const out: { id: Id<"assets">; label: string; kind: string; url: string }[] = [];
    for (const a of rows) {
      if (!a) continue;
      const url = a.r2Key ? await r2SignedUrl(a.r2Key, 3600) : a.storageId ? await ctx.storage.getUrl(a.storageId) : null;
      if (url) out.push({ id: a._id, label: a.label, kind: a.kind, url });
    }
    return out;
  },
});

export const save = internalMutation({
  args: { reelId: v.id("reels"), patch: v.any() },
  handler: async (ctx, { reelId, patch }) => {
    await ctx.db.patch(reelId, { ...(patch as object), updatedAt: Date.now() });
  },
});

export const videoUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});

export const get = internalQuery({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => ctx.db.get(reelId),
});

/** Credits a reel can use at most (shown before starting). */
export const estimate = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const fixture = org.kind === "demo";
    return {
      maxCostMicros: estimateJobMicros(planJob("reel", { images: 2 }, { fixture }), { fixture }),
      withClipsMicros: estimateJobMicros(planJob("reel", { images: 2, clips: 1 }, { fixture }), { fixture }),
      clipsUnlocked: await featureAllowed(ctx, org, "expert"),
    };
  },
});
