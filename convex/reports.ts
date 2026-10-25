import { v } from "convex/values";
import { microsToCredits } from "../shared/economics";
import { buildWeeklyReport, localWeek, type WeekCounts } from "../shared/report/weekly";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery, query, type QueryCtx } from "./_generated/server";
import { creditBalance } from "./lib/credits";
import { weeklyReportEmail } from "./lib/emailTemplates";
import { currentPeriod } from "./lib/periods";
import { requireOrgAccess } from "./lib/tenancy";
import { linkClicksBetween } from "./links";

/** Weekly CEO report: in the app (Results → This week) and by email on Mondays. */

const DAY = 86_400_000;
const WEEK = 7 * DAY;

async function countsFor(ctx: QueryCtx, orgId: Id<"organizations">, from: number, to: number): Promise<WeekCounts> {
  const inWin = (t?: number) => t !== undefined && t >= from && t < to;
  // Newest first: these lists only grow, and the window is recent.
  const published = await ctx.db.query("artifacts").withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "published")).order("desc").take(500);
  const campaigns = await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").take(50);
  let emailsSent = 0;
  let newProspects = 0;
  for (const c of campaigns) {
    const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", c._id).gte("createdAt", from - 30 * DAY)).take(2000);
    emailsSent += sends.filter((s) => s.status === "sent" && inWin(s.sentAt)).length;
    const ps = await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).order("desc").take(500);
    newProspects += ps.filter((p) => inWin(p.createdAt)).length;
  }
  let replies = 0;
  for (const stage of ["replied", "booked", "won"] as const) {
    const ps = await ctx.db.query("prospects").withIndex("by_org_stage", (q) => q.eq("orgId", orgId).eq("stage", stage)).order("desc").take(500);
    replies += ps.filter((p) => inWin(p.updatedAt)).length;
  }
  const bookings = await ctx.db.query("bookings").withIndex("by_org_start", (q) => q.eq("orgId", orgId).gte("startAt", from - 60 * DAY)).take(500);
  const metrics = await ctx.db.query("postMetrics").withIndex("by_org_captured", (q) => q.eq("orgId", orgId).gte("capturedAt", from).lt("capturedAt", to)).take(2000);
  // Latest snapshot per post, so repeated captures aren't double counted.
  const latest = new Map<string, Doc<"postMetrics">>();
  for (const m of metrics) if ((latest.get(m.artifactId)?.capturedAt ?? 0) < m.capturedAt) latest.set(m.artifactId, m);
  const won = await ctx.db.query("deals").withIndex("by_org_stage", (q) => q.eq("orgId", orgId).eq("stage", "won")).order("desc").take(1000);
  const runs = await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId).gte("createdAt", from).lt("createdAt", to)).take(1000);
  return {
    dealsWon: won.filter((d) => inWin(d.wonAt)).length,
    postsPublished: published.filter((a) => inWin(a.updatedAt)).length,
    emailsSent,
    replies,
    callsBooked: bookings.filter((b) => b.status === "confirmed" && inWin(b.createdAt)).length,
    newProspects,
    reach: [...latest.values()].reduce((s, m) => s + (m.reach ?? m.impressions ?? 0), 0),
    // Platform-reported clicks or our own short-link clicks, whichever saw more (they overlap).
    clicks: Math.max([...latest.values()].reduce((s, m) => s + (m.clicks ?? 0), 0), await linkClicksBetween(ctx, orgId, from, to)),
    creditsUsed: Math.round(runs.reduce((s, r) => s + microsToCredits(r.actualMicros), 0)),
    jobsDone: runs.filter((r) => r.status === "verified").length,
  };
}

async function reportFor(ctx: QueryCtx, org: Doc<"organizations">, weeksAgo: number, now = Date.now()) {
  // Weeks run Monday to Monday in the workspace's timezone. weeksAgo 0 = the week so far;
  // the Monday email reports the full week before (weeksAgo 1).
  const w = localWeek(now, org.timezone, weeksAgo);
  const end = Math.min(w.end, now + 1);
  // The week so far is compared with the same stretch of last week, not all of it.
  return reportBetween(ctx, org, w.start, end, w.start - w.prevStart, now, [w.prevStart, w.prevStart + (end - w.start)]);
}

/** A report for any window, compared with the window of the same length before it (or `before`, when given). */
export async function reportBetween(ctx: QueryCtx, org: Doc<"organizations">, weekStart: number, weekEnd: number, span: number, now = Date.now(), before?: [number, number]) {
  const [prevFrom, prevTo] = before ?? [weekStart - span, weekStart];
  const [current, previous] = await Promise.all([countsFor(ctx, org._id, weekStart, weekEnd), countsFor(ctx, org._id, prevFrom, Math.min(prevTo, weekStart))]);
  const pending = await ctx.db.query("artifacts").withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "in_review")).take(100);
  const upcoming = await ctx.db.query("bookings").withIndex("by_org_start", (q) => q.eq("orgId", org._id).gte("startAt", now).lt("startAt", now + WEEK)).take(20);
  const slots = await ctx.db.query("calendarSlots").withIndex("by_org_slot", (q) => q.eq("orgId", org._id).gte("slotAt", now).lt("slotAt", now + WEEK)).take(50);
  const campaigns = await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).take(50);
  const strategy = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
  const balance = await creditBalance(ctx, org, await currentPeriod(ctx, org));
  const changes = await ctx.db.query("competitorChanges").withIndex("by_org_at", (q) => q.eq("orgId", org._id).gte("at", weekStart).lt("at", weekEnd)).take(10);
  const report = buildWeeklyReport({
    weekStart,
    weekEnd,
    now: current,
    before: previous,
    ctx: {
      pendingApprovals: pending.length,
      upcomingCalls: upcoming.filter((b) => b.status === "confirmed").map((b) => ({ name: b.name, startAt: b.startAt })),
      scheduledPosts: slots.length,
      outboundOn: campaigns.some((c) => c.sending?.status === "on"),
      hasPlan: Boolean(strategy),
      creditsLeft: balance.available,
    },
  });
  const competitors = await Promise.all(changes.map(async (c) => {
    const watch = await ctx.db.get(c.watchId);
    return { name: c.name, summary: c.summary, suggestedAction: c.suggestedAction ?? null, sourceUrls: c.sourceUrls ?? (watch ? [watch.url] : []), observedAt: c.at };
  }));
  return { ...report, competitors };
}

export const weekly = query({
  args: { slug: v.string(), weeksAgo: v.optional(v.number()) },
  handler: async (ctx, { slug, weeksAgo }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    return reportFor(ctx, org, Math.max(0, Math.min(12, Math.floor(weeksAgo ?? 0))));
  },
});

export const weeklyForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    if (!org || org.deletedAt || org.kind !== "customer") return null;
    const folevi = (await ctx.db.query("airlyLinks").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(10)).some((l) => l.app === "folevi" && l.status === "connected");
    return { slug: org.slug, report: await reportFor(ctx, org, 1), folevi };
  },
});

export const reportOrgs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").withIndex("by_kind_created", (q) => q.eq("kind", "customer")).take(2000);
    return orgs.filter((o) => !o.deletedAt && !o.suspendedAt).map((o) => o._id);
  },
});

/** Mondays: email last week's report to owners and admins who get digests. Each workspace runs in its own action. */
export const sendWeeklyReports = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const orgIds = await ctx.runQuery(internal.reports.reportOrgs, {});
    // Spread over a few minutes so thousands of workspaces never share one action's time limit.
    for (const [i, orgId] of orgIds.entries()) await ctx.scheduler.runAfter(i * 150, internal.reports.sendWeeklyReportFor, { orgId });
    return orgIds.length;
  },
});

export const sendWeeklyReportFor = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<boolean> => {
    const data = await ctx.runQuery(internal.reports.weeklyForOrg, { orgId });
    if (!data) return false;
    const { orgName, emails } = await ctx.runQuery(internal.notifications.recipientsFor, { orgId, purpose: "digest", cadence: "weekly" });
    const url = `${process.env.SITE_URL ?? "https://climbos.app"}/app/${data.slug}/results/week`;
    const r = data.report;
    const md = [r.headline, "", ...r.lines.map((l) => `- **${l.label}:** ${l.value}${l.change ? ` (${l.change > 0 ? "+" : ""}${l.change})` : ""}`), ...(r.competitors?.length ? ["", "## Competitors", ...r.competitors.map((c) => `- **${c.name}:** ${c.summary}${c.sourceUrls?.length ? ` [Source](${c.sourceUrls[0]})` : ""}`)] : []), ...(r.next.length ? ["", "## Next week", ...r.next.map((n) => `- [ ] ${n}`)] : []), "", `[Open in ClimbOS](${url})`].join("\n");
    if (data.folevi) await ctx.runAction(internal.airlyActions.saveReportToFolevi, { orgId, title: `${orgName}: week of ${new Date(r.weekStart).toISOString().slice(0, 10)}`, markdown: md, key: `climbos-week-${orgId}-${r.weekStart}` });
    if (!emails.length) return false;
    const mail = weeklyReportEmail({ orgName, report: data.report, url });
    for (const to of emails) await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId, to, template: "digest", ...mail });
    return true;
  },
});
