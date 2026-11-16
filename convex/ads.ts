import { v } from "convex/values";
import { requirePaid } from "./lib/access";
import { createPausedSearchCampaign, getCampaignActivationSettings as readGoogleActivation, getCampaignState, reconcileCampaignByName as findGoogleCampaign, setCampaignStatus as setGoogleStatus } from "../shared/integrations/googleAds";
import { formatMinorMoney } from "../shared/economics/currency";
import {
  createPausedCampaign as createMetaPaused,
  getAccountSpendCapUsage,
  getCampaignActivationSettings as readMetaActivation,
  getCampaign as getMetaCampaign,
  reconcileCampaignByName as findMetaCampaign,
  SET_META_CAMPAIGN_STATUS_ACTION,
  setCampaignStatus as setMetaStatus,
} from "../shared/integrations/metaAds";
import { approvalHash, can, canonicalJson, checkApprovalForExecution, sha256Hex } from "../shared/policy";
import { AD_BUDGET_UNIT_VERSION, campaignBudgetProblem, knownAdBudget, parseAdBudget, maxRolling31DaySpend, validCampaignDateRange } from "../shared/policy/campaignBudget";
import { CAMPAIGN_REPORT_VERSION, campaignReportWindow, validateCampaignReportTotals } from "../shared/acquisition/campaignReport";
import { campaignActivationProblem } from "../shared/policy/campaignActivation";
import { campaignActivationObservationV } from "./lib/campaignActivation";
import { campaignApprovalScope } from "../shared/policy/campaignScope";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { refuseInCopilot } from "./lib/approvals";

/**
 * Ads: campaigns are always created PAUSED, activated only by an approval bound
 * to the exact campaign, daily budget, dates, destination and policy version,
 * and paused under the preapproved stop rule. ClimbOS never raises a budget by
 * itself, and can't promise an instant zero-spend stop (platform reporting lag).
 */

const GOOGLE_SET_STATUS = "google_ads.set_campaign_status";
const CAMPAIGN_RECOVERY_WAIT_MS = 5 * 60_000;

function providerCampaignName(name: string, approvalId: Id<"approvals">): string {
  const reference = ` [ClimbOS ${approvalId}]`;
  return name.trim().slice(0, 255 - reference.length) + reference;
}

function unresolvedWrites(rows: Doc<"approvals">[], c: Doc<"campaigns">) {
  return rows.filter(a => a.orgId === c.orgId && a.executionStartedAt !== undefined && a.executionReconciledAt === undefined
    && (a.executionFinishedAt === undefined || a.executionOutcome === "uncertain" || (c.status === "uncertain" && a.executionOutcome === undefined && a.status === "invalidated")));
}

function campaignActionProblem(c: Doc<"campaigns">, action: string): string | null {
  if (c.channel !== "google_search_ad" && c.channel !== "meta_ad") return "This campaign type cannot use paid-ad publishing.";
  if (action === "create_paused") return c.status === "needs_approval" && !c.externalId ? null : "This campaign isn't waiting to be created.";
  if (action === "activate") return ["created_paused", "paused"].includes(c.status) && c.externalId ? null : "Create the campaign (paused) first.";
  return "This campaign action is not supported.";
}

function campaignContentHash(c: Doc<"campaigns">, action: string) {
  return sha256Hex(canonicalJson({ name: c.name, channel: c.channel, action, stopRules: c.stopRules }));
}

async function campaignApprovals(ctx: QueryCtx | MutationCtx, campaignId: Id<"campaigns">) {
  const rows = await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", campaignId)).take(1001);
  if (rows.length > 1000) throw appError("LIMIT_REACHED", "This campaign's approval history needs review before another write.");
  return rows;
}

async function currentBudgetProblem(ctx: QueryCtx | MutationCtx, c: Doc<"campaigns">): Promise<string | null> {
  const problem = campaignBudgetProblem(c);
  if (problem) return problem;
  const policy = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", c.orgId).eq("active", true)).first();
  if (!policy || !knownAdBudget(policy.maxMonthlyAdSpendMinor, policy.currency, policy.budgetUnitVersion)) return "An owner must confirm the monthly budget in Settings → Policies before campaign approval.";
  if (policy.currency !== c.currency) return "The campaign and current spending policy use different currencies. Review the budget before approving.";
  const today = new Date().toISOString().slice(0, 10);
  if (c.endDate! < today) return "This campaign's planned dates have ended. Prepare a new campaign with reviewed dates.";
  const reservations = await ctx.db.query("campaigns").withIndex("by_org", q => q.eq("orgId", c.orgId)).take(1001);
  if (reservations.length > 1000) return "Too many campaigns to verify the shared ad budget. Review older campaigns first.";
  const planned = maxRolling31DaySpend(reservations, policy.currency, today);
  if (!planned.ok) return "The shared campaign budget needs review: an existing amount, currency or schedule is unknown.";
  if (planned.maxSpendMinor > policy.maxMonthlyAdSpendMinor) return "The planned campaigns exceed your current monthly ad budget. Lower or reschedule them, or ask an owner to change the policy.";
  return null;
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(50);
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    const conns = await ctx.db
      .query("connections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(50);
    const connected = (p: string) => conns.some((c) => c.provider === p && c.status === "connected" && (c.isFixture || Boolean(c.externalAccountId)));
    const campaigns = await Promise.all(rows.map(async (c) => {
      const campaignConnection = c.connectionId ? await ctx.db.get(c.connectionId) : null;
      const performance = await ctx.db
        .query("campaignPerformance")
        .withIndex("by_org_campaign", (q) => q.eq("orgId", org._id).eq("campaignId", c._id))
        .first();
      let performanceReviewReason: string | null = null;
      if (performance) {
        if (performance.validationVersion !== CAMPAIGN_REPORT_VERSION || !performance.timeZone || performance.requestedAt === undefined) performanceReviewReason = "Refresh results to verify this older report's source and account timezone.";
        else if (!campaignConnection || campaignConnection.orgId !== org._id || performance.connectionId !== c.connectionId || performance.externalAccountId !== campaignConnection.externalAccountId || performance.externalCampaignId !== c.externalId || performance.currency !== c.currency || performance.source !== campaignConnection.provider) performanceReviewReason = "The campaign or account changed. Refresh results before using the previous report.";
        else {
          try {
            const window = campaignReportWindow(c, performance.timeZone, performance.requestedAt);
            if (window.startDate !== performance.startDate || window.endDate !== performance.endDate) throw new Error("Report dates no longer match the campaign.");
            validateCampaignReportTotals(performance);
          } catch { performanceReviewReason = "This report needs a fresh read before its totals can be used."; }
        }
      }
      const approvals = await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", c._id)).take(1001);
      const writeState = approvals.length > 1000 ? "review_required" as const
        : unresolvedWrites(approvals, c).length > 0 ? "started" as const
        : approvals.some(a => a.orgId === org._id && a.status === "approved" && a.expiresAt > Date.now()) ? "queued" as const : null;
      const recovery = unresolvedWrites(approvals, c);
      const latest = approvals.filter(a => a.orgId === org._id).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0];
      return {
        id: c._id,
        artifactId: c.artifactId ?? null,
        accountConnected: Boolean(campaignConnection?.status === "connected" && (campaignConnection.isFixture || campaignConnection.externalAccountId)) || connected(c.channel === "google_search_ad" ? "google_ads" : "meta_ads"),
        name: c.name,
        channel: c.channel,
        status: c.status,
        writeState,
        lastWriteProblem: approvals.length <= 1000 && latest?.executionOutcome === "failed" ? latest.invalidatedReason ?? "The last request failed. Review the campaign before trying again." : null,
        recoveryApprovalId: approvals.length <= 1000 && recovery.length === 1 ? recovery[0]._id : null,
        recoveryMessage: recovery.length === 1 ? recovery[0].recoveryMessage ?? null : null,
        recoveryCheckedAt: recovery.length === 1 ? recovery[0].recoveryCheckedAt ?? null : null,
        monitorConfigured: Boolean(c.monitorApprovalId),
        budgetReviewReason: campaignBudgetProblem(c),
        dailyBudgetMinor: c.dailyBudgetMinor ?? 0,
        budgetEnvelopeMinor: c.budgetEnvelopeMinor,
        currency: c.currency,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        targetCostPerConversionMinor: c.targetCostPerConversionMinor ?? null,
        conversionActionType: c.conversionActionType ?? null,
        reviewAfterDays: c.reviewAfterDays ?? null,
        activatedAt: c.activatedAt ?? null,
        destinationUrl: c.destinationUrl ?? null,
        stopRules: c.stopRules,
        externalId: c.externalId ?? null,
        performance: performanceReviewReason ? null : performance ?? null,
        performanceReviewReason,
      };
    }));
    return {
      monthlyEnvelopeMinor: policy?.maxMonthlyAdSpendMinor ?? 0,
      monthlyBudgetNeedsReview: !policy || !knownAdBudget(policy.maxMonthlyAdSpendMinor, policy.currency, policy.budgetUnitVersion),
      currency: policy?.currency ?? org.currency,
      googleAdsConnected: connected("google_ads"),
      metaAdsConnected: connected("meta_ads"),
      campaigns,
    };
  },
});

export const performanceSyncContext = internalQuery({
  args: { orgId: v.id("organizations"), campaignId: v.id("campaigns") },
  handler: async (ctx, { orgId, campaignId }) => {
    const campaign = assertSameOrg(await ctx.db.get(campaignId), orgId, "campaign");
    const org = await ctx.db.get(orgId);
    const connection = campaign.connectionId ? await ctx.db.get(campaign.connectionId) : null;
    const expectedProvider = campaign.channel === "google_search_ad" ? "google_ads" : campaign.channel === "meta_ad" ? "meta_ads" : null;
    if (!expectedProvider) throw appError("UNAVAILABLE", "Live campaign results are not available for this campaign type.");
    if (!connection || connection.orgId !== orgId || connection.provider !== expectedProvider || connection.status !== "connected" || connection.isFixture) {
      throw appError("UNAVAILABLE", `Connect a live ${expectedProvider === "google_ads" ? "Google Ads" : "Meta Ads"} account before reading campaign results.`);
    }
    if (!campaign.externalId || (!campaign.activatedAt && !campaign.startDate) || !["active", "paused", "ended"].includes(campaign.status)) {
      throw appError("INVALID", "Start this campaign before reading its performance.");
    }
    return { campaign, connection, timeZone: org?.timezone ?? "UTC" };
  },
});

/** Meta: the owner confirms which reported action type counts as this campaign's conversion; advice only, no campaign change. */
export const setConversionAction = mutation({
  args: { slug: v.string(), campaignId: v.id("campaigns"), actionType: v.union(v.string(), v.null()) },
  handler: async (ctx, { slug, campaignId, actionType }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const campaign = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    if (campaign.channel !== "meta_ad") throw appError("INVALID", "Only Meta campaigns need a conversion action choice; Google reports conversions directly.");
    if (actionType !== null) {
      const performance = await ctx.db.query("campaignPerformance").withIndex("by_org_campaign", (q) => q.eq("orgId", org._id).eq("campaignId", campaign._id)).first();
      if (!performance?.reportedActions?.some((action) => action.actionType === actionType)) throw appError("INVALID", "Choose an action type Meta reported for this campaign. Refresh results first.");
    }
    await ctx.db.patch(campaign._id, actionType === null
      ? { conversionActionType: undefined, conversionActionSetBy: undefined, conversionActionSetAt: undefined }
      : { conversionActionType: actionType.slice(0, 120), conversionActionSetBy: user._id, conversionActionSetAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "campaign.conversion_action", subjectType: "campaign", subjectId: campaign._id, summary: actionType === null ? "Cleared the Meta conversion action." : `Counting Meta action "${actionType.slice(0, 80)}" as this campaign's conversion.` });
  },
});

export const recordPerformanceSnapshot = internalMutation({
  args: {
    slug: v.string(),
    campaignId: v.id("campaigns"),
    connectionId: v.id("connections"),
    source: v.union(v.literal("google_ads"), v.literal("meta_ads")),
    status: v.union(v.literal("ready"), v.literal("error")),
    startDate: v.string(),
    endDate: v.string(),
    currency: v.string(),
    requestedAt: v.number(),
    timeZone: v.string(),
    externalAccountId: v.string(),
    externalCampaignId: v.string(),
    rowCount: v.number(),
    spendMinor: v.optional(v.number()),
    impressions: v.optional(v.number()),
    clicks: v.optional(v.number()),
    conversions: v.optional(v.number()),
    conversionValueMinor: v.optional(v.number()),
    reportedActions: v.optional(v.array(v.object({ actionType: v.string(), value: v.number() }))),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "view");
    const campaign = assertSameOrg(await ctx.db.get(args.campaignId), org._id, "campaign");
    const expectedChannel = args.source === "google_ads" ? "google_search_ad" : "meta_ad";
    const expectedProvider = args.source;
    if (campaign.connectionId !== args.connectionId || campaign.channel !== expectedChannel) throw appError("FORBIDDEN", "This account is no longer connected to the campaign.");
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.orgId !== org._id || connection.provider !== expectedProvider || connection.status !== "connected" || connection.isFixture) throw appError("FORBIDDEN", "The connected account changed before this result could be saved.");
    if (connection.externalAccountId !== args.externalAccountId || campaign.externalId !== args.externalCampaignId || campaign.currency !== args.currency) throw appError("FORBIDDEN", "The campaign or account changed before this report finished. Refresh results again.");
    if (!Number.isSafeInteger(args.requestedAt) || args.requestedAt > Date.now() || !Number.isSafeInteger(args.rowCount) || args.rowCount < 1 || args.rowCount > 90) throw appError("INVALID", "The report retrieval details are invalid.");
    const window = campaignReportWindow(campaign, args.timeZone, args.requestedAt);
    if (window.startDate !== args.startDate || window.endDate !== args.endDate) throw appError("INVALID", "The campaign report dates changed before saving.");
    if (args.status === "ready") validateCampaignReportTotals(args);
    const old = await ctx.db.query("campaignPerformance")
      .withIndex("by_org_campaign", (q) => q.eq("orgId", org._id).eq("campaignId", campaign._id))
      .first();
    if (old?.requestedAt !== undefined && old.requestedAt > args.requestedAt) throw appError("INVALID", "A newer report is already saved. Refresh to see it.");
    if (old) await ctx.db.delete(old._id);
    const syncedAt = Date.now();
    await ctx.db.insert("campaignPerformance", {
      orgId: org._id,
      campaignId: campaign._id,
      connectionId: connection._id,
      source: args.source,
      status: args.status,
      startDate: args.startDate,
      endDate: args.endDate,
      currency: args.currency,
      spendMinor: args.spendMinor,
      impressions: args.impressions,
      clicks: args.clicks,
      conversions: args.conversions,
      conversionValueMinor: args.conversionValueMinor,
      reportedActions: args.reportedActions,
      syncedAt,
      requestedAt: args.requestedAt,
      timeZone: args.timeZone,
      externalAccountId: args.externalAccountId,
      externalCampaignId: args.externalCampaignId,
      rowCount: args.rowCount,
      validationVersion: CAMPAIGN_REPORT_VERSION,
      error: args.error?.slice(0, 300),
    });
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: args.status === "ready" ? "campaign.performance_synced" : "campaign.performance_sync_failed",
      subjectType: "campaign",
      subjectId: campaign._id,
      summary: args.status === "ready"
        ? `Read ${args.source === "google_ads" ? "Google Ads" : "Meta Ads"} campaign metrics for ${args.startDate} through ${args.endDate}; no live settings were changed.`
        : `${args.source === "google_ads" ? "Google Ads" : "Meta Ads"} metric read did not complete: ${(args.error ?? "unknown error").slice(0, 180)}`,
    });
    return syncedAt;
  },
});

export const prepareCampaign = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    dailyBudget: v.number(),
    expectedCurrency: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    targetCostPerConversion: v.optional(v.number()),
    reviewAfterDays: v.number(),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "ad");
    if (a.kind !== "ad" || (a.channel !== "google_search_ad" && a.channel !== "meta_ad")) throw appError("INVALID", "Only ad drafts can become campaigns.");
    if (a.status !== "approved") throw appError("INVALID", "Approve the ad copy first.");
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (!policy || !knownAdBudget(policy.maxMonthlyAdSpendMinor, policy.currency, policy.budgetUnitVersion)) throw appError("INVALID", "An owner must confirm the monthly budget in Settings → Policies first.");
    if (args.expectedCurrency !== undefined && args.expectedCurrency !== policy.currency) throw appError("INVALID", "The budget currency changed. Reload and review the amounts before preparing.");
    const parsed = parseAdBudget(args.dailyBudget, policy.currency);
    if (!parsed.ok) throw appError("INVALID", parsed.error);
    const dailyMinor = parsed.minor;
    if (!(dailyMinor > 0)) throw appError("INVALID", "Enter a daily budget greater than 0.");
    if (!Number.isInteger(args.reviewAfterDays) || args.reviewAfterDays < 1 || args.reviewAfterDays > 90) throw appError("INVALID", "Choose a first review window from 1 to 90 days.");
    if (!validCampaignDateRange(args.startDate, args.endDate)) {
      throw appError("INVALID", "Pick a start date and an end date after it.");
    }
    const days = Math.round((Date.parse(args.endDate) - Date.parse(args.startDate)) / 86_400_000) + 1;
    if (!Number.isSafeInteger(dailyMinor * days)) throw appError("INVALID", "The planned campaign total is too large.");
    const envelope = policy?.maxMonthlyAdSpendMinor ?? 0;
    // Reserve every pending or live campaign across both ad providers in the
    // same transaction. This prevents parallel preparations from each using
    // the full owner-approved monthly envelope.
    const existing = await ctx.db.query("campaigns").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(1001);
    if (existing.length > 1000) throw appError("LIMIT_REACHED", "There are too many campaigns to safely calculate the shared ad budget. Review or end older campaigns first.");
    const planned = maxRolling31DaySpend(
      [
        ...existing,
        { status: "needs_approval", currency: policy.currency, dailyBudgetMinor: dailyMinor, budgetUnitVersion: AD_BUDGET_UNIT_VERSION, startDate: args.startDate, endDate: args.endDate },
      ],
      policy?.currency ?? org.currency,
      new Date().toISOString().slice(0, 10),
    );
    if (!planned.ok) throw appError("LIMIT_REACHED", "We can't safely calculate your shared ad budget from the existing campaign schedules. Resolve the currency or schedule details before preparing another campaign.");
    if (planned.maxSpendMinor > envelope) {
      throw appError("LIMIT_REACHED", `That would plan ${formatMinorMoney(planned.maxSpendMinor, policy.currency)} across Google and Meta in the 31-day window starting ${planned.windowStart}, above your approved monthly ad budget of ${formatMinorMoney(envelope, policy.currency)}. Lower or reschedule a campaign, or raise your budget in Settings → Policies.`);
    }
    const provider = a.channel === "google_search_ad" ? "google_ads" : "meta_ads";
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider))
      .first();
    const now = Date.now();
    let targetCostPerConversionMinor: number | undefined;
    if (args.targetCostPerConversion !== undefined) {
      if (!Number.isFinite(args.targetCostPerConversion) || args.targetCostPerConversion <= 0) throw appError("INVALID", "The target cost per conversion must be greater than zero.");
      const parsed = parseAdBudget(args.targetCostPerConversion, policy.currency);
      if (!parsed.ok || parsed.minor <= 0) throw appError("INVALID", "Enter a valid positive target cost for the workspace currency.");
      targetCostPerConversionMinor = parsed.minor;
    }
    const campaignId = await ctx.db.insert("campaigns", {
      orgId: org._id,
      artifactId: a._id,
      channel: a.channel,
      name: `ClimbOS · ${a.title.slice(0, 60)} · ${args.startDate}`,
      status: "needs_approval",
      budgetEnvelopeMinor: dailyMinor * days,
      dailyBudgetMinor: dailyMinor,
      budgetUnitVersion: AD_BUDGET_UNIT_VERSION,
      currency: policy?.currency ?? org.currency,
      startDate: args.startDate,
      endDate: args.endDate,
      targetCostPerConversionMinor,
      reviewAfterDays: args.reviewAfterDays,
      destinationUrl: ver?.destinationUrl,
      audience: undefined,
      stopRules: [
        `Pause if spend reaches ${formatMinorMoney(dailyMinor * days, policy.currency)} for this campaign`,
        "Pause if conversion tracking stops reporting for 48 hours",
        "Pause immediately when you press Pause all",
      ],
      connectionId: conn?.status === "connected" && (conn.isFixture || conn.externalAccountId) ? conn._id : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "campaign.prepared", subjectType: "campaign", subjectId: campaignId, summary: `Prepared paused campaign for "${a.title}" at ${formatMinorMoney(dailyMinor, policy.currency)}/day.` });
    return campaignId;
  },
});

/** Approve creating the campaign (paused) or activating it. Binds to the exact scope. */
export const decide = mutation({
  args: {
    slug: v.string(),
    campaignId: v.id("campaigns"),
    action: v.union(v.literal("create_paused"), v.literal("activate"), v.literal("reject")),
  },
  handler: async (ctx, { slug, campaignId, action }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const c = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    if (action !== "reject") await requirePaid(ctx, org, "ads_publish");
    if (action !== "reject") await refuseInCopilot(ctx, org._id, "launch ads");
    if (org.emergencyStop?.active && action !== "reject") throw appError("PAUSED", "All activity is paused. Resume activity first.");
    const previous = await campaignApprovals(ctx, c._id);
    if (unresolvedWrites(previous, c).length > 0) {
      throw appError("UNAVAILABLE", "A campaign write has already started. Check its result before trying again; rejecting cannot cancel a request already sent to the provider.");
    }
    if (action === "reject") {
      if (["active", "uncertain"].includes(c.status)) throw appError("INVALID", "Rejecting does not pause live ads. Use Pause all and check the provider result.");
      for (const a of previous) if (a.orgId === org._id && ["approved", "pending"].includes(a.status)) await ctx.db.patch(a._id, { status: "invalidated", invalidatedReason: "Campaign rejected by owner" });
      await ctx.db.patch(c._id, { status: c.externalId ? c.status : "draft", updatedAt: Date.now() });
      await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "campaign.rejected", subjectType: "campaign", subjectId: c._id, summary: "Cancelled pending campaign approval. No provider pause was requested or claimed." });
      return;
    }
    const actionProblem = campaignActionProblem(c, action);
    if (actionProblem) throw appError("INVALID", actionProblem);
    const budgetProblem = await currentBudgetProblem(ctx, c);
    if (budgetProblem) throw appError("INVALID", budgetProblem);
    if (!c.connectionId) throw appError("UNAVAILABLE", "Connect and select the advertiser account for this campaign first. Until then, use the ad drafts manually.");
    const connection = await ctx.db.get(c.connectionId);
    const provider = c.channel === "google_search_ad" ? "google_ads" : "meta_ads";
    if (!connection || connection.orgId !== org._id || connection.provider !== provider || connection.status !== "connected") {
      throw appError("UNAVAILABLE", "Reconnect the ad account for this campaign before approving a write.");
    }
    if (!connection.isFixture && !connection.externalAccountId) {
      throw appError("UNAVAILABLE", "Select the advertiser account for this workspace before approving a campaign write.");
    }
    const policyVersion = await activePolicyVersion(ctx, org._id);
    const now = Date.now();
    const expiresAt = now + 24 * 3_600_000;
    const scope = campaignApprovalScope(c, connection.externalAccountId);
    const contentHash = await campaignContentHash(c, action);
    const binding = { orgId: org._id, subjectType: "campaign_activation", subjectId: c._id, actionKind: action, contentHash, scope, policyVersion, expiresAt };
    for (const a of previous) {
      if (a.orgId !== org._id || !["approved", "pending"].includes(a.status)) continue;
      const same = a.status === "approved" && a.decidedBy === user._id && a.actionKind === action && a.expiresAt > now && a.approvalHash === await approvalHash({ ...binding, expiresAt: a.expiresAt });
      if (same) return; // The original queue entry owns this exact, still-valid approval.
      await ctx.db.patch(a._id, { status: "invalidated", invalidatedReason: "Superseded by a newly reviewed campaign approval" });
    }
    const approvalId = await ctx.db.insert("approvals", {
      orgId: org._id,
      subjectType: "campaign_activation",
      subjectId: c._id,
      actionKind: action,
      title: `${action === "activate" ? "Start" : "Create (paused)"}: ${c.name}`,
      contentHash,
      scope,
      costEstimateMicros: 0,
      policyVersion,
      approvalHash: await approvalHash(binding),
      status: "approved",
      decidedBy: user._id,
      decidedAt: now,
      expiresAt,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.ads.executeCampaignWrite, { campaignId: c._id, approvalId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `campaign.${action}_approved`, subjectType: "campaign", subjectId: c._id, summary: `Approved ${action === "activate" ? "starting" : "creating (paused)"} "${c.name}" at ${formatMinorMoney(c.dailyBudgetMinor ?? 0, c.currency)}/day.` });
  },
});

async function readCampaignContext(ctx: QueryCtx | MutationCtx, campaignId: Id<"campaigns">, approvalId?: Id<"approvals">) {
  const c = await ctx.db.get(campaignId);
  if (!c) return null;
  const org = await ctx.db.get(c.orgId);
  const conn = c.connectionId ? await ctx.db.get(c.connectionId) : null;
  const approval = approvalId ? await ctx.db.get(approvalId) : null;
  const policy = await ctx.db
    .query("autonomyPolicies")
    .withIndex("by_org_active", (q) => q.eq("orgId", c.orgId).eq("active", true))
    .first();
  const fleet = await ctx.db
    .query("fleetControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  return { campaign: c, org, connection: conn, approval, policyVersion: policy?.version ?? 1, allowPauseRules: policy?.allowAdPauseRules ?? true, fleetStop: Boolean(fleet?.emergencyStop) };
}

export const campaignContext = internalQuery({
  args: { campaignId: v.id("campaigns"), approvalId: v.optional(v.id("approvals")) },
  handler: (ctx, { campaignId, approvalId }) => readCampaignContext(ctx, campaignId, approvalId),
});

async function campaignWriteProblem(ctx: MutationCtx, cx: NonNullable<Awaited<ReturnType<typeof readCampaignContext>>>, dispatch = false): Promise<string | null> {
  const { campaign: c, approval: a, connection } = cx;
  if (!a || !cx.org || cx.org.deletedAt || a.orgId !== c.orgId || a.subjectType !== "campaign_activation" || a.subjectId !== c._id) return "The campaign approval is no longer available.";
  const previous = await campaignApprovals(ctx, c._id);
  if (unresolvedWrites(previous, c).some(other => !dispatch || other._id !== a._id)) return "Another campaign write has started. Check its result before trying again.";
  const problem = campaignActionProblem(c, a.actionKind);
  if (problem) return problem;
  const budgetProblem = await currentBudgetProblem(ctx, c);
  if (budgetProblem) return budgetProblem;
  const member = a.decidedBy ? await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", c.orgId).eq("userId", a.decidedBy!)).unique() : null;
  if (!member || member.status !== "active" || !can(member.role, "approve")) return "The approving member no longer has permission. Ask an authorized owner to review again.";
  try {
    await requirePaid(ctx, cx.org, "ads_publish");
    await refuseInCopilot(ctx, c.orgId, "launch ads");
  } catch {
    return "Your plan or approval mode no longer allows this campaign write.";
  }
  const provider = c.channel === "google_search_ad" ? "google_ads" : "meta_ads";
  const contentHash = await campaignContentHash(c, a.actionKind);
  const check = await checkApprovalForExecution({
    approval: a,
    current: { orgId: c.orgId, subjectType: "campaign_activation", subjectId: c._id, actionKind: a.actionKind, contentHash, scope: campaignApprovalScope(c, connection?.externalAccountId), policyVersion: cx.policyVersion, expiresAt: a.expiresAt },
    now: Date.now(), emergencyStop: Boolean(cx.org.emergencyStop?.active) || cx.fleetStop,
    capabilityReady: Boolean(connection && connection.orgId === c.orgId && connection.provider === provider && connection.status === "connected" && (connection.isFixture || connection.externalAccountId)),
  });
  if (!check.ok) return check.message;
  return null;
}

/** Validation and the at-most-once claim share a transaction with owner rejection. */
export const claimCampaignWrite = internalMutation({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals") },
  handler: async (ctx, { campaignId, approvalId }) => {
    const cx = await readCampaignContext(ctx, campaignId, approvalId);
    if (!cx?.approval || !cx.org || cx.org.deletedAt) return null;
    const { campaign: c, approval: a } = cx;
    if (a.orgId !== c.orgId || a.subjectType !== "campaign_activation" || a.subjectId !== c._id) return null;
    if (a.executionStartedAt !== undefined) return null; // A crash or lost response never authorizes replay.
    const problem = await campaignWriteProblem(ctx, cx);
    if (problem) return { context: cx, error: problem };
    const provider = c.channel === "google_search_ad" ? "google_ads" : "meta_ads";
    const execution = { executionStartedAt: Date.now(), campaignWriteProvider: provider, ...(a.actionKind === "create_paused" ? { campaignProviderName: providerCampaignName(c.name, a._id) } : {}) } as const;
    await ctx.db.patch(a._id, execution);
    return { context: { ...cx, approval: { ...a, ...execution } }, error: null };
  },
});

/** Recheck trusted state after provider reads, immediately before the single activation write. */
export const authorizeCampaignActivation = internalMutation({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals"), startedAt: v.number(), checkedAt: v.number(), observation: campaignActivationObservationV },
  handler: async (ctx, args) => {
    const cx = await readCampaignContext(ctx, args.campaignId, args.approvalId);
    const a = cx?.approval;
    if (!cx || !a || a.actionKind !== "activate" || a.executionStartedAt !== args.startedAt || a.executionFinishedAt !== undefined || a.executionReconciledAt !== undefined || a.campaignActivationDispatchedAt !== undefined) return { ok: false, message: "This activation attempt is no longer available. Refresh the campaign." };
    const problem = await campaignWriteProblem(ctx, cx, true);
    if (problem) return { ok: false, message: problem };
    const now = Date.now();
    if (!Number.isFinite(args.checkedAt) || args.checkedAt < args.startedAt || args.checkedAt > now || now - args.checkedAt > 60_000) return { ok: false, message: "The provider settings read is too old. Review and approve a fresh start request." };
    await ctx.db.patch(a._id, { campaignActivationCheck: { checkedAt: args.checkedAt, observation: args.observation } });
    const mismatch = campaignActivationProblem(cx.campaign, cx.connection?.externalAccountId ?? "", args.observation, now);
    if (mismatch) return { ok: false, message: mismatch };
    await ctx.db.patch(a._id, { campaignActivationDispatchedAt: now });
    return { ok: true, message: "Current provider budget checked against this approval." };
  },
});

export const recordCampaignResult = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    action: v.string(),
    status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain"), v.literal("fixture_verified")),
    newStatus: v.optional(v.union(v.literal("created_paused"), v.literal("active"), v.literal("paused"), v.literal("uncertain"))),
    externalId: v.optional(v.string()),
    summary: v.string(),
    activationNotDispatched: v.optional(v.boolean()),
    approvalId: v.optional(v.id("approvals")),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) return;
    const approval = args.approvalId ? await ctx.db.get(args.approvalId) : null;
    if (args.approvalId && (!approval || approval.orgId !== c.orgId || approval.subjectType !== "campaign_activation" || approval.subjectId !== c._id || approval.actionKind !== args.action)) return;
    if (approval?.executionReconciledAt !== undefined) return; // A late worker cannot overwrite a recovered observation.
    const receiptKey = `${c.orgId}:campaign:${c._id}:${args.action}:${args.approvalId ?? Date.now()}`;
    if (args.approvalId && await ctx.db.query("actionReceipts").withIndex("by_idempotency", q => q.eq("idempotencyKey", receiptKey)).first()) return;
    const notDispatched = args.activationNotDispatched === true && args.action === "activate" && args.status === "failed"
      && approval?.executionStartedAt !== undefined && approval.campaignActivationDispatchedAt === undefined && !args.externalId && !args.newStatus;
    if (args.activationNotDispatched && !notDispatched) return;
    let scopeChanged = false;
    if (approval?.executionStartedAt !== undefined) {
      const connection = c.connectionId ? await ctx.db.get(c.connectionId) : null;
      const provider = c.channel === "google_search_ad" ? "google_ads" : "meta_ads";
      const currentScope = campaignApprovalScope({ ...c, externalId: args.action === "create_paused" ? undefined : c.externalId }, connection?.externalAccountId);
      scopeChanged = !connection || connection.orgId !== c.orgId || connection.provider !== provider
        || (approval.campaignWriteProvider !== undefined && approval.campaignWriteProvider !== provider)
        || (args.action === "create_paused" && c.externalId !== undefined && c.externalId !== args.externalId)
        || canonicalJson(currentScope) !== canonicalJson(approval.scope) || await campaignContentHash(c, args.action) !== approval.contentHash;
    }
    scopeChanged = scopeChanged && !notDispatched; // No provider write occurred; do not manufacture an unknown outcome.
    const status = scopeChanged ? "uncertain" as const : args.status;
    const summary = scopeChanged ? `The campaign or account changed while the request was in flight. Check the originally approved account. Its returned result was ${args.status}; it was not applied to the changed campaign.` : args.summary;
    const newStatus = scopeChanged ? "uncertain" as const : args.newStatus;
    const now = Date.now();
    await ctx.db.insert("actionReceipts", {
      orgId: c.orgId,
      campaignId: c._id,
      provider: approval?.campaignWriteProvider ?? (scopeChanged ? "unknown" : c.channel === "google_search_ad" ? "google_ads" : "meta_ads"),
      action: args.action,
      idempotencyKey: receiptKey,
      status,
      externalId: args.externalId,
      summary: summary.slice(0, 400),
      createdAt: now,
      verifiedAt: status === "verified" || status === "fixture_verified" ? now : undefined,
    });
    if (newStatus) await ctx.db.patch(c._id, {
      status: newStatus,
      ...(!scopeChanged && args.externalId && !c.externalId ? { externalId: args.externalId } : {}),
      ...(newStatus === "active" && !c.activatedAt ? { activatedAt: now } : {}),
      updatedAt: now,
    });
    if (approval?.status === "approved") await ctx.db.patch(approval._id,
      status === "verified" || status === "fixture_verified"
        ? { status: "consumed" }
        : { status: "invalidated", invalidatedReason: status === "uncertain" ? "Provider outcome unknown; reconcile before trying again" : summary.slice(0, 400) });
    if (approval?.executionStartedAt !== undefined) await ctx.db.patch(approval._id, { executionFinishedAt: now, executionOutcome: status, ...(args.externalId ? { executionExternalId: args.externalId } : {}) });
    await audit(ctx, { orgId: c.orgId, actorType: "system", action: `campaign.${args.action}.${status}`, subjectType: "campaign", subjectId: c._id, summary: `${c.name}: ${summary}` });
  },
});

async function adCredentials(ctx: { runQuery: (q: typeof internal.connections.getSecret, a: { connectionId: Id<"connections"> }) => Promise<{ value: string; externalAccountId: string | null } | null> }, connectionId: Id<"connections">) {
  const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId });
  if (!secret) return null;
  try {
    const accessToken: unknown = JSON.parse(secret.value).accessToken;
    return typeof accessToken === "string" && accessToken.trim() ? { accessToken, accountId: secret.externalAccountId ?? "" } : null;
  } catch { return null; }
}

export const executeCampaignWrite = internalAction({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals") },
  handler: async (ctx, { campaignId, approvalId }) => {
    const claim = await ctx.runMutation(internal.ads.claimCampaignWrite, { campaignId, approvalId });
    if (!claim) return;
    const cx = claim.context;
    if (!cx.approval || !cx.org) return;
    const { campaign: c, approval } = cx;
    const action = approval.actionKind as "create_paused" | "activate";
    if (claim.error) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: claim.error, approvalId });
      return;
    }
    if (cx.connection?.isFixture) {
      await ctx.runMutation(internal.ads.recordCampaignResult, {
        campaignId,
        action,
        status: "fixture_verified",
        newStatus: action === "activate" ? "active" : "created_paused",
        externalId: c.externalId ?? `demo_${String(c._id).slice(-6)}`,
        summary: action === "activate" ? "Demo: simulated activation. No real ads ran and no money was spent." : "Demo: simulated paused campaign.",
        approvalId,
      });
      return;
    }
    const creds = await adCredentials(ctx, c.connectionId!);
    if (!creds) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: "The ad account connection was removed. Reconnect it.", approvalId });
      return;
    }
    if (creds.accountId !== (cx.connection?.externalAccountId ?? "")) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: "The selected advertiser account changed after approval. Review and approve this campaign again.", approvalId });
      return;
    }
    const authorizeActivation = async (read: Awaited<ReturnType<typeof readGoogleActivation>>, checkedAt: number) => {
      const gate = read.ok
        ? await ctx.runMutation(internal.ads.authorizeCampaignActivation, { campaignId, approvalId, startedAt: approval.executionStartedAt!, checkedAt, observation: read.data })
        : { ok: false, message: `Could not verify current provider settings. No start request was sent. ${read.providerMessage}` };
      if (!gate.ok) await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: gate.message, activationNotDispatched: true, approvalId });
      return gate.ok;
    };
    const approvedAt = approval.decidedAt ?? approval.createdAt;
    const approvedBy = String(approval.decidedBy ?? "owner");
    if (c.channel === "google_search_ad") {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!developerToken) {
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: "Google Ads isn't set up on ClimbOS yet (developer token pending).", approvalId });
        return;
      }
      const auth = { accessToken: creds.accessToken, developerToken, customerId: creds.accountId };
      if (action === "create_paused") {
        const res = await createPausedSearchCampaign({
          ...auth,
          today: new Date().toISOString().slice(0, 10),
          draft: {
            name: approval.campaignProviderName!,
            currency: c.currency,
            dailyBudgetMinor: c.dailyBudgetMinor ?? 0,
            maxDailyBudgetMinor: c.dailyBudgetMinor ?? 0,
            startDate: c.startDate!,
            endDate: c.endDate!,
            containsEuPoliticalAdvertising: false,
          },
        } as never);
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "created_paused" : res.status === "uncertain" ? "uncertain" : undefined, externalId: res.externalId, summary: res.status === "verified" ? "Created in Google Ads, paused, and confirmed." : (res.providerMessage ?? "Google Ads didn't accept the campaign."), approvalId });
      } else {
        const checkedAt = Date.now();
        if (!await authorizeActivation(await readGoogleActivation({ ...auth, campaignId: c.externalId ?? "" }), checkedAt)) return;
        const res = await setGoogleStatus({ ...auth, campaignId: c.externalId ?? "", status: "ENABLED", approval: { kind: GOOGLE_SET_STATUS, targetId: c.externalId ?? "", value: "ENABLED", approvedBy, approvedAt } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "active" : res.status === "uncertain" ? "uncertain" : undefined, summary: res.status === "verified" ? "Started in Google Ads and confirmed." : (res.providerMessage ?? "Google Ads didn't start the campaign."), approvalId });
      }
    } else {
      const call = { accessToken: creds.accessToken };
      if (action === "create_paused") {
        const account = await getAccountSpendCapUsage({ ...call, adAccountId: creds.accountId });
        if (!account.ok || account.data.currency !== c.currency.toUpperCase()) {
          await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: "The Meta ad account currency could not be confirmed as matching the approved campaign. Check the selected account before approving again.", approvalId });
          return;
        }
        const res = await createMetaPaused({ ...call, adAccountId: creds.accountId, draft: { name: approval.campaignProviderName!, objective: "OUTCOME_TRAFFIC", specialAdCategories: [], spendCapMinor: c.budgetEnvelopeMinor, maxSpendCapMinor: c.budgetEnvelopeMinor } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "created_paused" : res.status === "uncertain" ? "uncertain" : undefined, externalId: res.externalId, summary: res.status === "verified" ? "Created in Meta, paused, with a lifetime spend cap." : (res.providerMessage ?? "Meta didn't accept the campaign."), approvalId });
      } else {
        const checkedAt = Date.now();
        if (!await authorizeActivation(await readMetaActivation({ ...call, adAccountId: creds.accountId, campaignId: c.externalId ?? "" }), checkedAt)) return;
        const res = await setMetaStatus({ ...call, campaignId: c.externalId ?? "", status: "ACTIVE", approval: { kind: SET_META_CAMPAIGN_STATUS_ACTION, targetId: c.externalId ?? "", value: "ACTIVE", approvedBy, approvedAt } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "active" : res.status === "uncertain" ? "uncertain" : undefined, summary: res.status === "verified" ? "Started in Meta and confirmed." : (res.providerMessage ?? "Meta didn't start the campaign."), approvalId });
      }
    }
  },
});

type RecoveryContext = { campaign: Doc<"campaigns">; approval: Doc<"approvals">; connection: Doc<"connections">; isDemo: boolean; externalId?: string; providerName?: string; fingerprint: string };
type RecoveryArgs = { slug: string; campaignId: Id<"campaigns">; approvalId: Id<"approvals"> };

async function readRecoveryContext(ctx: QueryCtx | MutationCtx, args: RecoveryArgs): Promise<RecoveryContext> {
  const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
  const c = assertSameOrg(await ctx.db.get(args.campaignId), org._id, "campaign");
  const a = assertSameOrg(await ctx.db.get(args.approvalId), org._id, "campaign request");
  const pending = unresolvedWrites(await campaignApprovals(ctx, c._id), c);
  if (pending.length !== 1 || pending[0]._id !== a._id || a.subjectType !== "campaign_activation" || a.subjectId !== c._id || !["create_paused", "activate"].includes(a.actionKind)) throw appError("INVALID", "This request is no longer the single unresolved campaign action. Refresh its status.");
  if (Date.now() - a.executionStartedAt! < CAMPAIGN_RECOVERY_WAIT_MS) throw appError("INVALID", "Wait five minutes after the request starts before checking its provider result.");
  const connection = assertSameOrg(c.connectionId ? await ctx.db.get(c.connectionId) : null, org._id, "approved ad account");
  const provider = c.channel === "google_search_ad" ? "google_ads" : c.channel === "meta_ad" ? "meta_ads" : null;
  if (!provider || connection.provider !== provider || connection.status !== "connected" || !connection.externalAccountId || a.scope.connectionId !== connection._id || a.scope.externalAccountId !== connection.externalAccountId) throw appError("INVALID", "The approved ad account changed. Check the original account in the ad platform.");
  if (a.campaignWriteProvider && a.campaignWriteProvider !== provider) throw appError("INVALID", "The provider changed. Check the original approved account.");
  const currentScope = campaignApprovalScope({ ...c, externalId: a.actionKind === "create_paused" ? undefined : c.externalId }, connection.externalAccountId);
  if (canonicalJson(currentScope) !== canonicalJson(a.scope) || await campaignContentHash(c, a.actionKind) !== a.contentHash) throw appError("INVALID", "Campaign terms changed. Check the original approved request in the ad platform.");
  const binding = { orgId: a.orgId, subjectType: a.subjectType, subjectId: a.subjectId, actionKind: a.actionKind, contentHash: a.contentHash, scope: a.scope, policyVersion: a.policyVersion, expiresAt: a.expiresAt };
  if (await approvalHash(binding) !== a.approvalHash) throw appError("INVALID", "The saved campaign request needs review before recovery.");
  // Expired approval, a policy stop or a lapsed subscription does not prohibit a read-only status check.
  if (!(org.kind === "demo" && connection.isFixture) && (connection.isFixture || !connection.scopes.includes(provider === "google_ads" ? "https://www.googleapis.com/auth/adwords" : "ads_read"))) throw appError("UNAVAILABLE", "Reconnect this account with reporting access to check its result.");
  const receipts = await ctx.db.query("actionReceipts").withIndex("by_idempotency", q => q.eq("idempotencyKey", `${c.orgId}:campaign:${c._id}:${a.actionKind}:${a._id}`)).take(2);
  const original = receipts.length === 1 && receipts[0].orgId === org._id && receipts[0].campaignId === c._id && receipts[0].provider === provider && receipts[0].action === a.actionKind ? receipts[0] : null;
  if (a.executionFinishedAt !== undefined && a.executionOutcome === undefined && original?.status !== "uncertain") throw appError("INVALID", "The older request has no reliable unresolved-result record. Check the ad platform.");
  const externalId = a.actionKind === "activate" ? a.scope.externalCampaignId : a.executionExternalId ?? original?.externalId;
  if (externalId && !/^\d+$/.test(externalId)) throw appError("INVALID", "The saved provider campaign identity is invalid.");
  if (c.externalId && c.externalId !== externalId) throw appError("INVALID", "The campaign identity changed. Check the original request in the ad platform.");
  const providerName = a.campaignProviderName;
  if (providerName && providerName !== providerCampaignName(c.name, a._id)) throw appError("INVALID", "The request reference changed. Check the original campaign.");
  return { campaign: c, approval: a, connection, isDemo: org.kind === "demo", externalId, providerName, fingerprint: await sha256Hex(canonicalJson({ approvalHash: a.approvalHash, startedAt: a.executionStartedAt, externalId, providerName })) };
}

export const recoveryContext = internalQuery({ args: { slug: v.string(), campaignId: v.id("campaigns"), approvalId: v.id("approvals") }, handler: readRecoveryContext });

export const recordRecovery = internalMutation({
  args: { slug: v.string(), campaignId: v.id("campaigns"), approvalId: v.id("approvals"), fingerprint: v.string(), requestedAt: v.number(), externalId: v.optional(v.string()), providerStatus: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ confirmed: boolean; message: string }> => {
    const cx = await readRecoveryContext(ctx, args);
    if (cx.fingerprint !== args.fingerprint || args.requestedAt > Date.now() || Date.now() - args.requestedAt > CAMPAIGN_RECOVERY_WAIT_MS) throw appError("INVALID", "The status check became stale. Read the provider result again.");
    if (cx.isDemo || cx.connection.isFixture) throw appError("UNAVAILABLE", "Demo campaigns have no live provider result to recover.");
    const { campaign: c, approval: a } = cx;
    const identityMatches = Boolean(args.externalId && /^\d+$/.test(args.externalId) && (cx.externalId ? args.externalId === cx.externalId : cx.providerName));
    const expected = a.actionKind === "create_paused" ? "PAUSED" : c.channel === "google_search_ad" ? "ENABLED" : "ACTIVE";
    const confirmed = identityMatches && args.providerStatus === expected;
    const message = confirmed
      ? `Provider check confirmed campaign ${args.externalId} is ${a.actionKind === "create_paused" ? "paused" : "enabled"}. No create or start request was resent. This confirms current status, not delivery, spend or every campaign setting.`
      : !cx.externalId && !cx.providerName
        ? "This older request has no unique provider reference. Check the ad account manually; matching a campaign title alone is not enough to link it."
        : identityMatches
          ? `The provider reports campaign ${args.externalId} as ${args.providerStatus ?? "unknown"}, not ${expected}. The original request remains unresolved. No action was retried.`
          : "The exact provider result could not be confirmed. An absent, ambiguous or incomplete read does not prove the request failed. Check the ad platform; no action was retried.";
    const now = Date.now();
    await ctx.db.patch(a._id, { recoveryCheckedAt: now, recoveryMessage: message, ...(confirmed ? { executionReconciledAt: now, executionFinishedAt: a.executionFinishedAt ?? now, status: "consumed" as const, invalidatedReason: undefined, executionExternalId: args.externalId } : {}) });
    if (confirmed) await ctx.db.patch(c._id, { externalId: args.externalId, status: a.actionKind === "create_paused" ? "created_paused" : "active", updatedAt: now });
    // The original receipt remains unchanged; this is a separately dated provider observation.
    await ctx.db.insert("actionReceipts", { orgId: c.orgId, campaignId: c._id, provider: cx.connection.provider, action: `reconcile_${a.actionKind}`, idempotencyKey: `${a._id}:reconcile:${args.requestedAt}`, status: confirmed ? "verified" : "uncertain", externalId: args.externalId, summary: message.slice(0, 400), createdAt: now, ...(confirmed ? { verifiedAt: now } : {}) });
    const { user } = await requireOrgAccess(ctx, { orgId: c.orgId }, "approve");
    await audit(ctx, { orgId: c.orgId, actorType: "user", actorId: user._id, action: `campaign.recovery.${confirmed ? "confirmed" : "unresolved"}`, subjectType: "campaign", subjectId: c._id, summary: message });
    return { confirmed, message };
  },
});

/** Only reads the original operation's identity. Absence never authorizes replay. */
export const checkProviderResult = action({
  args: { slug: v.string(), campaignId: v.id("campaigns"), approvalId: v.id("approvals") },
  handler: async (ctx, args): Promise<{ confirmed: boolean; message: string }> => {
    const cx: RecoveryContext = await ctx.runQuery(internal.ads.recoveryContext, args);
    if (cx.isDemo || cx.connection.isFixture) throw appError("UNAVAILABLE", "Demo campaigns have no live provider result to recover.");
    const requestedAt = Date.now();
    let externalId: string | undefined;
    let providerStatus: string | undefined;
    if (cx.externalId || cx.providerName) {
      const creds = await adCredentials(ctx, cx.connection._id);
      if (!creds || creds.accountId !== cx.connection.externalAccountId) throw appError("UNAVAILABLE", "Reconnect the originally approved ad account before checking its result.");
      if (cx.campaign.channel === "google_search_ad") {
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!developerToken) throw appError("UNAVAILABLE", "Google Ads access is not configured on ClimbOS.");
        const auth = { accessToken: creds.accessToken, developerToken, customerId: creds.accountId };
        if (cx.externalId) {
          const result = await getCampaignState({ ...auth, campaignId: cx.externalId });
          if (result.ok && result.data?.campaignId === cx.externalId) { externalId = result.data.campaignId; providerStatus = result.data.status; }
        } else {
          const result = await findGoogleCampaign({ ...auth, name: cx.providerName! });
          if (result.outcome === "found" && result.data) { externalId = result.externalId; providerStatus = result.data.status; }
        }
      } else {
        if (cx.externalId) {
          const result = await getMetaCampaign({ accessToken: creds.accessToken, campaignId: cx.externalId });
          if (result.ok && result.data.id === cx.externalId) { externalId = result.data.id; providerStatus = result.data.status; }
        } else {
          const result = await findMetaCampaign({ accessToken: creds.accessToken, adAccountId: creds.accountId, name: cx.providerName! });
          if (result.outcome === "found" && result.data) { externalId = result.externalId; providerStatus = result.data.status; }
        }
      }
    }
    return ctx.runMutation(internal.ads.recordRecovery, { ...args, fingerprint: cx.fingerprint, requestedAt, externalId, providerStatus });
  },
});

/** Pause under the preapproved stop rule (Pause all). Reports verified or unknown outcomes. */
export const pauseCampaignForStop = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, { campaignId }) => {
    const cx = await ctx.runQuery(internal.ads.campaignContext, { campaignId });
    if (!cx) return;
    const c = cx.campaign;
    if (cx.connection?.isFixture) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action: "pause", status: "fixture_verified", newStatus: "paused", summary: "Demo: simulated pause." });
      return;
    }
    if (!c.connectionId || !c.externalId) return;
    const creds = await adCredentials(ctx, c.connectionId);
    if (!creds) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action: "pause", status: "uncertain", summary: "Couldn't reach the ad account to pause it. Pause it in the ad platform directly." });
      return;
    }
    const now = Date.now();
    const res =
      c.channel === "google_search_ad"
        ? process.env.GOOGLE_ADS_DEVELOPER_TOKEN
          ? await setGoogleStatus({ accessToken: creds.accessToken, developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN, customerId: creds.accountId, campaignId: c.externalId, status: "PAUSED", approval: { kind: GOOGLE_SET_STATUS, targetId: c.externalId, value: "PAUSED", approvedBy: "pause-all-rule", approvedAt: now } })
          : { status: "uncertain" as const, providerMessage: "Google Ads access is not configured; pause it in Google Ads directly." }
        : await setMetaStatus({ accessToken: creds.accessToken, campaignId: c.externalId, status: "PAUSED", approval: { kind: SET_META_CAMPAIGN_STATUS_ACTION, targetId: c.externalId, value: "PAUSED", approvedBy: "pause-all-rule", approvedAt: now } });
    await ctx.runMutation(internal.ads.recordCampaignResult, {
      campaignId,
      action: "pause",
      status: res.status,
      newStatus: res.status === "verified" ? "paused" : "uncertain",
      summary: res.status === "verified" ? "Paused and confirmed. Platforms may still report a little spend from before the pause." : (res.providerMessage ?? "Pause not confirmed. Check the ad platform directly."),
    });
  },
});
