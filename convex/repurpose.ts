import { v } from "convex/values";
import { CALL_ROUTES } from "../shared/agents/routes";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { insertArtifact, type ArtifactInput } from "./jobWrites";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Repurposing: one piece (a URL, pasted text or an existing draft) becomes
 * drafts for several channels in one Luna call. Drafts go to review like any
 * other; links get tracked automatically.
 */

const MODEL = CALL_ROUTES.chat_intent;
export const FORMATS = ["linkedin", "x", "instagram", "facebook", "email", "video"] as const;
const formatV = v.union(...FORMATS.map((f) => v.literal(f)));

export const start = mutation({
  args: { slug: v.string(), url: v.optional(v.string()), text: v.optional(v.string()), artifactId: v.optional(v.id("artifacts")), formats: v.array(formatV) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const formats = [...new Set(a.formats)].slice(0, FORMATS.length);
    if (!formats.length) throw appError("INVALID", "Pick at least one format.");
    let text = a.text?.trim().slice(0, 20_000) ?? "";
    if (a.artifactId) {
      const art = assertSameOrg(await ctx.db.get(a.artifactId), org._id, "draft");
      const ver = art.currentVersionId ? await ctx.db.get(art.currentVersionId) : null;
      text = [ver?.headline, ver?.body].filter(Boolean).join("\n\n");
    }
    const url = a.url?.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) throw appError("INVALID", "Links must start with https://");
    if (!url && text.length < 80) throw appError("INVALID", "Paste a link, or at least a few sentences.");
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: "repurpose",
      title: `Repurpose into ${formats.length} format${formats.length === 1 ? "" : "s"}`,
      roles: ["social_media_manager"],
      input: { url, formats },
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
    if (!run) return null;
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", run.orgId)).first();
    const brand = business ? await ctx.db.query("brandProfiles").withIndex("by_business", (q) => q.eq("businessId", business._id)).first() : null;
    const org = await ctx.db.get(run.orgId);
    return { language: org?.contentLanguage ?? "English", run, business: business ? { id: business._id, name: business.name, website: business.website ?? "" } : null, voice: brand ? `${brand.voice}${brand.learnedRules?.length ? `; owner's rules: ${brand.learnedRules.map((r) => r.text).join("; ")}` : ""}` : "" };
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
    if (!run) return [];
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", run.orgId)).first();
    if (!business) return [];
    const ids: Id<"artifacts">[] = [];
    for (const it of items) {
      const map = CHANNEL[it.format];
      ids.push(
        await insertArtifact(ctx, {
          orgId: run.orgId,
          businessId: business._id,
          runId,
          factIds: [],
          createdBy: run.createdBy,
          item: { kind: map.kind, channel: map.channel, title: it.title.slice(0, 120) || `Repurposed for ${it.format}`, body: it.body.slice(0, 8000), destinationUrl: sourceUrl, hashtags: it.hashtags.map((h) => h.replace(/^#/, "")).slice(0, 10), factIndexes: [], role: map.role },
        }),
      );
    }
    return ids;
  },
});
