import { v } from "convex/values";
import { getCampaignMetrics, getCustomerSettings, GOOGLE_ADS_SCOPE } from "../shared/integrations/googleAds";
import { microsToMinor } from "../shared/integrations/currency";
import { getInsights } from "../shared/integrations/metaAds";
import { aggregateMetaCampaignInsights } from "../shared/acquisition/metaCampaignInsights";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { appError } from "./lib/tenancy";

function dateInZone(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftIsoDay(day: string, delta: number): string {
  const value = Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000;
  return new Date(value).toISOString().slice(0, 10);
}

/** Manually read a bounded, campaign-specific Google Ads report. This action never writes to Ads. */
export const syncPerformance = action({
  args: { slug: v.string(), campaignId: v.id("campaigns") },
  handler: async (ctx, { slug, campaignId }): Promise<{ ok: true; startDate: string; endDate: string; rows: number }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "view" });
    if (access.kind === "demo") throw appError("UNAVAILABLE", "Demo workspaces do not contain live campaign results.");
    const { campaign, connection, timeZone: workspaceTimeZone } = await ctx.runQuery(internal.ads.performanceSyncContext, { orgId: access.orgId, campaignId });

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

      const activationDay = campaign.activatedAt ? dateInZone(campaign.activatedAt, workspaceTimeZone) : campaign.startDate!;
      const yesterday = shiftIsoDay(dateInZone(Date.now(), workspaceTimeZone), -1);
      const endDate = campaign.endDate && campaign.endDate < yesterday ? campaign.endDate : yesterday;
      if (endDate < activationDay) throw appError("INVALID", "No completed campaign days are available to report yet.");
      const startDate = activationDay < shiftIsoDay(endDate, -89) ? shiftIsoDay(endDate, -89) : activationDay;
      const report = await getInsights({ accessToken: stored.accessToken, adAccountId: connection.externalAccountId, since: startDate, until: endDate, level: "campaign", maxPages: 5 });
      if (!report.ok) throw appError("UNAVAILABLE", `Meta Ads results could not be read: ${report.providerMessage}`);
      let totals;
      try {
        totals = aggregateMetaCampaignInsights({ rows: report.data.items, campaignId: campaign.externalId, startDate, endDate, currency: campaign.currency });
      } catch (error) {
        throw appError("INVALID", `Meta Ads results could not be compared safely: ${error instanceof Error ? error.message : "invalid report data"}`);
      }
      await ctx.runMutation(internal.ads.recordPerformanceSnapshot, {
        slug, campaignId, connectionId: connection._id, source: "meta_ads", status: "ready", startDate, endDate,
        currency: campaign.currency, spendMinor: totals.spendMinor, impressions: totals.impressions, clicks: totals.clicks,
        reportedActions: totals.reportedActions,
      });
      return { ok: true as const, startDate, endDate, rows: report.data.items.filter((row) => row.campaignId === campaign.externalId && row.date >= startDate && row.date <= endDate).length };
    }

    if (!connection.scopes.includes(GOOGLE_ADS_SCOPE)) throw appError("FORBIDDEN", "This connection does not have the Google Ads reporting permission.");

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
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || undefined,
      customerId: connection.externalAccountId ?? "",
    };
    const settings = await getCustomerSettings(auth);
    if (!settings.ok) throw appError("UNAVAILABLE", `Google Ads account details could not be read: ${settings.providerMessage}`);
    if (settings.data.currencyCode !== campaign.currency) throw appError("INVALID", "The Google Ads account currency does not match the campaign currency. Refresh the campaign setup before comparing costs.");

    const timeZone = settings.data.timeZone || "UTC";
    const activationDay = campaign.activatedAt ? dateInZone(campaign.activatedAt, timeZone) : campaign.startDate!;
    const yesterday = shiftIsoDay(dateInZone(Date.now(), timeZone), -1);
    const endDate = campaign.endDate && campaign.endDate < yesterday ? campaign.endDate : yesterday;
    if (endDate < activationDay) throw appError("INVALID", "No completed campaign days are available to report yet.");
    // Keep manual refreshes bounded while still covering recent optimization windows.
    const startDate = activationDay < shiftIsoDay(endDate, -89) ? shiftIsoDay(endDate, -89) : activationDay;
    const metrics = await getCampaignMetrics({ ...auth, campaignId: campaign.externalId!, startDate, endDate, maxPages: 2 });
    if (!metrics.ok) throw appError("UNAVAILABLE", `Google Ads metrics could not be read: ${metrics.providerMessage}`);
    const rows = metrics.data.items.filter((row) => row.campaignId === campaign.externalId && row.date >= startDate && row.date <= endDate);
    const totals = rows.reduce((a, row) => ({
      costMicros: a.costMicros + row.costMicros,
      impressions: a.impressions + row.impressions,
      clicks: a.clicks + row.clicks,
      conversions: a.conversions + row.conversions,
      conversionValueMinor: a.conversionValueMinor + microsToMinor(Math.round(row.conversionsValue * 1_000_000), settings.data.currencyCode),
    }), { costMicros: 0, impressions: 0, clicks: 0, conversions: 0, conversionValueMinor: 0 });
    await ctx.runMutation(internal.ads.recordPerformanceSnapshot, {
      slug,
      campaignId,
      connectionId: connection._id,
      source: "google_ads",
      status: "ready",
      startDate,
      endDate,
      currency: settings.data.currencyCode,
      spendMinor: microsToMinor(totals.costMicros, settings.data.currencyCode),
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: totals.conversions,
      conversionValueMinor: totals.conversionValueMinor,
    });
    return { ok: true as const, startDate, endDate, rows: rows.length };
  },
});
