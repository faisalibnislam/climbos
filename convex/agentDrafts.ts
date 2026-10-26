import { v } from "convex/values";
import { xWeightedLength, X_POST_MAX_WEIGHTED } from "../shared/integrations/x";
import { validateCaption } from "../shared/integrations/instagram";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { fleetStopped, requirePaid } from "./lib/access";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { assetPostLabel } from "./content";
import { insertArtifact } from "./jobWrites";
import { channelValidator } from "./schema";

/**
 * Drafts an outside agent (Claude Desktop, ChatGPT…) wrote itself, on the
 * person's own AI account. ClimbOS runs no model here, so no credits are
 * used: it only checks the text and files it for review like any other draft.
 * Approving, scheduling and publishing still need the owner's tap.
 */

/** Saved drafts per agent token per rolling day, so a looping agent can't flood the review queue. */
export const AGENT_DRAFTS_PER_DAY = 50;
const DAY = 86_400_000;

const SOCIAL = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"] as const;
const CHANNELS_FOR: Record<AgentDraftKind, readonly Doc<"artifacts">["channel"][]> = {
  social_post: SOCIAL,
  ad: ["google_search_ad", "meta_ad", "linkedin_ad"],
  email: ["email"],
  blog_post: ["blog", "website"],
};
const ROLE_FOR: Record<AgentDraftKind, NonNullable<Doc<"artifacts">["createdByRole"]>> = {
  social_post: "social_media_manager",
  ad: "ads_manager",
  email: "customer_success_manager",
  blog_post: "seo_specialist",
};
type AgentDraftKind = "social_post" | "ad" | "email" | "blog_post";

const kindValidator = v.union(v.literal("social_post"), v.literal("ad"), v.literal("email"), v.literal("blog_post"));

/** The MCP token behind this call. The MCP server signs as `<userId>|mcp-<tokenId>`; the in-app panel and UI never do. */
async function callingAgentToken(ctx: MutationCtx, orgId: Id<"organizations">, userId: Id<"users">): Promise<Doc<"agentTokens">> {
  const subject = (await ctx.auth.getUserIdentity())?.subject ?? "";
  const raw = /\|mcp-([^|]+)$/.exec(subject)?.[1];
  const tokenId = raw ? ctx.db.normalizeId("agentTokens", raw) : null;
  const token = tokenId ? await ctx.db.get(tokenId) : null;
  if (!token) throw appError("FORBIDDEN", "Only a connected agent can save drafts it wrote. In ClimbOS, ask Climb AI or write in the editor.");
  if (token.revokedAt || token.expiresAt < Date.now() || token.orgId !== orgId || token.userId !== userId) throw appError("FORBIDDEN", "This agent token no longer works for this workspace.");
  if (!token.scopes.includes("draft")) throw appError("FORBIDDEN", "This agent token isn't allowed to prepare work. Tick “Prepare work” on a new token.");
  return token;
}

/** Platform limits we can check before review (the same rules publishing enforces later). */
function lengthProblems(channel: Doc<"artifacts">["channel"], body: string, hashtags: string[], destinationUrl?: string): string[] {
  const tags = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  if (channel === "x") {
    const text = [body, destinationUrl && !body.includes(destinationUrl) ? destinationUrl : "", tags].filter(Boolean).join("\n\n");
    const n = xWeightedLength(text);
    return n > X_POST_MAX_WEIGHTED ? [`This post is ${n}/${X_POST_MAX_WEIGHTED} characters on X (links count as 23, emoji as 2). Shorten it.`] : [];
  }
  if (channel === "instagram") return validateCaption([body, tags].filter(Boolean).join("\n\n"));
  return [];
}

export const save = mutation({
  args: {
    slug: v.string(),
    kind: kindValidator,
    channel: channelValidator,
    title: v.string(),
    headline: v.optional(v.string()),
    body: v.string(),
    callToAction: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    altText: v.optional(v.string()),
    imageAssetId: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    await requirePaid(ctx, org, "mcp");
    const token = await callingAgentToken(ctx, org._id, user._id);
    if (org.emergencyStop?.active || (await fleetStopped(ctx))) throw appError("PAUSED", "All activity is paused in ClimbOS, so nothing new can be saved. Resume activity first.");

    if (!CHANNELS_FOR[a.kind].includes(a.channel)) throw appError("INVALID", `A ${a.kind.replace("_", " ")} can go to: ${CHANNELS_FOR[a.kind].join(", ")}.`);
    const title = a.title.trim().slice(0, 140);
    const body = a.body.trim();
    if (!title) throw appError("INVALID", "Give the draft a short title.");
    if (!body) throw appError("INVALID", "The text can't be empty.");
    if (body.length > 20_000) throw appError("INVALID", "The text is longer than 20,000 characters. Split it into smaller drafts.");
    const destinationUrl = a.destinationUrl?.trim() || undefined;
    if (destinationUrl && !/^https:\/\/[^\s]+$/i.test(destinationUrl)) throw appError("INVALID", "Links must start with https://");
    const hashtags = (a.hashtags ?? []).map((h) => h.trim().replace(/^#/, "").slice(0, 60)).filter(Boolean).slice(0, 30);
    const problems = lengthProblems(a.channel, body, hashtags, destinationUrl);
    if (problems.length) throw appError("INVALID", problems.join(" "));

    const recent = await ctx.db
      .query("artifacts")
      .withIndex("by_agent_token", (q) => q.eq("agentTokenId", token._id).gt("createdAt", Date.now() - DAY))
      .take(AGENT_DRAFTS_PER_DAY);
    if (recent.length >= AGENT_DRAFTS_PER_DAY) throw appError("LIMIT_REACHED", `This agent has saved ${AGENT_DRAFTS_PER_DAY} drafts in the last day. Review those first, or try again tomorrow.`);

    let asset: Doc<"assets"> | null = null;
    if (a.imageAssetId) {
      const id = ctx.db.normalizeId("assets", a.imageAssetId);
      asset = assertSameOrg(id ? await ctx.db.get(id) : null, org._id, "image");
      if (asset.archived || (!asset.storageId && !asset.r2Key)) throw appError("INVALID", "That image isn't available any more. Pick another from list_images.");
    }
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Finish setting up the business in ClimbOS first.");

    const artifactId = await insertArtifact(ctx, {
      orgId: org._id,
      businessId: business._id,
      factIds: [],
      createdBy: user._id,
      item: {
        kind: a.kind,
        channel: a.channel,
        title,
        headline: a.headline?.trim().slice(0, 500) || undefined,
        body,
        callToAction: a.callToAction?.trim().slice(0, 120) || undefined,
        destinationUrl,
        hashtags,
        altText: a.altText?.trim().slice(0, 1000) || undefined,
        imageStorageId: asset?.storageId,
        imageR2Key: asset?.r2Key,
        imageLabel: asset ? assetPostLabel(asset) : undefined,
        factIndexes: [],
        role: ROLE_FOR[a.kind],
      },
    });
    await ctx.db.patch(artifactId, { agentTokenId: token._id, agentName: token.name });
    const version = (await ctx.db.get(artifactId))?.currentVersionId;
    const unsupportedClaims = version ? ((await ctx.db.get(version))?.unsupportedClaims ?? []) : [];
    await audit(ctx, { orgId: org._id, actorType: "agent", actorId: user._id, action: "content.agent_draft_saved", subjectType: "artifact", subjectId: artifactId, summary: `Agent "${token.name}" saved a draft it wrote: "${title}". No ClimbOS credits used; it waits for review.` });
    return { artifactId, unsupportedClaims };
  },
});

/** What an outside agent needs to write in this business's voice: brand rules and owner-checked facts only. */
export const context = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) return { business: null, voice: null, facts: [], factsTruncated: false };
    const brand = await ctx.db.query("brandProfiles").withIndex("by_business", (q) => q.eq("businessId", business._id)).first();
    // Only facts the owner confirmed or edited: unreviewed ones may be wrong and must not be stated as true.
    const rows = (await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", business._id)).take(300))
      .filter((f) => f.orgId === org._id && (f.reviewState === "confirmed" || f.reviewState === "edited"));
    const facts = rows.slice(0, 80).map((f) => ({ category: f.category, statement: f.statement.slice(0, 400) }));
    return {
      business: { name: business.name, website: business.website ?? null, summary: business.summary?.slice(0, 600) ?? null },
      voice: brand
        ? {
            description: brand.voice,
            toneWords: brand.toneWords,
            doNots: brand.doNots,
            learnedRules: (brand.learnedRules ?? []).map((r) => r.text),
            approvedExamples: (brand.approvedExamples ?? []).map((e) => e.slice(0, 1000)),
            humor: brand.socialHumor ?? "restrained",
          }
        : null,
      facts,
      factsTruncated: rows.length > facts.length,
    };
  },
});
