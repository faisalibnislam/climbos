/**
 * Weekly CEO report: what the growth team did, what came of it, and the few
 * things that need the owner next week. Pure: counts in, report out.
 */

export interface WeekCounts {
  dealsWon: number;
  postsPublished: number;
  emailsSent: number;
  replies: number;
  callsBooked: number;
  newProspects: number;
  reach: number;
  clicks: number;
  creditsUsed: number;
  jobsDone: number;
}

export interface WeekContext {
  pendingApprovals: number;
  upcomingCalls: { name: string; startAt: number }[];
  scheduledPosts: number;
  outboundOn: boolean;
  hasPlan: boolean;
  creditsLeft: number;
}

export interface ReportLine {
  key: keyof WeekCounts;
  label: string;
  value: number;
  /** Change vs the week before (null when there was nothing to compare). */
  change: number | null;
}

export interface WeeklyReport {
  weekStart: number;
  weekEnd: number;
  headline: string;
  lines: ReportLine[];
  next: string[];
  /** Competitor watch: what changed this week. */
  competitors?: { name: string; summary: string; sourceUrls?: string[]; observedAt?: number }[];
}

const LABELS: Record<keyof WeekCounts, string> = {
  dealsWon: "Deals won",
  callsBooked: "Calls booked",
  replies: "Replies",
  emailsSent: "Emails sent",
  newProspects: "New prospects",
  postsPublished: "Posts published",
  reach: "Post reach",
  clicks: "Clicks",
  jobsDone: "Jobs done",
  creditsUsed: "Credits used",
};

/** Lines in order of business value; zero lines are dropped unless nothing happened at all. */
export function buildWeeklyReport(p: { weekStart: number; weekEnd: number; now: WeekCounts; before: WeekCounts; ctx: WeekContext }): WeeklyReport {
  const keys = Object.keys(LABELS) as (keyof WeekCounts)[];
  const lines = keys
    .map((key) => ({ key, label: LABELS[key], value: p.now[key], change: p.before[key] || p.now[key] ? p.now[key] - p.before[key] : null }))
    .filter((l) => l.value > 0 || (l.change ?? 0) !== 0);
  const n = p.now;
  const headline =
    n.dealsWon > 0
      ? `${n.dealsWon} deal${n.dealsWon === 1 ? "" : "s"} won this week.`
      : n.callsBooked > 0
      ? `${n.callsBooked} call${n.callsBooked === 1 ? "" : "s"} booked this week.`
      : n.replies > 0
        ? `${n.replies} ${n.replies === 1 ? "person" : "people"} replied this week.`
        : n.postsPublished + n.emailsSent > 0
          ? `${n.postsPublished} post${n.postsPublished === 1 ? "" : "s"} and ${n.emailsSent} email${n.emailsSent === 1 ? "" : "s"} went out.`
          : "A quiet week. Two clicks get things moving again.";
  const next: string[] = [];
  if (!p.ctx.hasPlan) next.push("Make your growth plan.");
  if (p.ctx.pendingApprovals > 0) next.push(`Approve ${p.ctx.pendingApprovals} draft${p.ctx.pendingApprovals === 1 ? "" : "s"}.`);
  if (n.replies > 0) next.push(`Answer ${n.replies} repl${n.replies === 1 ? "y" : "ies"}.`);
  for (const c of p.ctx.upcomingCalls.slice(0, 3)) next.push(`Call with ${c.name}, ${new Date(c.startAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}.`);
  if (p.ctx.hasPlan && !p.ctx.outboundOn) next.push("Turn on Find customers to start booking calls.");
  if (p.ctx.hasPlan && p.ctx.scheduledPosts === 0) next.push("Plan next week's posts (Autopilot does it for you).");
  if (p.ctx.creditsLeft < 50) next.push(`Only ${p.ctx.creditsLeft} credits left. Top up or upgrade.`);
  return { weekStart: p.weekStart, weekEnd: p.weekEnd, headline, lines, next: next.slice(0, 5) };
}

/** Monday 00:00 UTC of the week containing `ms`. */
export function weekStartUtc(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** How far a timezone's wall clock is ahead of UTC at `ms`. */
function offsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second")) - Math.floor(ms / 1000) * 1000;
}

/** Monday 00:00 in `timeZone` of the week containing `ms` (UTC when the zone is unknown). */
export function weekStartIn(ms: number, timeZone?: string): number {
  if (!timeZone || timeZone === "UTC") return weekStartUtc(ms);
  try {
    const off = offsetMs(ms, timeZone);
    const wall = weekStartUtc(ms + off); // local Monday midnight, written as if it were UTC
    const first = wall - off;
    const off2 = offsetMs(first, timeZone); // the offset can differ on Monday (daylight saving)
    return off2 === off ? first : wall - off2;
  } catch {
    return weekStartUtc(ms);
  }
}

/** The local week `weeksAgo` weeks back: its start, its end, and the week before it. */
export function localWeek(now: number, timeZone: string | undefined, weeksAgo: number): { start: number; end: number; prevStart: number } {
  let start = weekStartIn(now, timeZone);
  for (let i = 0; i < weeksAgo; i++) start = weekStartIn(start - 86_400_000, timeZone);
  return { start, end: weekStartIn(start + 8 * 86_400_000, timeZone), prevStart: weekStartIn(start - 86_400_000, timeZone) };
}
