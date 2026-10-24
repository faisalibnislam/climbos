import { v } from "convex/values";
import { summarizeAiSearchPanel, summarizeAiSearchVisibility, type AiSearchObservation } from "../shared/aiSearch/visibility";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";

const MAX_OBSERVATIONS = 500;
const MAX_QUERY = 500;
const MAX_LOCATION = 160;
const MAX_EXCERPT = 6_000;
const MAX_CITATIONS = 30;
const MAX_COMPETITORS = 30;

function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString().slice(0, 2_000);
  } catch {
    return null;
  }
}

function labels(items: string[], max: number, label: string): string[] {
  const out = new Map<string, string>();
  for (const item of items) {
    const value = item.trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (value.length > 200) throw appError("INVALID", `${label} entries must be 200 characters or fewer.`);
    const key = value.toLocaleLowerCase();
    if (!out.has(key)) out.set(key, value);
  }
  if (out.size > max) throw appError("INVALID", `Record no more than ${max} ${label.toLowerCase()} per observation.`);
  return [...out.values()];
}

/** Record one owner-observed answer. ClimbOS does not claim direct AI-search provider access. */
export const recordObservation = mutation({
  args: {
    slug: v.string(),
    provider: v.union(v.literal("chatgpt"), v.literal("gemini"), v.literal("perplexity"), v.literal("google_ai_overview"), v.literal("other")),
    query: v.string(),
    location: v.optional(v.string()),
    checkedAt: v.number(),
    answerStatus: v.union(v.literal("answered"), v.literal("no_answer"), v.literal("failed")),
    brandMention: v.union(v.literal("yes"), v.literal("no"), v.literal("unknown")),
    sentiment: v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"), v.literal("mixed"), v.literal("unknown")),
    citedUrls: v.array(v.string()),
    competitorMentions: v.array(v.string()),
    answerExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const query = args.query.trim().replace(/\s+/g, " ");
    if (!query || query.length > MAX_QUERY) throw appError("INVALID", `Enter a search question (up to ${MAX_QUERY} characters).`);
    if (!Number.isSafeInteger(args.checkedAt) || args.checkedAt > Date.now()) throw appError("INVALID", "The observation date must be valid and cannot be in the future.");
    const location = args.location?.trim().replace(/\s+/g, " ");
    if (location && location.length > MAX_LOCATION) throw appError("INVALID", `Location must be ${MAX_LOCATION} characters or fewer.`);
    const cleanedCitations = args.citedUrls.filter((url) => url.trim()).map((raw) => {
      const url = safeHttpUrl(raw);
      if (!url) throw appError("INVALID", "Citations must be valid HTTP or HTTPS page addresses.");
      return url;
    });
    const citedUrls = [...new Set(cleanedCitations)];
    if (citedUrls.length > MAX_CITATIONS) throw appError("INVALID", `Record no more than ${MAX_CITATIONS} cited pages per observation.`);
    const competitorMentions = labels(args.competitorMentions, MAX_COMPETITORS, "Competitor names");
    const answerExcerpt = args.answerExcerpt?.trim();
    if (answerExcerpt && answerExcerpt.length > MAX_EXCERPT) throw appError("INVALID", `Keep the answer excerpt to ${MAX_EXCERPT} characters or fewer.`);
    if (args.answerStatus === "answered" && !answerExcerpt) throw appError("INVALID", "Include a short excerpt of the answer so this observation can be reviewed.");
    if (args.answerStatus !== "answered" && (args.brandMention !== "unknown" || args.sentiment !== "unknown" || citedUrls.length || competitorMentions.length || answerExcerpt)) {
      throw appError("INVALID", "A failed or empty response cannot be counted as an answer, mention, sentiment or citation.");
    }
    if (args.brandMention !== "yes" && args.sentiment !== "unknown") throw appError("INVALID", "Only label sentiment when the answer mentions the business.");

    const id = await ctx.db.insert("aiSearchObservations", {
      orgId: org._id,
      provider: args.provider,
      query,
      ...(location ? { location } : {}),
      checkedAt: args.checkedAt,
      answerStatus: args.answerStatus,
      brandMention: args.brandMention,
      sentiment: args.sentiment,
      citedUrls,
      competitorMentions,
      ...(answerExcerpt ? { answerExcerpt } : {}),
      evidenceBasis: "owner_observed",
      enteredBy: user._id,
      enteredAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ai_search.observation_recorded", subjectType: "business", subjectId: String(id), summary: `Recorded an AI-search observation for “${query.slice(0, 80)}”.` });
    return id;
  },
});

/** Bounded, descriptive report. Rates describe only recorded samples, never all platform answers. */
export const report = query({
  args: { slug: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { slug, days }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const requestedDays = days !== undefined && Number.isFinite(days) ? days : 90;
    const windowDays = Math.max(1, Math.min(365, Math.floor(requestedDays)));
    const since = Date.now() - windowDays * 86_400_000;
    const fetched = await ctx.db.query("aiSearchObservations")
      .withIndex("by_org_checked", (q) => q.eq("orgId", org._id).gte("checkedAt", since))
      .order("desc")
      .take(MAX_OBSERVATIONS + 1);
    const truncated = fetched.length > MAX_OBSERVATIONS;
    const observations = fetched.slice(0, MAX_OBSERVATIONS);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const summary = summarizeAiSearchVisibility(observations as AiSearchObservation[], business?.website);
    const panelSummary = summarizeAiSearchPanel(observations as AiSearchObservation[], business?.website);
    return {
      windowDays,
      observationCount: observations.length,
      truncated,
      summary,
      panelSummary,
      observations: observations.map(({ _id, provider, query, location, checkedAt, answerStatus, brandMention, sentiment, citedUrls, competitorMentions, answerExcerpt, enteredAt }) => ({
        id: _id,
        provider,
        query,
        location: location ?? null,
        checkedAt,
        answerStatus,
        brandMention,
        sentiment,
        citedUrls,
        competitorMentions,
        answerExcerpt: answerExcerpt ?? null,
        enteredAt,
        evidenceBasis: "owner_observed" as const,
      })),
      interpretation: [
        "These figures describe owner-recorded samples only; prompts, platform versions, geography and answer variation can change results.",
        "A mention or citation is not evidence that content changes caused visibility or business growth.",
        "Content readiness and qualified visits, leads or customers are separate measures and are not included in these rates.",
      ],
    };
  },
});
