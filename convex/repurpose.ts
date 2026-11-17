import { writingBrandContext } from "../shared/agents/contentTasks";
import { lintApprovedOfferCopy } from "../shared/agents/offerAssessment";
import { exactArtifactSource, inheritedArtifactBrief } from "./lib/artifactSource";
import { v } from "convex/values";
import { CALL_ROUTES } from "../shared/agents/routes";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, type QueryCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { insertArtifact, type ArtifactInput } from "./jobWrites";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Repurposing: one piece (a URL, pasted text or an existing draft) becomes
 * drafts for several channels in one routed model call. Drafts go to review like any
 * other; links get tracked automatically.
 */

const MODEL = CALL_ROUTES.chat_intent;
export const FORMATS = ["linkedin", "x", "instagram", "facebook", "email", "video"] as const;
const formatV = v.union(...FORMATS.map((f) => v.literal(f)));

/** Resolve the immutable source chosen at launch, never a newer edited version. */
async function sourceVersion(ctx: QueryCtx, run: Doc<"workflowRuns">) {
  const input = JSON.parse(run.input);
  if (input.sourceArtifactId === undefined && input.sourceVersionId === undefined) return null;
  const artifactId = typeof input.sourceArtifactId === "string" ? ctx.db.normalizeId("artifacts", input.sourceArtifactId) : null;
  const versionId = typeof input.sourceVersionId === "string" ? ctx.db.normalizeId("artifactVersions", input.sourceVersionId) : null;
  if (!artifactId || !versionId) throw appError("INVALID", "The saved source reference is incomplete. Choose the source draft again.");
  return (await exactArtifactSource(ctx, run.orgId, artifactId, versionId)).version;
}

export const start = mutation({
  args: { slug: v.string(), url: v.optional(v.string()), text: v.optional(v.string()), artifactId: v.optional(v.id("artifacts")), formats: v.array(formatV) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const formats = [...new Set(a.formats)].slice(0, FORMATS.length);
    if (!formats.length) throw appError("INVALID", "Pick at least one format.");
    let text = a.text?.trim().slice(0, 20_000) ?? "";
    let sourceVersionId: Id<"artifactVersions"> | undefined;
    if (a.artifactId) {
      if (a.url?.trim() || text) throw appError("INVALID", "Choose one source: either an existing draft or pasted text/a webpage.");
      const art = assertSameOrg(await ctx.db.get(a.artifactId), org._id, "draft");
      const ver = assertSameOrg(art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null, org._id, "source version");
      if (ver.artifactId !== art._id) throw appError("INVALID", "The source version does not belong to this draft.");
      sourceVersionId = ver._id;
      text = [ver.headline, ver.body, ver.callToAction, ...ver.hashtags].filter(Boolean).join("\n\n");
    }
    const url = a.url?.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) throw appError("INVALID", "Links must start with https://");
    if (!url && text.length < 80) throw appError("INVALID", "Paste a link, or at least a few sentences.");
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: "repurpose",
      title: `Repurpose into ${formats.length} format${formats.length === 1 ? "" : "s"}`,
      roles: ["social_media_manager"],
      input: { url, formats, ...(a.artifactId ? { sourceArtifactId: a.artifactId, sourceVersionId } : {}) },
      steps: [{ kind: "model", role: "social_media_manager", modelKey: MODEL, inputBudget: 12_000, outputBudget: 1_200 + formats.length * 700 }],
      meters: {},
      createdBy: user._id,
      isFixture: org.kind === "demo",
    });
    await ctx.scheduler.runAfter(0, internal.repurposeActions.run, { runId, url, text, formats });
    return runId;
  },
});

export const context = internalQuery({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.kind !== "repurpose") return null;
    const source = await sourceVersion(ctx, run);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", run.orgId)).first();
    const brand = business ? await ctx.db.query("brandProfiles").withIndex("by_business", (q) => q.eq("businessId", business._id)).first() : null;
    const org = await ctx.db.get(run.orgId);
    let includeSocial = true;
    try {
      const input = JSON.parse(run.input);
      if (Array.isArray(input?.formats) && input.formats.length) includeSocial = input.formats.some((format: unknown) => format !== "email");
    } catch { /* Older requests retain bounded guidance for both content types. */ }
    return { language: org?.contentLanguage ?? "English", run, source, business: business ? { id: business._id, name: business.name, website: business.website ?? "" } : null, brandContext: writingBrandContext(brand?.orgId === run.orgId ? brand : null, includeSocial) };
  },
});

const CHANNEL: Record<(typeof FORMATS)[number], { channel: ArtifactInput["channel"]; kind: ArtifactInput["kind"]; role: "social_media_manager" | "customer_success_manager" }> = {
  linkedin: { channel: "linkedin", kind: "social_post", role: "social_media_manager" },
  x: { channel: "x", kind: "social_post", role: "social_media_manager" },
  instagram: { channel: "instagram", kind: "social_post", role: "social_media_manager" },
  facebook: { channel: "facebook", kind: "social_post", role: "social_media_manager" },
  email: { channel: "email", kind: "email", role: "customer_success_manager" },
  video: { channel: "tiktok", kind: "video_script", role: "social_media_manager" },
};

export const save = internalMutation({
  args: { runId: v.id("workflowRuns"), sourceUrl: v.optional(v.string()), items: v.array(v.object({ format: formatV, title: v.string(), body: v.string(), hashtags: v.array(v.string()) })) },
  handler: async (ctx, { runId, sourceUrl, items }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.kind !== "repurpose") throw appError("INVALID", "This is not a repurposing request.");
    const requested = JSON.parse(run.input).formats as unknown;
    if (!Array.isArray(requested) || !requested.length || items.length !== requested.length || new Set(items.map(item => item.format)).size !== requested.length || items.some(item => !requested.includes(item.format) || !item.body.trim())) throw appError("INVALID", "One usable draft is required for each selected format.");
    const source = await sourceVersion(ctx, run);
    const playName = source?.copyBrief?.approvedOfferPlayName ?? source?.offerPlayNameSnapshot;
    const normalized = items.map(item => ({ ...item, title: item.title.slice(0, 120) || `Repurposed for ${item.format}`, body: item.body.slice(0, 8000), hashtags: item.hashtags.map(tag => tag.replace(/^#/, "")).slice(0, 10) }));
    // Validate exactly what will be saved, after length limits, before any insert.
    for (const item of normalized) {
      const issue = lintApprovedOfferCopy([item.title, item.body, ...item.hashtags].join("\n"), source?.approvedOfferTermsSnapshot, "repurpose", playName).find(issue => issue.severity === "error");
      if (issue) throw appError("INVALID", issue.message);
    }
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", run.orgId)).first();
    if (!business) return [];
    const { factIds, copyBrief } = await inheritedArtifactBrief(ctx, source, run.orgId, business._id);
    const ids: Id<"artifacts">[] = [];
    for (const it of normalized) {
      const map = CHANNEL[it.format];
      ids.push(
        await insertArtifact(ctx, {
          orgId: run.orgId,
          businessId: business._id,
          runId,
          factIds,
          createdBy: run.createdBy,
          offerTermsSnapshot: source?.approvedOfferTermsSnapshot,
          offerPlayNameSnapshot: playName,
          item: { kind: map.kind, channel: map.channel, title: it.title, body: it.body, destinationUrl: sourceUrl, hashtags: it.hashtags, factIndexes: [], role: map.role,
            copyBrief: copyBrief ? { ...copyBrief, channel: map.channel, format: it.format } : undefined,
          },
        }),
      );
    }
    return ids;
  },
});
