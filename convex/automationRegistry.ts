import { v } from "convex/values";
import { AUTOMATION_REGISTRY } from "../shared/automation/registry";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";

type RegistryState = "active" | "paused" | "not_configured" | "manual_only";

function entry<TExtra extends Record<string, unknown>>(definition: (typeof AUTOMATION_REGISTRY)[number], state: RegistryState, summary: string, lastReceipt: { at: number; summary: string; href?: string } | null, activeCount: number, extra: TExtra) {
  return { ...definition, state, summary, activeCount, lastReceipt, ...extra };
}

/** Tenant-scoped view of customer automations and their domain-owned receipts. */
export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const canManage = ["owner", "admin", "editor"].includes(role);
    const [business, autopilot, agents, watches, campaigns, recentRuns, changes] = await Promise.all([
      ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first(),
      ctx.db.query("autopilotSettings").withIndex("by_org", (q) => q.eq("orgId", org._id)).first(),
      ctx.db.query("customAgents").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).take(30),
      ctx.db.query("competitorWatches").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(1000),
      ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(200),
      ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(100),
      ctx.db.query("competitorChanges").withIndex("by_org_at", (q) => q.eq("orgId", org._id)).order("desc").take(1),
    ]);
    const lastAutopilotRun = autopilot?.lastPlanRunId ? await ctx.db.get(autopilot.lastPlanRunId) : null;
    const latestSpecialistRun = recentRuns.find((run) => run.customAgentId) ?? null;
    const activeWatches = watches.filter((watch) => watch.active && (watch.autoSeededAt === undefined || watch.ownerConfirmedAt !== undefined));
    const confirmationWatches = watches.filter((watch) => watch.active && watch.autoSeededAt !== undefined && watch.ownerConfirmedAt === undefined);
    const activeAgents = agents.filter((agent) => agent.status === "active");
    const scheduledAgents = activeAgents.filter((agent) => agent.trigger !== "manual");
    const sendingCampaigns = campaigns.filter((campaign) => campaign.sending?.status === "on");
    const latestSentAt = campaigns.reduce<number | null>((latest, campaign) => {
      const sentAt = campaign.sending?.lastSentAt ?? campaign.sending?.firstSentAt;
      return sentAt !== undefined && (latest === null || sentAt > latest) ? sentAt : latest;
    }, null);
    const researchCadence = org.competitorResearchRefreshDays ?? 90;
    const competitorWatchEnabled = org.competitorWatchEnabled !== false;
    const scheduledSpecialistsEnabled = org.scheduledSpecialistsEnabled !== false;
    const siteEnabled = business?.siteWatchEnabled !== false;
    const emergencyStopped = org.emergencyStop?.active === true;

    const entries = AUTOMATION_REGISTRY.map((definition) => {
      switch (definition.id) {
        case "social_autopilot": {
          const state: RegistryState = !autopilot ? "not_configured" : emergencyStopped || !autopilot.enabled ? "paused" : "active";
          return entry(definition, state, !autopilot ? "Set up social Autopilot to create a weekly calendar." : emergencyStopped ? "Workspace emergency stop is active." : autopilot.enabled ? `${autopilot.channels.length} selected channels · ${autopilot.mode.replaceAll("_", " ")}` : "Autopilot is turned off.", lastAutopilotRun?.finishedAt ? { at: lastAutopilotRun.finishedAt, summary: `${lastAutopilotRun.title} · ${lastAutopilotRun.status}`, href: `work/${lastAutopilotRun._id}` } : null, autopilot?.enabled ? 1 : 0, { weeklyPostLimit: 21, perChannelWeeklyLimit: 6 });
        }
        case "scheduled_specialists": {
          const configuredScheduledCount = scheduledAgents.length;
          const state: RegistryState = configuredScheduledCount ? emergencyStopped || !scheduledSpecialistsEnabled ? "paused" : "active" : activeAgents.length ? "manual_only" : "not_configured";
          const lastReceipt = latestSpecialistRun ? { at: latestSpecialistRun.finishedAt ?? latestSpecialistRun.updatedAt, summary: `${latestSpecialistRun.title} · ${latestSpecialistRun.status}`, href: `work/${latestSpecialistRun._id}` } : null;
          const summary = !configuredScheduledCount
            ? `${activeAgents.length} active profile${activeAgents.length === 1 ? "" : "s"} · none scheduled`
            : !scheduledSpecialistsEnabled
              ? `${configuredScheduledCount} scheduled profile${configuredScheduledCount === 1 ? "" : "s"} · recurring runs paused; manual runs remain available`
              : `${configuredScheduledCount} scheduled · ${activeAgents.length} active profile${activeAgents.length === 1 ? "" : "s"}`;
          return entry(definition, state, summary, lastReceipt, scheduledSpecialistsEnabled ? configuredScheduledCount : 0, { configuredCount: agents.length, configuredScheduledCount, scheduledSpecialistsEnabled, canManage });
        }
        case "competitor_watch": {
          const latestChecked = activeWatches.reduce<number | null>((latest, watch) => watch.lastCheckedAt !== undefined && (latest === null || watch.lastCheckedAt > latest) ? watch.lastCheckedAt : latest, null);
          const savedActiveCount = watches.filter((watch) => watch.active).length;
          const state: RegistryState = !savedActiveCount ? "not_configured" : competitorWatchEnabled && activeWatches.length ? "active" : "paused";
          const lastReceipt = latestChecked !== null ? { at: latestChecked, summary: changes[0] ? `${changes[0].name}: ${changes[0].summary}` : "Latest active-watch check", href: "competitors" } : null;
          const summary = !competitorWatchEnabled
            ? `${savedActiveCount} saved site${savedActiveCount === 1 ? "" : "s"} · weekly checks paused; manual checks remain available`
            : confirmationWatches.length
              ? `${activeWatches.length} active · ${confirmationWatches.length} older site${confirmationWatches.length === 1 ? "" : "s"} paused for owner confirmation`
              : `${activeWatches.length} active of ${savedActiveCount} saved watches`;
          return entry(definition, state, summary, lastReceipt, competitorWatchEnabled ? activeWatches.length : 0, { savedCount: savedActiveCount, confirmationCount: confirmationWatches.length, competitorWatchEnabled, canManage });
        }
        case "competitor_research_refresh": {
          const state: RegistryState = !business?.insights ? "not_configured" : researchCadence === 0 ? "paused" : "active";
          const lastReceipt = business?.competitorResearchCompletedAt ? { at: business.competitorResearchCompletedAt, summary: `Research refresh · ${business.competitorResearchLastStatus ?? "completed"}`, href: "competitors" } : null;
          return entry(definition, state, !business?.insights ? "Run business research to start a refresh schedule." : researchCadence === 0 ? "Scheduled research refresh is disabled." : `${researchCadence}-day cadence · ${business.competitorResearchLastStatus ?? "waiting for next due date"}`, lastReceipt, state === "active" ? 1 : 0, { nextDueAt: business?.competitorResearchNextAt ?? null, cadenceDays: researchCadence });
        }
        case "website_change_watch": {
          const state: RegistryState = !business?.website ? "not_configured" : siteEnabled ? "active" : "paused";
          const lastAttemptAt = business?.siteWatchLastAttemptAt ?? business?.siteCheckedAt;
          const lastReceipt = lastAttemptAt ? { at: lastAttemptAt, summary: business?.siteWatchLastError ? `Check failed: ${business.siteWatchLastError}` : "Website snapshot checked", href: "visibility" } : null;
          return entry(definition, state, !business?.website ? "Add a public website to use this monitor." : siteEnabled ? "Checks the recorded website for material changes; proposed fact updates need owner confirmation." : "Scheduled website monitoring is paused. Manual checks remain available.", lastReceipt, state === "active" ? 1 : 0, { canManage, siteWatchEnabled: siteEnabled });
        }
        case "approved_outbound_sending": {
          const state: RegistryState = !campaigns.length ? "not_configured" : sendingCampaigns.length ? emergencyStopped ? "paused" : "active" : "paused";
          const lastReceipt = latestSentAt !== null ? { at: latestSentAt, summary: "Most recent message in an owner-started campaign", href: "outbound" } : null;
          return entry(definition, state, `${sendingCampaigns.length} sending · ${campaigns.length} saved campaign${campaigns.length === 1 ? "" : "s"}`, lastReceipt, sendingCampaigns.length, { campaignsTruncated: campaigns.length === 200 });
        }
      }
    });
    return { canManage: ["owner", "admin", "editor"].includes(role), emergencyStopped, entries };
  },
});

/** Pause/resume the scheduled site monitor; manual owner-requested checks are unchanged. */
export const setWebsiteMonitor = mutation({
  args: { slug: v.string(), enabled: v.boolean() },
  handler: async (ctx, { slug, enabled }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business?.website) throw appError("INVALID", "Add a public website before configuring its scheduled monitor.");
    await ctx.db.patch(business._id, { siteWatchEnabled: enabled, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: enabled ? "automation.website_monitor_enabled" : "automation.website_monitor_paused", subjectType: "business", subjectId: business._id, summary: enabled ? "Enabled the scheduled website change monitor." : "Paused the scheduled website change monitor." });
    return { enabled };
  },
});
