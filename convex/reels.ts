import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { featureAllowed, requirePaid } from "./lib/access";
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
        createdAt: r.createdAt,
      })),
    );
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
      maxCostMicros: estimateJobMicros(planJob("reel", { images: 2 }, { fixture })),
      withClipsMicros: estimateJobMicros(planJob("reel", { images: 2, clips: 1 }, { fixture })),
      clipsUnlocked: await featureAllowed(ctx, org, "expert"),
    };
  },
});
