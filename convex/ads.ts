import { v } from "convex/values";
import { requirePaid } from "./lib/access";
import {
  createPausedSearchCampaign,
  setCampaignStatus as setGoogleStatus,
} from "../shared/integrations/googleAds";
import {
  createPausedCampaign as createMetaPaused,
  SET_META_CAMPAIGN_STATUS_ACTION,
  setCampaignStatus as setMetaStatus,
} from "../shared/integrations/metaAds";
import { approvalHash, canonicalJson, checkApprovalForExecution, sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

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
    const connected = (p: string) => conns.some((c) => c.provider === p && c.status === "connected");
    return {
      monthlyEnvelopeMinor: policy?.maxMonthlyAdSpendMinor ?? 0,
      currency: policy?.currency ?? org.currency,
      googleAdsConnected: connected("google_ads"),
      metaAdsConnected: connected("meta_ads"),
      campaigns: rows.map((c) => ({
        id: c._id,
        artifactId: c.artifactId ?? null,
        accountConnected: Boolean(c.connectionId) || connected(c.channel === "google_search_ad" ? "google_ads" : "meta_ads"),
        name: c.name,
        channel: c.channel,
        status: c.status,
        dailyBudgetMinor: c.dailyBudgetMinor ?? 0,
        budgetEnvelopeMinor: c.budgetEnvelopeMinor,
        currency: c.currency,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        destinationUrl: c.destinationUrl ?? null,
        stopRules: c.stopRules,
        externalId: c.externalId ?? null,
      })),
    };
  },
});

function campaignScope(c: Doc<"campaigns">) {
  return {
    connectionId: c.connectionId,
    destination: c.destinationUrl,
    audience: c.audience,
    spendLimitMinor: c.dailyBudgetMinor,
    currency: c.currency,
    windowStart: c.startDate ? Date.parse(`${c.startDate}T00:00:00Z`) : undefined,
    windowEnd: c.endDate ? Date.parse(`${c.endDate}T23:59:59Z`) : undefined,
  };
}

export const prepareCampaign = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    dailyBudget: v.number(),
    startDate: v.string(),
    endDate: v.string(),
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate) || args.endDate < args.startDate) {
      throw appError("INVALID", "Pick a start date and an end date after it.");
    }
    const days = Math.round((Date.parse(args.endDate) - Date.parse(args.startDate)) / 86_400_000) + 1;
    const envelope = policy?.maxMonthlyAdSpendMinor ?? 0;
    // Planned spend over any 31-day window must stay within the owner's monthly envelope.
    if (dailyMinor * Math.min(days, 31) > envelope) {
      throw appError("LIMIT_REACHED", `That would plan more than your approved monthly ad budget (${(envelope / 100).toFixed(0)} ${policy?.currency ?? org.currency}). Lower the daily budget or raise your budget in Settings → Policies.`);
    }
    const provider = a.channel === "google_search_ad" ? "google_ads" : "meta_ads";
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider))
      .first();
    const now = Date.now();
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
      destinationUrl: ver?.destinationUrl,
      audience: undefined,
      stopRules: [
        `Pause if spend reaches ${(dailyMinor * days / 100).toFixed(2)} ${policy?.currency ?? org.currency} for this campaign`,
        "Pause if conversion tracking stops reporting for 48 hours",
        "Pause immediately when you press Pause all",
      ],
      connectionId: conn?.status === "connected" ? conn._id : undefined,
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
    if (action !== "reject") await requirePaid(ctx, org, "Publishing ads");
    if (org.emergencyStop?.active && action !== "reject") throw appError("PAUSED", "All activity is paused. Resume activity first.");
    if (action === "reject") {
      await ctx.db.patch(c._id, { status: c.externalId ? "paused" : "draft", updatedAt: Date.now() });
      return;
    }
    if (action === "create_paused" && c.status !== "needs_approval") throw appError("INVALID", "This campaign isn't waiting for approval.");
    if (action === "activate" && c.status !== "created_paused" && c.status !== "paused") throw appError("INVALID", "Create the campaign (paused) first.");
    if (!c.connectionId) throw appError("UNAVAILABLE", "Connect your ad account first. Until then, use the ad drafts manually.");
    const policyVersion = await activePolicyVersion(ctx, org._id);
    const now = Date.now();
    const expiresAt = now + 24 * 3_600_000;
    const scope = campaignScope(c);
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
    if (args.newStatus) await ctx.db.patch(c._id, { status: args.newStatus, ...(args.externalId && !c.externalId ? { externalId: args.externalId } : {}), updatedAt: now });
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
      current: { orgId: c.orgId, subjectType: "campaign_activation", subjectId: c._id, actionKind: action, contentHash, scope: campaignScope(c), policyVersion: cx.policyVersion, expiresAt: approval.expiresAt },
      now: Date.now(),
      emergencyStop: Boolean(cx.org.emergencyStop?.active) || cx.fleetStop,
      capabilityReady: cx.connection?.status === "connected",
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
