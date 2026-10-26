import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import type { LandingContent } from "../shared/landing";

/**
 * Spec §8: after a design change, capture the ClimbOS-hosted draft on desktop and mobile so
 * the owner sees the changed page, not only the original site. The draft is served once, by
 * a short-lived random token, to the render worker; it is never published by this flow.
 */

const TOKEN_TTL_MS = 10 * 60_000;
const MAX_SHOT_B64 = 4_000_000;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Owner or editor asks for a fresh desktop and mobile capture of one exact saved draft version. */
export const request = mutation({
  args: { slug: v.string(), id: v.id("landingPages"), expectedVersion: v.number() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const page = assertSameOrg(await ctx.db.get(args.id), org._id, "page");
    const version = page.version ?? 0;
    if (!page.content || page.status === "drafting") throw appError("INVALID", "Wait until the page draft is written before capturing it.");
    if (version !== args.expectedVersion) throw appError("INVALID", "The page changed. Save or review the current version first.");
    const recent = await ctx.db.query("landingDraftRenders").withIndex("by_page_requested", (q) => q.eq("pageId", page._id)).order("desc").take(1);
    if (recent[0]?.status === "pending" && recent[0].expiresAt > Date.now()) throw appError("INVALID", "A capture of this page is already running.");
    const now = Date.now();
    const renderId = await ctx.db.insert("landingDraftRenders", { orgId: org._id, pageId: page._id, version, status: "pending", token: randomToken(), expiresAt: now + TOKEN_TTL_MS, requestedBy: user._id, requestedAt: now, shots: [] });
    await ctx.scheduler.runAfter(0, internal.landingRenders.capture, { renderId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "landing.draft_render_requested", subjectType: "landingPage", subjectId: page._id, summary: `Asked for desktop and mobile captures of landing draft version ${version}.` });
    return renderId;
  },
});

/** Read by the token-gated draft route only; returns the exact version, never the live page. */
export const draftByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    const render = await ctx.db.query("landingDraftRenders").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (!render || render.status !== "pending" || render.expiresAt < Date.now()) return null;
    const saved = await ctx.db.query("landingPageVersions").withIndex("by_page_version", (q) => q.eq("pageId", render.pageId).eq("version", render.version)).first();
    const page = await ctx.db.get(render.pageId);
    const content = saved?.content ?? (page?.version === render.version ? page.content : undefined);
    if (!page || !content) return null;
    const org = await ctx.db.get(render.orgId);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", render.orgId)).first();
    return { name: business?.name ?? org?.name ?? "", website: business?.website ?? null, color: saved?.color ?? page.color, content: JSON.parse(content) as LandingContent, version: render.version };
  },
});

export const pending = internalQuery({
  args: { renderId: v.id("landingDraftRenders") },
  handler: async (ctx, { renderId }) => {
    const r = await ctx.db.get(renderId);
    return r && r.status === "pending" && r.token ? { token: r.token, expiresAt: r.expiresAt } : null;
  },
});

export const finish = internalMutation({
  args: {
    renderId: v.id("landingDraftRenders"),
    shots: v.array(v.object({ view: v.union(v.literal("desktop"), v.literal("mobile")), storageId: v.id("_storage"), width: v.number(), height: v.number() })),
    capturedAt: v.number(),
  },
  handler: async (ctx, { renderId, shots, capturedAt }) => {
    const r = await ctx.db.get(renderId);
    if (!r || r.status !== "pending") {
      for (const s of shots) await ctx.storage.delete(s.storageId).catch(() => undefined);
      return;
    }
    // The token is single-use: clearing it closes the draft route for this capture.
    await ctx.db.patch(renderId, { status: shots.length ? "captured" : "unavailable", token: undefined, shots, capturedAt });
  },
});

export const capture = internalAction({
  args: { renderId: v.id("landingDraftRenders") },
  handler: async (ctx, { renderId }) => {
    const job = await ctx.runQuery(internal.landingRenders.pending, { renderId });
    if (!job) return;
    const secret = process.env.CLIMBOS_SERVER_SECRET;
    const site = (process.env.SITE_URL ?? "https://climbos.app").replace(/\/$/, "");
    const worker = (process.env.RENDER_WORKER_URL ?? site).replace(/\/$/, "");
    const shots: { view: "desktop" | "mobile"; storageId: Id<"_storage">; width: number; height: number }[] = [];
    if (secret) {
      try {
        const response = await fetch(`${worker}/api/render/capture`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-climbos-secret": secret },
          body: JSON.stringify({ url: `${site}/render/landing-draft/${job.token}`, sections: 0 }),
          signal: AbortSignal.timeout(85_000),
        });
        const raw = response.ok ? await response.text() : "";
        const result = raw && raw.length < 12_000_000 ? (JSON.parse(raw) as { shots?: { kind?: string; width?: number; height?: number; png?: string }[] }) : {};
        for (const shot of result.shots ?? []) {
          if ((shot.kind !== "desktop" && shot.kind !== "mobile") || typeof shot.png !== "string" || shot.png.length < 100 || shot.png.length > MAX_SHOT_B64 || !/^[A-Za-z0-9+/=]+$/.test(shot.png)) continue;
          const binary = atob(shot.png);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const storageId = await ctx.storage.store(new Blob([bytes], { type: "image/png" }));
          const width = Number.isSafeInteger(shot.width) && (shot.width ?? 0) > 0 ? shot.width! : shot.kind === "desktop" ? 1440 : 390;
          const height = Number.isSafeInteger(shot.height) && (shot.height ?? 0) > 0 ? shot.height! : shot.kind === "desktop" ? 900 : 844;
          shots.push({ view: shot.kind, storageId, width, height });
        }
      } catch {
        // Recorded as unavailable below; the owner can try again.
      }
    }
    await ctx.runMutation(internal.landingRenders.finish, { renderId, shots, capturedAt: Date.now() });
  },
});

/** Recent captures of this page's drafts, newest first, labelled with the exact version they show. */
export const list = query({
  args: { slug: v.string(), id: v.id("landingPages") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const page = assertSameOrg(await ctx.db.get(id), org._id, "page");
    const rows = await ctx.db.query("landingDraftRenders").withIndex("by_page_requested", (q) => q.eq("pageId", page._id)).order("desc").take(5);
    return Promise.all(rows.map(async (r) => ({
      id: r._id,
      version: r.version,
      status: r.status === "pending" && r.expiresAt < Date.now() ? ("unavailable" as const) : r.status,
      requestedAt: r.requestedAt,
      capturedAt: r.capturedAt ?? null,
      shots: await Promise.all(r.shots.map(async (s) => ({ view: s.view, width: s.width, height: s.height, url: await ctx.storage.getUrl(s.storageId) }))),
    })));
  },
});
