import { v } from "convex/values";
import { candidateNameMatchesSite, selectWatchCandidates } from "../shared/competitors/candidates";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, type ActionCtx, type MutationCtx } from "./_generated/server";
import { sameCompetitorSite } from "../shared/competitors/candidates";
import { ACTIVE_RUN_STATUSES, assertNoActiveRun, createRunWithReservation, latestRunOfKind } from "./engine";
import { resolveAiMode } from "./lib/aiMode";
import { planJob } from "./lib/jobPlans";
import { appError } from "./lib/tenancy";

const DAY = 86_400_000;
const RETRY_DAYS = 7;

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

/** Runs bounded due refreshes; actual model work still goes through the metered durable job engine. */
export const refreshDue = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ checked: number; started: number }> => {
    await ctx.runMutation(internal.competitorDiscovery.backfillLegacySchedules, {});
    const businessIds = await ctx.runQuery(internal.competitors.dueForResearch, { now: Date.now(), limit: 20 });
    let started = 0;
    for (const businessId of businessIds) {
      if (await ctx.runMutation(internal.competitorDiscovery.startScheduledRefresh, { businessId })) started++;
    }
    return { checked: businessIds.length, started };
  },
});

/** Progressively seeds next-refresh times for legacy businesses without a full-table scan. */
export const backfillLegacySchedules = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx): Promise<{ workspaces: number; businesses: number }> => {
    const orgs = (await ctx.db.query("organizations").withIndex("by_kind_created", (q) => q.eq("kind", "customer")).take(5000))
      .filter((org) => !org.deletedAt && !org.competitorResearchBackfillDone)
      .slice(0, 10);
    let businessesUpdated = 0;
    for (const org of orgs) {
      const page = await ctx.db.query("businesses")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .paginate({ numItems: 100, cursor: org.competitorResearchBackfillCursor ?? null });
      const cadence = org.competitorResearchRefreshDays ?? 90;
      for (const business of page.page) {
        if (business.insights && business.competitorResearchNextAt === undefined && cadence > 0) {
          await ctx.db.patch(business._id, {
            competitorResearchCompletedAt: business.competitorResearchCompletedAt ?? business.insights.generatedAt,
            competitorResearchNextAt: business.competitorResearchStaleAt ?? (business.competitorResearchCompletedAt ?? business.insights.generatedAt) + cadence * DAY,
          });
          businessesUpdated++;
        }
      }
      await ctx.db.patch(org._id, {
        competitorResearchBackfillCursor: page.isDone ? undefined : page.continueCursor,
        competitorResearchBackfillDone: page.isDone,
      });
    }
    return { workspaces: orgs.length, businesses: businessesUpdated };
  },
});

/** Rechecks due state transactionally, respects credit/approval limits and queues only one business refresh. */
export const startScheduledRefresh = internalMutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx: MutationCtx, { businessId }): Promise<boolean> => {
    const business = await ctx.db.get(businessId);
    if (!business || !business.competitorResearchNextAt || business.competitorResearchNextAt > Date.now()) return false;
    if (!business.insights) {
      await ctx.db.patch(business._id, { competitorResearchNextAt: undefined, competitorResearchStaleAt: undefined });
      return false;
    }
    const org = await ctx.db.get(business.orgId);
    if (!org || org.deletedAt || org.kind === "demo") {
      await ctx.db.patch(business._id, { competitorResearchNextAt: undefined, competitorResearchLastStatus: undefined });
      return false;
    }
    const cadence = org.competitorResearchRefreshDays ?? 90;
    if (cadence === 0) {
      await ctx.db.patch(business._id, { competitorResearchNextAt: undefined, competitorResearchLastStatus: undefined });
      return false;
    }
    const prior = await latestRunOfKind(ctx, org._id, "onboarding_research");
    if (prior && ACTIVE_RUN_STATUSES.includes(prior.status)) return false;
    const retryAt = Date.now() + RETRY_DAYS * DAY;
    if (!business.website) {
      await ctx.db.patch(business._id, { competitorResearchNextAt: retryAt, competitorResearchLastStatus: "no_website" });
      return false;
    }
    try {
      await assertNoActiveRun(ctx, org._id, "onboarding_research", "Research is already running.");
      const aiMode = await resolveAiMode(ctx, org, "onboarding_research");
      const plan = planJob("onboarding_research", { pages: 3 }, { fixture: false, mode: aiMode });
      const runId = await createRunWithReservation(ctx, {
        org,
        kind: plan.kind,
        title: "Refresh competitor and business research",
        roles: plan.roles,
        input: { website: business.website, hasOwnerText: false, refreshReason: "scheduled_competitor_research" },
        steps: plan.steps,
        meters: plan.meters,
        isFixture: false,
        aiMode,
        enforceCreditApprovalLimit: true,
      });
      await ctx.db.patch(business._id, { competitorResearchNextAt: retryAt, competitorResearchLastStatus: "scheduled" });
      await ctx.scheduler.runAfter(0, internal.jobs.onboardingResearch, { runId });
      return true;
    } catch (error) {
      const waitingForOwner = error instanceof Error && /approval limit/i.test(error.message);
      await ctx.db.patch(business._id, {
        competitorResearchNextAt: retryAt,
        competitorResearchLastStatus: waitingForOwner ? "waiting_for_owner" : "waiting_for_credits",
      });
      if (waitingForOwner) return false;
      if (error instanceof Error && !/credit|payment|subscription|paused|fleet|limit/i.test(error.message)) throw appError("INVALID", "Scheduled competitor research could not be queued.");
      return false;
    }
  },
});
