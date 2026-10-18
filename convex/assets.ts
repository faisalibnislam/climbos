import { v } from "convex/values";
import { productLinks, productsFromHtml, safePublicUrl, type FoundProduct } from "../shared/net/safeUrl";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { planJob } from "./lib/jobPlans";
import { audit } from "./lib/audit";
import { r2Configured, r2Key, r2Put, r2SignedUrl } from "./lib/r2";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Real visuals: the asset library posts and designs draw from. Real website
 * screenshots (captured by ClimbOS's own render worker), real product photos
 * from the store, the owner's uploads, AI images and edits of any of these.
 */

const DAILY_JOBS = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type AssetKind = Doc<"assets">["kind"];
const kindValidator = v.union(v.literal("screenshot"), v.literal("product_photo"), v.literal("upload"), v.literal("logo"), v.literal("ai_image"), v.literal("edited"), v.literal("design"));

export async function urlOf(ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } }, a: Doc<"assets">) {
  if (a.r2Key) return r2SignedUrl(a.r2Key, 3600);
  if (a.storageId) return ctx.storage.getUrl(a.storageId);
  return null;
}

export function assetView(a: Doc<"assets">, url: string | null) {
  return {
    id: a._id,
    kind: a.kind,
    source: a.source,
    view: a.view ?? null,
    url,
    label: a.label,
    width: a.width ?? null,
    height: a.height ?? null,
    sourceUrl: a.sourceUrl ?? null,
    product: a.product ?? null,
    illustrative: Boolean(a.illustrative),
    parentAssetId: a.parentAssetId ?? null,
    createdAt: a.createdAt,
  };
}

export const list = query({
  args: { slug: v.string(), kind: v.optional(kindValidator) },
  handler: async (ctx, { slug, kind }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = kind
      ? await ctx.db
          .query("assets")
          .withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", kind))
          .order("desc")
          .take(200)
      : await ctx.db
          .query("assets")
          .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
          .order("desc")
          .take(200);
    const live = rows.filter((a) => !a.archived);
    const jobs = await ctx.db
      .query("assetJobs")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(5);
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    return {
      canEdit: ["owner", "admin", "editor"].includes(role),
      website: business?.website ?? null,
      businessType: business?.businessType ?? null,
      assets: await Promise.all(live.map(async (a) => assetView(a, await urlOf(ctx, a)))),
      jobs: jobs.map((j) => ({ id: j._id, kind: j.kind, status: j.status, count: j.count, message: j.message ?? null, target: j.target ?? null, createdAt: j.createdAt, stages: j.stages ?? [] })),
      // AI image edits run as engine jobs; the page shows their live progress too.
      activeEdits: (
        await ctx.db
          .query("workflowRuns")
          .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
          .order("desc")
          .take(15)
      )
        .filter((r) => r.kind === "image_edit" && ["cost_reserved", "preparing", "executing"].includes(r.status))
        .map((r) => ({ id: r._id, title: r.title })),
    };
  },
});

export const generateUploadUrl = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireOrgAccess(ctx, { slug }, "edit");
    return ctx.storage.generateUploadUrl();
  },
});

export const saveUpload = mutation({
  args: { slug: v.string(), storageId: v.id("_storage"), label: v.string(), kind: v.union(v.literal("upload"), v.literal("logo")), width: v.optional(v.number()), height: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) throw appError("INVALID", "The upload didn't finish. Try again.");
    if (!(meta.contentType ?? "").startsWith("image/")) {
      await ctx.storage.delete(args.storageId);
      throw appError("INVALID", "Only images can be added (PNG, JPG, WebP or GIF).");
    }
    if (meta.size > MAX_IMAGE_BYTES * 2) {
      await ctx.storage.delete(args.storageId);
      throw appError("INVALID", "That image is over 16 MB. Try a smaller one.");
    }
    return ctx.db.insert("assets", {
      orgId: org._id,
      kind: args.kind,
      source: "upload",
      view: "other",
      storageId: args.storageId,
      mime: meta.contentType ?? "image/png",
      width: args.width,
      height: args.height,
      label: args.label.trim().slice(0, 120) || "Upload",
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: { slug: v.string(), assetId: v.id("assets") },
  handler: async (ctx, { slug, assetId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(assetId), org._id, "image");
    await ctx.db.patch(a._id, { archived: true });
  },
});

async function startJob(ctx: Parameters<typeof requireOrgAccess>[0] & { db: import("./_generated/server").MutationCtx["db"] }, orgId: Id<"organizations">, kind: "capture" | "products", target: string) {
  const since = Date.now() - 86_400_000;
  const recent = await ctx.db
    .query("assetJobs")
    .withIndex("by_org_created", (q) => q.eq("orgId", orgId).gt("createdAt", since))
    .take(DAILY_JOBS + 1);
  if (recent.length >= DAILY_JOBS) throw appError("RATE_LIMITED", "That's enough image collecting for today. Try again tomorrow.");
  if (recent.some((j) => j.status === "running" && j.kind === kind)) throw appError("INVALID", "Already working on it. New images appear here in a minute.");
  const now = Date.now();
  const labels = JOB_STAGES[kind];
  const stages = labels.map((x, i) => ({ key: x.key, label: x.label, status: i === 0 ? ("running" as const) : ("pending" as const), ...(i === 0 ? { startedAt: now } : {}) }));
  return ctx.db.insert("assetJobs", { orgId, kind, status: "running", target, count: 0, stages, createdAt: now });
}

/** Named stages per image job, shown live with timers on the Images page. */
const JOB_STAGES: Record<"capture" | "products", { key: string; label: string }[]> = {
  capture: [
    { key: "shoot", label: "Opening your site and taking screenshots" },
    { key: "save", label: "Saving them to your library" },
  ],
  products: [
    { key: "find", label: "Finding products on your site" },
    { key: "download", label: "Downloading product photos" },
  ],
};

/** Move a job stage forward (start the next one when a stage finishes). */
export const stage = internalMutation({
  args: { jobId: v.id("assetJobs"), key: v.string(), status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")), detail: v.optional(v.string()) },
  handler: async (ctx, { jobId, key, status, detail }) => {
    const job = await ctx.db.get(jobId);
    if (!job?.stages) return;
    const now = Date.now();
    const i = job.stages.findIndex((x) => x.key === key);
    if (i < 0) return;
    const stages = job.stages.map((x, j) => {
      if (j === i) return { ...x, status, ...(detail !== undefined ? { detail: detail.slice(0, 200) } : {}), ...(status === "running" && !x.startedAt ? { startedAt: now } : {}), ...(status !== "running" ? { finishedAt: now } : {}) };
      if (j === i + 1 && status === "done" && x.status === "pending") return { ...x, status: "running" as const, startedAt: now };
      return x;
    });
    await ctx.db.patch(jobId, { stages });
  },
});

/** Capture real screenshots of the business's site (home page, or a specific public page). */
export const captureWebsite = mutation({
  args: { slug: v.string(), url: v.optional(v.string()) },
  handler: async (ctx, { slug, url }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const target = safePublicUrl(url?.trim() || business?.website || "");
    if (!target) throw appError("INVALID", "Add your website first, or enter a public page address.");
    const jobId = await startJob(ctx, org._id, "capture", target.toString());
    await ctx.scheduler.runAfter(0, internal.assets.runCapture, { jobId, orgId: org._id, url: target.toString(), userId: user._id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "assets.capture", subjectType: "assetJob", subjectId: jobId, summary: `Capturing screenshots of ${target.hostname}.` });
    return jobId;
  },
});

/** Collect real product photos (and names, prices) from the store. */
export const collectProducts = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const site = safePublicUrl(business?.website ?? "");
    if (!site) throw appError("INVALID", "Add your website first.");
    const jobId = await startJob(ctx, org._id, "products", site.origin);
    await ctx.scheduler.runAfter(0, internal.assets.runProducts, { jobId, orgId: org._id, origin: site.origin, userId: user._id });
    return jobId;
  },
});

export const insertAsset = internalMutation({
  args: {
    orgId: v.id("organizations"),
    kind: kindValidator,
    source: v.union(v.literal("website"), v.literal("store"), v.literal("upload"), v.literal("ai"), v.literal("edit")),
    view: v.optional(v.union(v.literal("desktop"), v.literal("mobile"), v.literal("section"), v.literal("product"), v.literal("other"))),
    storageId: v.optional(v.id("_storage")),
    r2Key: v.optional(v.string()),
    mime: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    label: v.string(),
    sourceUrl: v.optional(v.string()),
    product: v.optional(v.object({ name: v.string(), price: v.optional(v.string()), url: v.optional(v.string()) })),
    parentAssetId: v.optional(v.id("assets")),
    illustrative: v.optional(v.boolean()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => ctx.db.insert("assets", { ...args, label: args.label.slice(0, 140), createdAt: Date.now() }),
});

export const finishJob = internalMutation({
  args: { jobId: v.id("assetJobs"), status: v.union(v.literal("done"), v.literal("failed")), count: v.number(), message: v.optional(v.string()) },
  handler: async (ctx, { jobId, status, count, message }) => {
    const job = await ctx.db.get(jobId);
    const now = Date.now();
    const stages = job?.stages?.map((x) => (x.status === "running" || x.status === "pending" ? { ...x, status: status === "done" ? ("done" as const) : x.status === "running" ? ("failed" as const) : x.status, finishedAt: x.status === "running" || status === "done" ? now : x.finishedAt } : x));
    await ctx.db.patch(jobId, { status, count, message: message?.slice(0, 300), finishedAt: now, ...(stages ? { stages } : {}) });
  },
});

async function storeBytes(ctx: { storage: { store: (b: Blob) => Promise<Id<"_storage">> } }, orgId: string, bytes: Uint8Array, mime: string): Promise<{ storageId?: Id<"_storage">; r2Key?: string }> {
  if (r2Configured()) {
    const key = r2Key(orgId, "images", mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png");
    await r2Put(key, bytes, mime);
    return { r2Key: key };
  }
  return { storageId: await ctx.storage.store(new Blob([bytes as BlobPart], { type: mime })) };
}

function workerUrl() {
  return (process.env.RENDER_WORKER_URL ?? process.env.SITE_URL ?? "https://climbos.app").replace(/\/$/, "");
}

export const runCapture = internalAction({
  args: { jobId: v.id("assetJobs"), orgId: v.id("organizations"), url: v.string(), userId: v.id("users") },
  handler: async (ctx, { jobId, orgId, url, userId }) => {
    const secret = process.env.CLIMBOS_SERVER_SECRET;
    if (!secret) {
      await ctx.runMutation(internal.assets.finishJob, { jobId, status: "failed", count: 0, message: "Screenshots aren't set up on this deployment yet." });
      return;
    }
    try {
      const res = await fetch(`${workerUrl()}/api/render/capture`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-climbos-secret": secret },
        body: JSON.stringify({ url, sections: 4 }),
      });
      const json = (await res.json()) as { error?: string; shots?: { kind: "desktop" | "mobile" | "section"; label: string; width: number; height: number; png: string }[] };
      if (!res.ok || !json.shots) throw new Error(json.error ?? `Capture failed (${res.status}).`);
      const kinds = json.shots.map((x) => x.kind);
      await ctx.runMutation(internal.assets.stage, { jobId, key: "shoot", status: "done", detail: `${kinds.filter((k) => k === "desktop").length} desktop, ${kinds.filter((k) => k === "mobile").length} mobile, ${kinds.filter((k) => k === "section").length} feature sections` });
      let count = 0;
      for (const s of json.shots) {
        const bytes = Uint8Array.from(atob(s.png), (c) => c.charCodeAt(0));
        const stored = await storeBytes(ctx, orgId, bytes, "image/png");
        await ctx.runMutation(internal.assets.insertAsset, { orgId, kind: "screenshot", source: "website", view: s.kind, ...stored, mime: "image/png", width: s.width, height: s.height, label: s.label, sourceUrl: url, createdBy: userId });
        count++;
        await ctx.runMutation(internal.assets.stage, { jobId, key: "save", status: "running", detail: `Saved ${count} of ${json.shots.length}` });
      }
      await ctx.runMutation(internal.assets.finishJob, { jobId, status: "done", count });
    } catch (e) {
      await ctx.runMutation(internal.assets.finishJob, { jobId, status: "failed", count: 0, message: (e as Error).message });
    }
  },
});

async function fetchText(url: string): Promise<string | null> {
  const safe = safePublicUrl(url);
  if (!safe) return null;
  const res = await fetch(safe, { headers: { "user-agent": "ClimbOS-Assets/1.0 (+https://climbos.app)" }, redirect: "follow" }).catch(() => null);
  if (!res?.ok || !safePublicUrl(res.url)) return null;
  return (await res.text()).slice(0, 2_000_000);
}

export const runProducts = internalAction({
  args: { jobId: v.id("assetJobs"), orgId: v.id("organizations"), origin: v.string(), userId: v.id("users") },
  handler: async (ctx, { jobId, orgId, origin, userId }) => {
    try {
      const found: FoundProduct[] = [];
      // Shopify stores publish their catalog as JSON.
      const shop = await fetchText(`${origin}/products.json?limit=24`);
      if (shop?.trim().startsWith("{")) {
        try {
          const j = JSON.parse(shop) as { products?: { title: string; handle: string; images?: { src: string }[]; variants?: { price?: string }[] }[] };
          for (const p of j.products ?? []) {
            found.push({ name: p.title, price: p.variants?.[0]?.price, url: `${origin}/products/${p.handle}`, images: (p.images ?? []).map((i) => i.src).slice(0, 3) });
          }
        } catch {
          // not a Shopify catalog
        }
      }
      if (found.length === 0) {
        const home = await fetchText(origin);
        if (home) {
          found.push(...productsFromHtml(home, origin));
          for (const link of productLinks(home, origin, 8)) {
            const html = await fetchText(link);
            if (html) found.push(...productsFromHtml(html, link));
          }
        }
      }
      await ctx.runMutation(internal.assets.stage, { jobId, key: "find", status: "done", detail: found.length ? `Found ${found.length} product${found.length === 1 ? "" : "s"}${found[0] ? `: ${found.slice(0, 3).map((p) => p.name).join(", ")}` : ""}` : "No products found" });
      const seen = new Set<string>();
      let count = 0;
      for (const p of found) {
        for (const img of p.images.slice(0, 2)) {
          if (count >= 24 || seen.has(img)) continue;
          seen.add(img);
          const safe = safePublicUrl(img);
          if (!safe) continue;
          const res = await fetch(safe).catch(() => null);
          const mime = res?.headers.get("content-type")?.split(";")[0] ?? "";
          if (!res?.ok || !mime.startsWith("image/") || mime.includes("svg")) continue;
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.length < 8_000 || bytes.length > MAX_IMAGE_BYTES) continue;
          const stored = await storeBytes(ctx, orgId, bytes, mime);
          await ctx.runMutation(internal.assets.insertAsset, {
            orgId,
            kind: "product_photo",
            source: "store",
            view: "product",
            ...stored,
            mime,
            label: p.name,
            sourceUrl: p.url,
            product: { name: p.name, price: p.price, url: p.url },
            createdBy: userId,
          });
          count++;
          await ctx.runMutation(internal.assets.stage, { jobId, key: "download", status: "running", detail: `Saved ${count} photo${count === 1 ? "" : "s"}` });
        }
      }
      await ctx.runMutation(internal.assets.finishJob, {
        jobId,
        status: count ? "done" : "failed",
        count,
        message: count ? undefined : "We couldn't find product photos on your site. Upload a few instead.",
      });
    } catch (e) {
      await ctx.runMutation(internal.assets.finishJob, { jobId, status: "failed", count: 0, message: (e as Error).message });
    }
  },
});

/** Assets for a content job, with how each should be described and labelled. */
export const forJob = internalQuery({
  args: { orgId: v.id("organizations"), assetIds: v.array(v.id("assets")) },
  handler: async (ctx, { orgId, assetIds }) => {
    const out = [];
    for (const id of assetIds.slice(0, 12)) {
      const a = await ctx.db.get(id);
      if (!a || a.orgId !== orgId || a.archived) continue;
      const what =
        a.kind === "screenshot"
          ? `Real ${a.view === "mobile" ? "mobile " : ""}screenshot of the business's website${a.view === "section" ? `, the section headed "${a.label}"` : ` ("${a.label}")`}`
          : a.kind === "product_photo"
            ? `Real product photo: ${a.product?.name ?? a.label}${a.product?.price ? ` (${a.product.price})` : ""}`
            : a.kind === "ai_image"
              ? `AI image: ${a.label}`
              : `Owner's own image: ${a.label}`;
      out.push({
        id: a._id,
        storageId: a.storageId,
        r2Key: a.r2Key,
        describe: `${what}${a.illustrative ? " (shows sample data)" : ""}`,
        labelForPost: a.kind === "ai_image" ? "AI-generated illustration" : a.illustrative ? "Your product with sample data" : a.kind === "screenshot" ? "Screenshot of your website" : a.kind === "product_photo" ? "Your product photo" : "Your image",
      });
    }
    return out;
  },
});

/** Start posts built around chosen real images (checkbox selection in the image library). */
export const makePosts = mutation({
  args: { slug: v.string(), assetIds: v.array(v.id("assets")), channel: v.string(), brief: v.optional(v.string()) },
  handler: async (ctx, { slug, assetIds, channel, brief }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (!assetIds.length) throw appError("INVALID", "Pick at least one image.");
    for (const id of assetIds) assertSameOrg(await ctx.db.get(id), org._id, "image");
    const quantity = Math.min(assetIds.length, 6);
    const plan = planJob("content_social", { quantity, images: 0, channel }, { fixture: org.kind === "demo" });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: `${quantity} ${channel} post${quantity === 1 ? "" : "s"} from your images`,
      roles: plan.roles,
      input: { channel, quantity, assetIds, brief },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: org.kind === "demo",
    });
    await ctx.scheduler.runAfter(0, internal.jobs.createContent, { runId, job: "content_social", channel, quantity, images: 0, brief: brief?.slice(0, 1500), assetIds: assetIds.slice(0, 6) });
    return { runId };
  },
});

/** Source image details for an edit job. */
export const source = internalQuery({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    return ctx.db.get(assetId);
  },
});

/** Improve a real image: realistic sample data, a clean background, or a lifestyle scene. */
export const editImage = mutation({
  args: { slug: v.string(), assetId: v.id("assets"), treatment: v.union(v.literal("sample_data"), v.literal("clean_background"), v.literal("lifestyle_scene")), scene: v.optional(v.string()) },
  handler: async (ctx, { slug, assetId, treatment, scene }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(assetId), org._id, "image");
    if (a.archived) throw appError("INVALID", "That image was removed.");
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: "image_edit",
      title: treatment === "sample_data" ? "Add realistic sample data" : treatment === "clean_background" ? "Clean studio background" : "Lifestyle scene",
      roles: ["creative_director"],
      input: { assetId, treatment, scene },
      steps: [{ kind: "image", role: "creative_director", imageAttempts: 1 }],
      meters: { imageAttempts: 1, deliveredImages: 1 },
      createdBy: user._id,
      isFixture: org.kind === "demo",
    });
    await ctx.scheduler.runAfter(0, internal.assetEdits.run, { runId, assetId, treatment, scene: scene?.slice(0, 60), userId: user._id });
    return { runId };
  },
});

export type { AssetKind };
