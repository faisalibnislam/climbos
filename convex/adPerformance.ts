import { v } from "convex/values";
import { getCampaignMetrics, getCustomerSettings, GOOGLE_ADS_SCOPE } from "../shared/integrations/googleAds";
import { getInsights, getAccountSpendCapUsage } from "../shared/integrations/metaAds";
import { aggregateMetaCampaignInsights } from "../shared/acquisition/metaCampaignInsights";
import { aggregateGoogleCampaignMetrics, campaignReportWindow } from "../shared/acquisition/campaignReport";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { appError } from "./lib/tenancy";

function validateReport<T>(calculate: () => T): T {
  try { return calculate(); }
  catch (error) { throw appError("INVALID", `Campaign results need review: ${error instanceof Error ? error.message : "The report could not be validated."}`); }
}

/** Manually read a bounded, campaign-specific provider report. This action never writes to Ads. */
export const syncPerformance = action({
  args: { slug: v.string(), campaignId: v.id("campaigns") },
  handler: async (ctx, { slug, campaignId }): Promise<{ ok: true; startDate: string; endDate: string; rows: number }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "view" });
    if (access.kind === "demo") throw appError("UNAVAILABLE", "Demo workspaces do not contain live campaign results.");
    const requestedAt = Date.now();
    const { campaign, connection } = await ctx.runQuery(internal.ads.performanceSyncContext, { orgId: access.orgId, campaignId });

    if (campaign.channel === "meta_ad") {
      if (!connection.scopes.includes("ads_read")) throw appError("FORBIDDEN", "This connection does not have the Meta Ads reporting permission.");
      if (!campaign.externalId || !connection.externalAccountId) throw appError("INVALID", "The campaign or connected Meta ad account is missing its platform ID.");
      if (connection.expiresAt && connection.expiresAt < Date.now() + 5 * 60_000) {
        const refreshed = await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId: connection._id });
        if (!refreshed.ok) throw appError("UNAVAILABLE", refreshed.message ?? "Reconnect Meta Ads to read results.");
      }
      const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: connection._id });
      if (!secret) throw appError("UNAVAILABLE", "The Meta Ads connection needs to be reconnected.");
      const stored = JSON.parse(secret.value) as { accessToken?: unknown };
      if (typeof stored.accessToken !== "string") throw appError("UNAVAILABLE", "The Meta Ads connection needs to be reconnected.");

      const account = await getAccountSpendCapUsage({ accessToken: stored.accessToken, adAccountId: connection.externalAccountId });
      if (!account.ok) throw appError("UNAVAILABLE", "Meta Ads account details could not be read.");
      if (account.data.currency !== campaign.currency) throw appError("INVALID", "The Meta Ads account currency does not match this campaign.");
      const timeZone = account.data.timeZone ?? "";
      const { startDate, endDate } = validateReport(() => campaignReportWindow(campaign, timeZone, requestedAt));
      const report = await getInsights({ accessToken: stored.accessToken, adAccountId: connection.externalAccountId, since: startDate, until: endDate, level: "campaign", maxPages: 5 });
      if (!report.ok) throw appError("UNAVAILABLE", `Meta Ads results could not be read: ${report.providerMessage}`);
      if (report.data.truncated) throw appError("UNAVAILABLE", "The Meta report is incomplete. A page limit or repeated cursor stopped the read; no totals were saved.");
      const totals = validateReport(() => aggregateMetaCampaignInsights({ rows: report.data.items, campaignId: campaign.externalId!, startDate, endDate, currency: campaign.currency }));
      await ctx.runMutation(internal.ads.recordPerformanceSnapshot, {
        slug, campaignId, connectionId: connection._id, source: "meta_ads", status: "ready", startDate, endDate,
        timeZone, requestedAt, externalAccountId: connection.externalAccountId, externalCampaignId: campaign.externalId, rowCount: report.data.items.filter(row => row.campaignId === campaign.externalId).length,
        currency: campaign.currency, spendMinor: totals.spendMinor, impressions: totals.impressions, clicks: totals.clicks,
        reportedActions: totals.reportedActions,
      });
      return { ok: true as const, startDate, endDate, rows: report.data.items.filter((row) => row.campaignId === campaign.externalId && row.date >= startDate && row.date <= endDate).length };
    }

    if (!connection.scopes.includes(GOOGLE_ADS_SCOPE)) throw appError("FORBIDDEN", "This connection does not have the Google Ads reporting permission.");
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) throw appError("UNAVAILABLE", "Google Ads reporting is not configured on ClimbOS yet (developer token pending).");

    if (connection.expiresAt && connection.expiresAt < Date.now() + 5 * 60_000) {
      const refreshed = await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId: connection._id });
      if (!refreshed.ok) throw appError("UNAVAILABLE", refreshed.message ?? "Reconnect Google Ads to read metrics.");
    }
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: connection._id });
    if (!secret) throw appError("UNAVAILABLE", "The Google Ads connection needs to be reconnected.");
    const stored = JSON.parse(secret.value) as { accessToken?: unknown };
    if (typeof stored.accessToken !== "string") throw appError("UNAVAILABLE", "The Google Ads connection needs to be reconnected.");
    const auth = {
      accessToken: stored.accessToken,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      customerId: connection.externalAccountId ?? "",
    };
    const settings = await getCustomerSettings(auth);
    if (!settings.ok) throw appError("UNAVAILABLE", `Google Ads account details could not be read: ${settings.providerMessage}`);
    if (settings.data.currencyCode !== campaign.currency) throw appError("INVALID", "The Google Ads account currency does not match the campaign currency. Refresh the campaign setup before comparing costs.");

    const timeZone = settings.data.timeZone;
    const { startDate, endDate } = validateReport(() => campaignReportWindow(campaign, timeZone, requestedAt));
    const metrics = await getCampaignMetrics({ ...auth, campaignId: campaign.externalId!, startDate, endDate, maxPages: 2 });
    if (!metrics.ok) throw appError("UNAVAILABLE", `Google Ads metrics could not be read: ${metrics.providerMessage}`);
    if (metrics.data.truncated) throw appError("UNAVAILABLE", "The Google report is incomplete. A page limit or repeated cursor stopped the read; no totals were saved.");
    const rows = metrics.data.items;
    const totals = validateReport(() => aggregateGoogleCampaignMetrics({ rows, campaignId: campaign.externalId!, startDate, endDate, currency: settings.data.currencyCode }));
    await ctx.runMutation(internal.ads.recordPerformanceSnapshot, {
      slug,
      campaignId,
      connectionId: connection._id,
      source: "google_ads",
      status: "ready",
      startDate,
      endDate,
      currency: settings.data.currencyCode,
      timeZone, requestedAt, externalAccountId: connection.externalAccountId!, externalCampaignId: campaign.externalId!, rowCount: rows.length,
      spendMinor: totals.spendMinor,
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: totals.conversions,
      conversionValueMinor: totals.conversionValueMinor,
    });
    return { ok: true as const, startDate, endDate, rows: rows.length };
  },
});
