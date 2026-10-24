import { v } from "convex/values";
import { candidateNameMatchesSite, selectWatchCandidates } from "../shared/competitors/candidates";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { sameCompetitorSite } from "../shared/competitors/candidates";

/** Validate homepage identity before filling unused watch slots. Fetches are free and bounded. */
export const seedFromInsights = internalAction({
  args: { orgId: v.id("organizations"), businessId: v.id("businesses"), insightsAt: v.number() },
  handler: async (ctx: ActionCtx, { orgId, businessId, insightsAt }): Promise<number> => {
    const context = await ctx.runQuery(internal.competitors.discoveryContext, { orgId, businessId, insightsAt });
    if (!context) return 0;
    const available = Math.max(0, context.limit - context.watches.filter((w) => w.active).length);
    const candidates = selectWatchCandidates(context.candidates, context.website, context.watches.map((w) => w.url), 6);
    const verified: { name: string; url: string; sourceUrl: string; kind: "direct" }[] = [];
    for (const candidate of candidates) {
      if (verified.length >= available) break;
      if (!candidate.sourceUrl || candidate.kind === "adjacent") continue;
      let finalUrl: string;
      let visibleText: string;
      if (process.env.CLIMBOS_FAKE_LLM) {
        finalUrl = candidate.url;
        visibleText = process.env.CLIMBOS_FAKE_SITE_TEXT ?? candidate.name;
      } else {
        const result = await ctx.runAction(internal.competitorActions.verifyCandidateSite, { url: candidate.url });
        if ("error" in result) continue;
        finalUrl = result.finalUrl;
        visibleText = result.visibleText;
      }
      if (!sameCompetitorSite(candidate.url, finalUrl) || !candidateNameMatchesSite(candidate.name, finalUrl, visibleText)) continue;
      verified.push({ name: candidate.name, url: candidate.url, sourceUrl: candidate.sourceUrl, kind: "direct" });
    }
    return (await ctx.runMutation(internal.competitors.seedWatches, { orgId, businessId, insightsAt, candidates: verified })).length;
  },
});
