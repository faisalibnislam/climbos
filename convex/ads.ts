import { v } from "convex/values";
import { requirePaid } from "./lib/access";
import { createPausedSearchCampaign, setCampaignStatus as setGoogleStatus } from "../shared/integrations/googleAds";
import { decimalToMinor } from "../shared/integrations/currency";
import {
  createPausedCampaign as createMetaPaused,
  SET_META_CAMPAIGN_STATUS_ACTION,
  setCampaignStatus as setMetaStatus,
} from "../shared/integrations/metaAds";
import { approvalHash, canonicalJson, checkApprovalForExecution, sha256Hex } from "../shared/policy";
import { maxRolling31DaySpend, validCampaignDateRange } from "../shared/policy/campaignBudget";
import { campaignApprovalScope } from "../shared/policy/campaignScope";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
      return {
        id: c._id,
        artifactId: c.artifactId ?? null,
        accountConnected: Boolean(campaignConnection?.status === "connected" && (campaignConnection.isFixture || campaignConnection.externalAccountId)) || connected(c.channel === "google_search_ad" ? "google_ads" : "meta_ads"),
        name: c.name,
        channel: c.channel,
        status: c.status,
        dailyBudgetMinor: c.dailyBudgetMinor ?? 0,
        budgetEnvelopeMinor: c.budgetEnvelopeMinor,
        currency: c.currency,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        targetCostPerConversionMinor: c.targetCostPerConversionMinor ?? null,
        reviewAfterDays: c.reviewAfterDays ?? null,
        activatedAt: c.activatedAt ?? null,
        destinationUrl: c.destinationUrl ?? null,
        stopRules: c.stopRules,
        externalId: c.externalId ?? null,
        performance: performance ?? null,
      };
    }));
    return {
      monthlyEnvelopeMinor: policy?.maxMonthlyAdSpendMinor ?? 0,
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
    const old = await ctx.db.query("campaignPerformance")
      .withIndex("by_org_campaign", (q) => q.eq("orgId", org._id).eq("campaignId", campaign._id))
      .first();
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
    const dailyMinor = Math.round(args.dailyBudget * 100);
    if (!(dailyMinor > 0)) throw appError("INVALID", "Enter a daily budget greater than 0.");
    if (!Number.isInteger(args.reviewAfterDays) || args.reviewAfterDays < 1 || args.reviewAfterDays > 90) throw appError("INVALID", "Choose a first review window from 1 to 90 days.");
    if (!validCampaignDateRange(args.startDate, args.endDate)) {
      throw appError("INVALID", "Pick a start date and an end date after it.");
    }
    const days = Math.round((Date.parse(args.endDate) - Date.parse(args.startDate)) / 86_400_000) + 1;
    const envelope = policy?.maxMonthlyAdSpendMinor ?? 0;
    // Reserve every pending or live campaign across both ad providers in the
    // same transaction. This prevents parallel preparations from each using
    // the full owner-approved monthly envelope.
    const existing = await ctx.db.query("campaigns").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(1001);
    if (existing.length > 1000) throw appError("LIMIT_REACHED", "There are too many campaigns to safely calculate the shared ad budget. Review or end older campaigns first.");
    const planned = maxRolling31DaySpend(
      [
        ...existing,
        { status: "needs_approval", currency: policy?.currency ?? org.currency, dailyBudgetMinor: dailyMinor, startDate: args.startDate, endDate: args.endDate },
      ],
      policy?.currency ?? org.currency,
      new Date().toISOString().slice(0, 10),
    );
    if (!planned.ok) throw appError("LIMIT_REACHED", "We can't safely calculate your shared ad budget from the existing campaign schedules. Resolve the currency or schedule details before preparing another campaign.");
    if (planned.maxSpendMinor > envelope) {
      throw appError("LIMIT_REACHED", `That would plan ${(planned.maxSpendMinor / 100).toFixed(2)} ${policy?.currency ?? org.currency} across Google and Meta in the 31-day window starting ${planned.windowStart}, above your approved monthly ad budget of ${(envelope / 100).toFixed(0)}. Lower or reschedule a campaign, or raise your budget in Settings → Policies.`);
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
      const parsed = decimalToMinor(String(args.targetCostPerConversion), policy?.currency ?? org.currency);
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
      currency: policy?.currency ?? org.currency,
      startDate: args.startDate,
      endDate: args.endDate,
      targetCostPerConversionMinor,
      reviewAfterDays: args.reviewAfterDays,
      destinationUrl: ver?.destinationUrl,
      audience: undefined,
      stopRules: [
        `Pause if spend reaches ${(dailyMinor * days / 100).toFixed(2)} ${policy?.currency ?? org.currency} for this campaign`,
        "Pause if conversion tracking stops reporting for 48 hours",
        "Pause immediately when you press Pause all",
      ],
      connectionId: conn?.status === "connected" && (conn.isFixture || conn.externalAccountId) ? conn._id : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "campaign.prepared", subjectType: "campaign", subjectId: campaignId, summary: `Prepared paused campaign for "${a.title}" at ${(dailyMinor / 100).toFixed(2)}/day.` });
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
    if (action === "reject") {
      await ctx.db.patch(c._id, { status: c.externalId ? "paused" : "draft", updatedAt: Date.now() });
      return;
    }
    if (action === "create_paused" && c.status !== "needs_approval") throw appError("INVALID", "This campaign isn't waiting for approval.");
    if (action === "activate" && c.status !== "created_paused" && c.status !== "paused") throw appError("INVALID", "Create the campaign (paused) first.");
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
    const contentHash = await sha256Hex(canonicalJson({ name: c.name, channel: c.channel, action }));
    const binding = { orgId: org._id, subjectType: "campaign_activation", subjectId: c._id, actionKind: action, contentHash, scope, policyVersion, expiresAt };
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
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `campaign.${action}_approved`, subjectType: "campaign", subjectId: c._id, summary: `Approved ${action === "activate" ? "starting" : "creating (paused)"} "${c.name}" at ${((c.dailyBudgetMinor ?? 0) / 100).toFixed(2)} ${c.currency}/day.` });
  },
});

export const campaignContext = internalQuery({
  args: { campaignId: v.id("campaigns"), approvalId: v.optional(v.id("approvals")) },
  handler: async (ctx, { campaignId, approvalId }) => {
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
    approvalId: v.optional(v.id("approvals")),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) return;
    const now = Date.now();
    await ctx.db.insert("actionReceipts", {
      orgId: c.orgId,
      campaignId: c._id,
      provider: c.channel === "google_search_ad" ? "google_ads" : "meta_ads",
      action: args.action,
      idempotencyKey: `${c.orgId}:campaign:${c._id}:${args.action}:${args.approvalId ?? now}`,
      status: args.status,
      externalId: args.externalId,
      summary: args.summary.slice(0, 400),
      createdAt: now,
      verifiedAt: args.status === "verified" || args.status === "fixture_verified" ? now : undefined,
    });
    if (args.newStatus) await ctx.db.patch(c._id, {
      status: args.newStatus,
      ...(args.externalId && !c.externalId ? { externalId: args.externalId } : {}),
      ...(args.newStatus === "active" && !c.activatedAt ? { activatedAt: now } : {}),
      updatedAt: now,
    });
    if (args.approvalId && (args.status === "verified" || args.status === "fixture_verified")) await ctx.db.patch(args.approvalId, { status: "consumed" });
    await audit(ctx, { orgId: c.orgId, actorType: "system", action: `campaign.${args.action}.${args.status}`, subjectType: "campaign", subjectId: c._id, summary: `${c.name}: ${args.summary}` });
  },
});

async function adCredentials(ctx: { runQuery: (q: typeof internal.connections.getSecret, a: { connectionId: Id<"connections"> }) => Promise<{ value: string; externalAccountId: string | null } | null> }, connectionId: Id<"connections">) {
  const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId });
  if (!secret) return null;
  const { accessToken } = JSON.parse(secret.value) as { accessToken: string };
  return { accessToken, accountId: secret.externalAccountId ?? "" };
}

export const executeCampaignWrite = internalAction({
  args: { campaignId: v.id("campaigns"), approvalId: v.id("approvals") },
  handler: async (ctx, { campaignId, approvalId }) => {
    const cx = await ctx.runQuery(internal.ads.campaignContext, { campaignId, approvalId });
    if (!cx?.approval || !cx.org) return;
    const { campaign: c, approval } = cx;
    const action = approval.actionKind as "create_paused" | "activate";
    const contentHash = await sha256Hex(canonicalJson({ name: c.name, channel: c.channel, action }));
    const check = await checkApprovalForExecution({
      approval: { status: approval.status, approvalHash: approval.approvalHash, expiresAt: approval.expiresAt, scope: approval.scope, contentHash: approval.contentHash, policyVersion: approval.policyVersion },
      current: { orgId: c.orgId, subjectType: "campaign_activation", subjectId: c._id, actionKind: action, contentHash, scope: campaignApprovalScope(c, cx.connection?.externalAccountId), policyVersion: cx.policyVersion, expiresAt: approval.expiresAt },
      now: Date.now(),
      emergencyStop: Boolean(cx.org.emergencyStop?.active) || cx.fleetStop,
      capabilityReady: cx.connection?.status === "connected" && (cx.connection.isFixture || Boolean(cx.connection.externalAccountId)),
    });
    if (!check.ok) {
      await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: "failed", summary: check.message, approvalId });
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
            name: c.name,
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
        const res = await setGoogleStatus({ ...auth, campaignId: c.externalId ?? "", status: "ENABLED", approval: { kind: GOOGLE_SET_STATUS, targetId: c.externalId ?? "", value: "ENABLED", approvedBy, approvedAt } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "active" : res.status === "uncertain" ? "uncertain" : undefined, summary: res.status === "verified" ? "Started in Google Ads and confirmed." : (res.providerMessage ?? "Google Ads didn't start the campaign."), approvalId });
      }
    } else {
      const call = { accessToken: creds.accessToken };
      if (action === "create_paused") {
        const res = await createMetaPaused({ ...call, adAccountId: creds.accountId, draft: { name: c.name, objective: "OUTCOME_TRAFFIC", specialAdCategories: [], spendCapMinor: c.budgetEnvelopeMinor, maxSpendCapMinor: c.budgetEnvelopeMinor } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "created_paused" : res.status === "uncertain" ? "uncertain" : undefined, externalId: res.externalId, summary: res.status === "verified" ? "Created in Meta, paused, with a lifetime spend cap." : (res.providerMessage ?? "Meta didn't accept the campaign."), approvalId });
      } else {
        const res = await setMetaStatus({ ...call, campaignId: c.externalId ?? "", status: "ACTIVE", approval: { kind: SET_META_CAMPAIGN_STATUS_ACTION, targetId: c.externalId ?? "", value: "ACTIVE", approvedBy, approvedAt } });
        await ctx.runMutation(internal.ads.recordCampaignResult, { campaignId, action, status: res.status, newStatus: res.status === "verified" ? "active" : res.status === "uncertain" ? "uncertain" : undefined, summary: res.status === "verified" ? "Started in Meta and confirmed." : (res.providerMessage ?? "Meta didn't start the campaign."), approvalId });
      }
    }
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
