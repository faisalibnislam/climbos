import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { audit } from "./lib/audit";
import { invalidateApprovals } from "./lib/approvals";
import { maxJobMicros, planJob } from "./lib/jobPlans";
import { visualTakesImage } from "./lib/postVisual";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { contentHash } from "../shared/policy";

const AI_IMAGE_LABEL = "AI-generated illustration";

/** The brief an image can be made from, or why it can't. */
async function imageSource(ctx: QueryCtx, art: Doc<"artifacts">): Promise<{ version: Doc<"artifactVersions">; brief: string } | { error: string }> {
  if (art.kind !== "social_post") return { error: "Only social posts can get a suggested image." };
  if (["publishing", "published", "uncertain"].includes(art.status)) return { error: "Published posts can't be changed. Duplicate it instead." };
  const version = art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null;
  if (!version) return { error: "This post has no text yet." };
  if (version.visual && !visualTakesImage(version.visual.format)) return { error: "This post suggests a short video. Film it from the shot list, or change the format." };
  const brief = (version.visual?.brief ?? version.imagePrompt ?? "").trim();
  if (!brief) return { error: "This post has no visual brief to make an image from." };
  return { version, brief };
}

/** The most creating one image can cost ("up to"), shown before the owner starts it. */
export const imageEstimate = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const fixture = org.kind === "demo";
    return { maxCostMicros: maxJobMicros(planJob("post_image", {}, { fixture }), { fixture }) };
  },
});

/** Start a metered run that makes one image from the post's visual brief. The result still needs approval. */
export const createImage = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }): Promise<{ runId: Id<"workflowRuns"> }> => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const art = assertSameOrg(await ctx.db.get(artifactId), org._id, "post");
    const source = await imageSource(ctx, art);
    if ("error" in source) throw appError("INVALID", source.error);
    if (org.kind === "demo") throw appError("INVALID", "Demo workspaces show the brief only. Create images in your own workspace.");
    const plan = planJob("post_image", {});
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: "post_image",
      title: plan.title,
      roles: plan.roles,
      input: { artifactId, versionId: source.version._id },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: false,
    });
    await ctx.scheduler.runAfter(0, internal.postVisualImages.run, { runId, artifactId, userId: user._id });
    return { runId };
  },
});

/** What the image action needs: the brief, channel and business name. */
export const imageJob = internalQuery({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }) => {
    const art = await ctx.db.get(artifactId);
    if (!art) return null;
    const source = await imageSource(ctx, art);
    if ("error" in source) return { orgId: art.orgId, error: source.error };
    const business = await ctx.db.get(art.businessId);
    return { orgId: art.orgId, channel: art.channel, brief: source.brief, format: source.version.visual?.format ?? "single_image", businessName: business?.name ?? null };
  },
});

/** Save the made image to the library and give the post a new version with it; any earlier approval no longer applies. */
export const attachImage = internalMutation({
  args: { artifactId: v.id("artifacts"), userId: v.id("users"), storageId: v.optional(v.id("_storage")), r2Key: v.optional(v.string()), mime: v.string() },
  handler: async (ctx, a) => {
    const art = await ctx.db.get(a.artifactId);
    if (!art) return { attached: false };
    await ctx.db.insert("assets", { orgId: art.orgId, kind: "ai_image", source: "ai", view: "other", storageId: a.storageId, r2Key: a.r2Key, mime: a.mime, label: `Image for “${art.title}”`.slice(0, 140), illustrative: true, createdBy: a.userId, createdAt: Date.now() });
    const prev = art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null;
    // Published meanwhile: keep the image in the library only.
    if (!prev || ["publishing", "published", "uncertain"].includes(art.status)) return { attached: false };
    const imageRef = a.r2Key ?? a.storageId;
    const ch = await contentHash({ headline: prev.headline, body: prev.body, contentAngle: prev.contentAngle, copyBrief: prev.copyBrief, approvedOfferTermsSnapshot: prev.approvedOfferTermsSnapshot, offerPlayNameSnapshot: prev.offerPlayNameSnapshot, callToAction: prev.callToAction, destinationUrl: prev.destinationUrl, hashtags: prev.hashtags, altText: prev.altText, imageRef, channel: art.channel });
    const now = Date.now();
    const version = art.currentVersion + 1;
    const { _id: _ignore, _creationTime: _t, ...rest } = prev;
    const versionId = await ctx.db.insert("artifactVersions", { ...rest, version, imageStorageId: a.storageId, imageR2Key: a.r2Key, imageLabel: AI_IMAGE_LABEL, contentHash: ch, editedByUser: a.userId, editedByRole: undefined, createdAt: now });
    await invalidateApprovals(ctx, art._id, "Image changed");
    await ctx.db.patch(art._id, { currentVersionId: versionId, currentVersion: version, status: art.status === "archived" ? "archived" : "in_review", updatedAt: now });
    const slot = await ctx.db.query("calendarSlots").withIndex("by_artifact", (q) => q.eq("artifactId", art._id)).first();
    if (slot && slot.status === "scheduled") await ctx.db.patch(slot._id, { status: "needs_approval", updatedAt: now });
    await audit(ctx, { orgId: art.orgId, actorType: "user", actorId: a.userId, action: "content.edited", subjectType: "artifact", subjectId: art._id, summary: `Added an AI-generated image from the visual brief (v${version}). It needs approval before it goes out.` });
    return { attached: true };
  },
});
