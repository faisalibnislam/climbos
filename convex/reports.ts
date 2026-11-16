import { v } from "convex/values";
import { microsToCredits } from "../shared/economics";
import { buildWeeklyReport, localWeek, type WeekCounts, type WeekEvidence } from "../shared/report/weekly";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalQuery, query, type QueryCtx } from "./_generated/server";
import { creditBalance } from "./lib/credits";
import { weeklyReportEmail } from "./lib/emailTemplates";
import { currentPeriod } from "./lib/periods";
import { requireOrgAccess } from "./lib/tenancy";
import { linkClicksBetween } from "./links";

/** Weekly CEO report: in the app (Results → This week) and by email on Mondays. */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
// Both periods share one transaction. Together with the other bounded reads,
// 2,000 usage and link rows per period leave room below 32,000 scanned documents.
const USAGE_LIMIT = 2000;

async function countsFor(ctx: QueryCtx, org: Doc<"organizations">, from: number, to: number): Promise<{ counts: WeekCounts; evidence: WeekEvidence }> {
  const orgId = org._id;
  // Each read uses its event timestamp, not a mutable status-update time or a campaign creation window.
  const [receipts, sends, prospects, messages, bookings, won, finished, usage, clicks] = await Promise.all([
    ctx.db.query("actionReceipts").withIndex("by_org_verified", q => q.eq("orgId", orgId).gte("verifiedAt", from).lt("verifiedAt", to)).take(1001),
    ctx.db.query("outboundSends").withIndex("by_org_sent", q => q.eq("orgId", orgId).gte("sentAt", from).lt("sentAt", to)).take(2001),
    ctx.db.query("prospects").withIndex("by_org_created", q => q.eq("orgId", orgId).gte("createdAt", from).lt("createdAt", to)).take(2001),
    ctx.db.query("communityMessages").withIndex("by_org_received", q => q.eq("orgId", orgId).gte("receivedAt", from).lt("receivedAt", to)).take(2001),
    ctx.db.query("bookings").withIndex("by_org_created", q => q.eq("orgId", orgId).gte("createdAt", from).lt("createdAt", to)).take(1001),
    ctx.db.query("deals").withIndex("by_org_won", q => q.eq("orgId", orgId).gte("wonAt", from).lt("wonAt", to)).take(1001),
    ctx.db.query("workflowRuns").withIndex("by_org_finished", q => q.eq("orgId", orgId).gte("finishedAt", from).lt("finishedAt", to)).take(1001),
    ctx.db.query("usageEvents").withIndex("by_org_created", q => q.eq("orgId", orgId).gte("createdAt", from).lt("createdAt", to)).take(USAGE_LIMIT + 1),
    linkClicksBetween(ctx, orgId, from, to),
  ]);
  const socialActions = new Set(["instagram.publish_media", "facebook_pages.publish_post", "linkedin.publish_post", "x.publish_post"]);
  const published = receipts.filter(r => socialActions.has(r.action) && (r.status === "verified" || (org.kind === "demo" && r.status === "fixture_verified")));
  const evidence: WeekEvidence = {
    dealsWon: { note: "Currently won deals with a recorded won date in this period. Owner-recorded status is not verified payment or marketing attribution.", comparable: true },
    postsPublished: { note: "Distinct social posts with publication confirmations recorded in this period. Missing or uncertain confirmations and manual exports are not verified publications.", comparable: true },
    emailsSent: { note: "Mailbox sends with recorded sent times, including later bounces. Sends do not establish delivery or customers.", comparable: true },
    replies: { note: "Recorded outbound email reply messages by received time, not unique people, qualified interest or unanswered messages. Other channels and missing mailbox history are not included.", comparable: true },
    callsBooked: { note: "Currently confirmed bookings created in this period, not attended calls or customers.", comparable: true },
    newProspects: { note: "Prospect records created in this period, not verified demand or customers.", comparable: true },
    reach: { note: "Post snapshots do not establish reach during this period. Impressions are not reach; reach across posts is not a deduplicated audience.", comparable: false },
    clicks: { note: clicks.note, comparable: clicks.comparable },
    creditsUsed: { note: "Credits represented by recorded usage events in this period; separate from provider invoices and customer revenue.", comparable: !usage.some(r => r.estimated) },
    jobsDone: { note: "Jobs with a recorded verified finish in this period, not customer outcomes.", comparable: true },
  };
  const counts: WeekCounts = {
    dealsWon: won.filter(d => d.stage === "won").length,
    postsPublished: new Set(published.map(r => `${r.provider}:${r.externalId}`)).size,
    emailsSent: sends.filter(s => s.status === "sent" || s.status === "bounced").length,
    replies: new Set(messages.filter(m => m.kind === "email" && m.prospectId && (!m.isFixture || org.kind === "demo")).map(m => m.externalId)).size,
    callsBooked: bookings.filter(b => b.status === "confirmed").length,
    newProspects: prospects.length,
    reach: null,
    clicks: clicks.value,
    creditsUsed: Math.round(microsToCredits(usage.reduce((sum, r) => sum + r.costMicros, 0))),
    jobsDone: finished.filter(r => r.status === "verified" && (!r.isFixture || org.kind === "demo")).length,
  };
  const limits: [keyof WeekCounts, number, number][] = [["dealsWon", won.length, 1000], ["postsPublished", receipts.length, 1000], ["emailsSent", sends.length, 2000], ["replies", messages.length, 2000], ["callsBooked", bookings.length, 1000], ["newProspects", prospects.length, 2000], ["creditsUsed", usage.length, USAGE_LIMIT], ["jobsDone", finished.length, 1000]];
  for (const [key, size, limit] of limits) if (size > limit) {
    counts[key] = null;
    evidence[key] = { note: `Count unavailable: the ${limit.toLocaleString("en-US")}-record read limit was reached. Narrow the reporting period.`, comparable: false };
  }
  if (published.some(r => !r.externalId || !r.artifactId)) {
    counts.postsPublished = null;
    evidence.postsPublished = { note: "Publication confirmations lack the post identity needed to count distinct published posts.", comparable: false };
  }
  if (usage.some(r => !Number.isFinite(r.costMicros) || r.costMicros < 0) || (counts.creditsUsed !== null && !Number.isFinite(counts.creditsUsed))) {
    counts.creditsUsed = null;
    evidence.creditsUsed = { note: "Recorded usage values are invalid or unavailable.", comparable: false };
  } else if (counts.creditsUsed !== null && usage.some(r => r.estimated)) evidence.creditsUsed = { note: "Recorded usage includes estimated charges; this is not a reconciled final charge.", comparable: false };
  return { counts, evidence };
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
  const [current, previous] = await Promise.all([countsFor(ctx, org, weekStart, weekEnd), countsFor(ctx, org, prevFrom, Math.min(prevTo, weekStart))]);
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
    timezone: org.timezone,
    now: current.counts,
    before: previous.counts,
    evidence: current.evidence,
    beforeEvidence: previous.evidence,
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
  return { ...report, timezone: org.timezone, isDemo: org.kind === "demo", competitors };
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
    const md = [r.headline, "", ...r.lines.map((l) => `- **${l.label}:** ${l.value ?? "Unknown"}${l.change ? ` (${l.change > 0 ? "+" : ""}${l.change})` : ""}${l.note ? ` — ${l.note}` : ""}`), ...(r.competitors?.length ? ["", "## Competitors", ...r.competitors.map((c) => `- **${c.name}:** ${c.summary}${c.sourceUrls?.length ? ` [Source](${c.sourceUrls[0]})` : ""}`)] : []), ...(r.next.length ? ["", "## Next week", ...r.next.map((n) => `- [ ] ${n}`)] : []), "", `[Open in ClimbOS](${url})`].join("\n");
    if (data.folevi) await ctx.runAction(internal.airlyActions.saveReportToFolevi, { orgId, title: `${orgName}: week of ${new Date(r.weekStart).toISOString().slice(0, 10)}`, markdown: md, key: `climbos-week-${orgId}-${r.weekStart}` });
    if (!emails.length) return false;
    const mail = weeklyReportEmail({ orgName, report: data.report, url });
    for (const to of emails) await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId, to, template: "digest", ...mail });
    return true;
  },
});
