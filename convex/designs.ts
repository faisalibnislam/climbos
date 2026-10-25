import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { invalidateApprovals } from "./lib/approvals";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { urlOf } from "./assets";
import { contentHash } from "../shared/policy";
import { newDesign } from "../shared/design/templates";
import { DEFAULT_BRAND, FORMATS, type BrandKit, type DesignDoc, type DesignFormat, type Layer } from "../shared/design/types";

/**
 * Design studio storage: designs are saved to the workspace (autosaved from
 * the editor), reopened, duplicated, exported by ClimbOS's own render worker
 * as PNG/PDF, and attached to posts. Images are "asset:<id>" references into
 * the asset library, resolved to fresh URLs whenever a design is shown.
 */

const MAX_DOC_CHARS = 800_000;
const MAX_DESIGNS = 500;

function parseDoc(json: string): DesignDoc {
  let d: DesignDoc;
  try {
    d = JSON.parse(json) as DesignDoc;
  } catch {
    throw appError("INVALID", "That design couldn't be read.");
  }
  if (d.version !== 1 || !Array.isArray(d.pages) || !d.pages.length || !(d.width > 0) || !(d.height > 0)) throw appError("INVALID", "That design isn't valid.");
  if (d.pages.length > 20) throw appError("INVALID", "A design can have at most 20 pages.");
  return d;
}

/** Every image reference in a design (layers, page backgrounds, logo). */
function imageRefs(d: DesignDoc): string[] {
  const out = new Set<string>();
  const walk = (ls: Layer[]) => {
    for (const l of ls) {
      if (l.type === "image" && l.src) out.add(l.src);
      if (l.type === "group") walk(l.children);
    }
  };
  for (const p of d.pages) {
    walk(p.layers);
    if (p.background.imageSrc) out.add(p.background.imageSrc);
  }
  if (d.brand.logoSrc) out.add(d.brand.logoSrc);
  return [...out];
}

/** Fresh URLs for the design's asset references (only this workspace's assets). */
async function assetUrls(ctx: QueryCtx, orgId: Id<"organizations">, d: DesignDoc): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const ref of imageRefs(d)) {
    if (!ref.startsWith("asset:")) continue;
    const id = ctx.db.normalizeId("assets", ref.slice(6));
    const a = id ? await ctx.db.get(id) : null;
    if (!a || a.orgId !== orgId) continue;
    const url = await urlOf(ctx, a);
    if (url) urls[ref] = url;
  }
  return urls;
}

/** The workspace's brand kit for new designs: brand colours, logo and name. */
async function workspaceBrand(ctx: QueryCtx, orgId: Id<"organizations">): Promise<BrandKit> {
  const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
  const profile = business ? await ctx.db.query("brandProfiles").withIndex("by_business", (q) => q.eq("businessId", business._id)).first() : null;
  const hex = (profile?.colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const logo = (await ctx.db.query("assets").withIndex("by_org_kind", (q) => q.eq("orgId", orgId).eq("kind", "logo")).order("desc").take(5)).find((a) => !a.archived);
  return {
    colors: { ...DEFAULT_BRAND.colors, ...(hex[0] ? { primary: hex[0] } : {}), ...(hex[1] ? { secondary: hex[1] } : {}), ...(hex[2] ? { accent: hex[2] } : {}) },
    fonts: DEFAULT_BRAND.fonts,
    ...(logo ? { logoSrc: `asset:${logo._id}` } : {}),
    name: business?.name,
  };
}

function view(d: Doc<"designs">) {
  return { id: d._id, title: d.title, format: d.format, pages: d.pages, artifactId: d.artifactId ?? null, updatedAt: d.updatedAt, createdAt: d.createdAt };
}

/** The design library, newest first, with each design's first page for thumbnails. */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = (await ctx.db.query("designs").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(120)).filter((d) => !d.archived);
    const items = [];
    for (const d of rows) {
      const doc = JSON.parse(d.doc) as DesignDoc;
      const cover: DesignDoc = { ...doc, pages: [doc.pages[0]] };
      items.push({ ...view(d), cover, urls: await assetUrls(ctx, org._id, cover) });
    }
    return { canEdit: ["owner", "admin", "editor"].includes(role), items };
  },
});

/** One design for the editor, with fresh image URLs. */
export const get = query({
  args: { slug: v.string(), designId: v.id("designs") },
  handler: async (ctx, { slug, designId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const d = await ctx.db.get(designId);
    if (!d || d.orgId !== org._id || d.archived) return null;
    const doc = JSON.parse(d.doc) as DesignDoc;
    return { ...view(d), doc, urls: await assetUrls(ctx, org._id, doc), canEdit: ["owner", "admin", "editor"].includes(role) };
  },
});

/** Fresh URLs for a set of asset references (photos added while editing). */
export const urls = query({
  args: { slug: v.string(), refs: v.array(v.string()) },
  handler: async (ctx, { slug, refs }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const out: Record<string, string> = {};
    for (const ref of refs.slice(0, 200)) {
      if (!ref.startsWith("asset:")) continue;
      const id = ctx.db.normalizeId("assets", ref.slice(6));
      const a = id ? await ctx.db.get(id) : null;
      if (!a || a.orgId !== org._id) continue;
      const url = await urlOf(ctx, a);
      if (url) out[ref] = url;
    }
    return out;
  },
});

/** Start a new design in the workspace's brand (optionally from a post's text). */
export const create = mutation({
  args: { slug: v.string(), format: v.string(), carousel: v.optional(v.boolean()), title: v.optional(v.string()), artifactId: v.optional(v.id("artifacts")) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    if (!(a.format in FORMATS)) throw appError("INVALID", "Pick a size.");
    const count = (await ctx.db.query("designs").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).take(MAX_DESIGNS + 1)).length;
    if (count > MAX_DESIGNS) throw appError("INVALID", "Your design library is full. Delete a few designs first.");
    let title = a.title?.trim().slice(0, 120) || "Untitled design";
    let headline: string | undefined;
    if (a.artifactId) {
      const art = assertSameOrg(await ctx.db.get(a.artifactId), org._id, "post");
      const ver = art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null;
      title = a.title?.trim() || `Design for “${art.title.slice(0, 60)}”`;
      headline = (ver?.headline || ver?.body.split(/\n|(?<=[.!?])\s/)[0] || "").trim().slice(0, 90) || undefined;
    }
    const doc = newDesign(a.format as Exclude<DesignFormat, "custom">, "bold_statement", await workspaceBrand(ctx, org._id), a.carousel ? 3 : 0);
    // A post's first line becomes the headline of the first page.
    if (headline) {
      const p = doc.pages[0];
      doc.pages[0] = { ...p, layers: p.layers.map((l) => (l.type === "text" && l.slot === "headline" ? { ...l, text: headline! } : l)) };
    }
    const now = Date.now();
    const id = await ctx.db.insert("designs", { orgId: org._id, title, format: a.format, doc: JSON.stringify(doc), pages: doc.pages.length, artifactId: a.artifactId, createdBy: user._id, createdAt: now, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "design.created", subjectType: "design", subjectId: id, summary: `Created design “${title}”.` });
    return id;
  },
});

/** Autosave from the editor. */
export const save = mutation({
  args: { slug: v.string(), designId: v.id("designs"), doc: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(a.designId), org._id, "design");
    if (a.doc.length > MAX_DOC_CHARS) throw appError("INVALID", "This design is too large to save. Remove some pages or large images.");
    const doc = parseDoc(a.doc);
    if (imageRefs(doc).some((r) => r.startsWith("data:") && r.length > 4_000)) throw appError("INVALID", "Upload images through Photos so they're saved to your library.");
    await ctx.db.patch(d._id, { doc: a.doc, pages: doc.pages.length, format: doc.format, updatedAt: Date.now() });
    return { savedAt: Date.now() };
  },
});

export const rename = mutation({
  args: { slug: v.string(), designId: v.id("designs"), title: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(a.designId), org._id, "design");
    const title = a.title.trim().slice(0, 120);
    if (!title) throw appError("INVALID", "Give it a name.");
    await ctx.db.patch(d._id, { title, updatedAt: Date.now() });
  },
});

export const duplicate = mutation({
  args: { slug: v.string(), designId: v.id("designs") },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(a.designId), org._id, "design");
    const now = Date.now();
    return ctx.db.insert("designs", { orgId: org._id, title: `${d.title} (copy)`.slice(0, 120), format: d.format, doc: d.doc, pages: d.pages, createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const archive = mutation({
  args: { slug: v.string(), designId: v.id("designs") },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(a.designId), org._id, "design");
    await ctx.db.patch(d._id, { archived: true, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "design.deleted", subjectType: "design", subjectId: d._id, summary: `Deleted design “${d.title}”.` });
  },
});

/** For export: the design with resolved image URLs (edit access required). */
export const forExport = query({
  args: { slug: v.string(), designId: v.id("designs") },
  handler: async (ctx, { slug, designId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(designId), org._id, "design");
    const doc = JSON.parse(d.doc) as DesignDoc;
    return { orgId: org._id, title: d.title, doc, urls: await assetUrls(ctx, org._id, doc) };
  },
});

function workerUrl(): string {
  return (process.env.RENDER_WORKER_URL ?? process.env.SITE_URL ?? "https://climbos.app").replace(/\/$/, "");
}

/** Our own render worker draws the design exactly as the editor shows it and uploads the files to storage. */
async function render(ctx: { storage: { generateUploadUrl: () => Promise<string> } }, doc: DesignDoc, urls: Record<string, string>, pages: number[], kind: "png" | "pdf"): Promise<Id<"_storage">[]> {
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!secret) throw appError("UNAVAILABLE", "Downloads aren't set up on this server yet.");
  const uploadUrls = await Promise.all(Array.from({ length: kind === "pdf" ? 1 : pages.length }, () => ctx.storage.generateUploadUrl()));
  const res = await fetch(`${workerUrl()}/api/render/design`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-climbos-secret": secret },
    body: JSON.stringify({ doc, urls, pages, kind, uploadUrls }),
  });
  const body = (await res.json().catch(() => ({}))) as { storageIds?: string[]; error?: string };
  if (!res.ok || body.error || !body.storageIds?.length) throw appError("UNAVAILABLE", `The design couldn't be rendered${body.error ? `: ${body.error}` : ""}. Try again.`);
  return body.storageIds as Id<"_storage">[];
}

/** Download a page (PNG), every page (PNGs) or the whole design as a PDF. Files are saved to the library too. */
export const exportFiles = action({
  args: { slug: v.string(), designId: v.id("designs"), pages: v.array(v.number()), kind: v.union(v.literal("png"), v.literal("pdf")) },
  handler: async (ctx, a): Promise<{ files: { url: string; name: string }[] }> => {
    const d = await ctx.runQuery(api.designs.forExport, { slug: a.slug, designId: a.designId });
    const pages = [...new Set(a.pages.filter((i) => Number.isInteger(i) && i >= 0 && i < d.doc.pages.length))].slice(0, 20);
    if (!pages.length) throw appError("INVALID", "Pick a page to download.");
    const ids = await render(ctx, d.doc, d.urls, pages, a.kind);
    const safe = d.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "design";
    if (a.kind === "pdf") return { files: [{ url: (await ctx.storage.getUrl(ids[0]))!, name: `${safe}.pdf` }] };
    const files = [];
    for (const [i, id] of ids.entries()) {
      await ctx.runMutation(internal.designs.recordExport, { orgId: d.orgId, storageId: id, label: `${d.title} · page ${pages[i] + 1}`, width: d.doc.width, height: d.doc.height });
      files.push({ url: (await ctx.storage.getUrl(id))!, name: pages.length > 1 ? `${safe}-${pages[i] + 1}.png` : `${safe}.png` });
    }
    return { files };
  },
});

export const recordExport = internalMutation({
  args: { orgId: v.id("organizations"), storageId: v.id("_storage"), label: v.string(), width: v.number(), height: v.number() },
  handler: async (ctx, a) =>
    ctx.db.insert("assets", { orgId: a.orgId, kind: "design", source: "design", view: "other", storageId: a.storageId, mime: "image/png", width: a.width, height: a.height, label: a.label.slice(0, 120), createdAt: Date.now() }),
});

/** Use a design as a post's image: renders the first page and makes it the post's new version (back to review). */
export const useInPost = action({
  args: { slug: v.string(), designId: v.id("designs"), artifactId: v.id("artifacts"), pageIndex: v.optional(v.number()) },
  handler: async (ctx, a): Promise<{ ok: true }> => {
    const d = await ctx.runQuery(api.designs.forExport, { slug: a.slug, designId: a.designId });
    const page = Math.max(0, Math.min(d.doc.pages.length - 1, a.pageIndex ?? 0));
    const [storageId] = await render(ctx, d.doc, d.urls, [page], "png");
    await ctx.runMutation(api.designs.attachImage, { slug: a.slug, designId: a.designId, artifactId: a.artifactId, storageId });
    return { ok: true };
  },
});

/** The post gets a new version with the design as its image; any earlier approval no longer applies. */
export const attachImage = mutation({
  args: { slug: v.string(), designId: v.id("designs"), artifactId: v.id("artifacts"), storageId: v.id("_storage") },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const design = assertSameOrg(await ctx.db.get(a.designId), org._id, "design");
    const art = assertSameOrg(await ctx.db.get(a.artifactId), org._id, "post");
    if (["publishing", "published"].includes(art.status)) throw appError("INVALID", "Published posts can't be changed. Duplicate it instead.");
    const meta = await ctx.db.system.get(a.storageId);
    if (!meta || (meta.contentType && !meta.contentType.startsWith("image/"))) throw appError("INVALID", "The image didn't render. Try again.");
    const prev = art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null;
    if (!prev) throw appError("INVALID", "This post has no text yet.");
    const ch = await contentHash({ headline: prev.headline, body: prev.body, contentAngle: prev.contentAngle, copyBrief: prev.copyBrief, approvedOfferTermsSnapshot: prev.approvedOfferTermsSnapshot, offerPlayNameSnapshot: prev.offerPlayNameSnapshot, callToAction: prev.callToAction, destinationUrl: prev.destinationUrl, hashtags: prev.hashtags, altText: prev.altText, imageRef: a.storageId, channel: art.channel });
    const now = Date.now();
    const version = art.currentVersion + 1;
    const { _id: _ignore, _creationTime: _t, ...rest } = prev;
    const versionId = await ctx.db.insert("artifactVersions", { ...rest, version, imageStorageId: a.storageId, imageR2Key: undefined, imageLabel: "Made in Design studio", imagePrompt: undefined, contentHash: ch, editedByUser: user._id, createdAt: now });
    await invalidateApprovals(ctx, art._id, "Image changed");
    await ctx.db.patch(art._id, { currentVersionId: versionId, currentVersion: version, status: art.status === "archived" ? "archived" : "in_review", updatedAt: now });
    await ctx.db.patch(design._id, { artifactId: art._id, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.edited", subjectType: "artifact", subjectId: art._id, summary: `Added design “${design.title}” as the image (v${version}). Any earlier approval no longer applies.` });
  },
});

/** Posts a design can be attached to (drafts and posts in review that take an image). */
export const attachable = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(60);
    return rows
      .filter((r) => ["draft", "in_review", "approved", "scheduled"].includes(r.status) && ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube", "threads", "google_business"].includes(r.channel))
      .slice(0, 30)
      .map((r) => ({ id: r._id, title: r.title, channel: r.channel, status: r.status }));
  },
});
