/**
 * Weekly CEO report: what the growth team did, what came of it, and the few
 * things that need the owner next week. Pure: counts in, report out.
 */

export interface WeekCounts {
  dealsWon: number | null;
  postsPublished: number | null;
  emailsSent: number | null;
  replies: number | null;
  callsBooked: number | null;
  newProspects: number | null;
  reach: number | null;
  clicks: number | null;
  creditsUsed: number | null;
  jobsDone: number | null;
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
  value: number | null;
  /** Change vs the week before (null when there was nothing to compare). */
  change: number | null;
  note?: string;
}

/** Evidence limits travel with counts through app, assistant, email and shared reports. */
export type WeekEvidence = Partial<Record<keyof WeekCounts, { note: string; comparable: boolean }>>;

export interface WeeklyReport {
  weekStart: number;
  weekEnd: number;
  timezone?: string;
  isDemo?: boolean;
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
  reach: "Reach during this period",
  clicks: "Tracked-link clicks",
  jobsDone: "Jobs done",
  creditsUsed: "Credits used",
};

/** Lines in order of business value; zero lines are dropped unless nothing happened at all. */
export function buildWeeklyReport(p: { weekStart: number; weekEnd: number; timezone?: string; now: WeekCounts; before: WeekCounts; ctx: WeekContext; evidence?: WeekEvidence; beforeEvidence?: WeekEvidence }): WeeklyReport {
  const keys = Object.keys(LABELS) as (keyof WeekCounts)[];
  const lines = keys
    .map((key) => {
      const value = p.now[key];
      const previous = p.before[key];
      const comparable = p.evidence?.[key]?.comparable !== false && p.beforeEvidence?.[key]?.comparable !== false;
      const note = [p.evidence?.[key]?.note, !comparable ? "Period change is unavailable for this measure." : null].filter(Boolean).join(" ");
      return { key, label: LABELS[key], value, change: comparable && value !== null && previous !== null && (value || previous) ? value - previous : null, ...(note ? { note } : {}) };
    })
    .filter((l) => l.value === null || l.value > 0 || (l.change ?? 0) !== 0);
  const n = Object.fromEntries(keys.map(key => [key, p.now[key] ?? 0])) as Record<keyof WeekCounts, number>;
  const headline =
    n.dealsWon > 0
      ? `${n.dealsWon} deal${n.dealsWon === 1 ? "" : "s"} won this week.`
      : n.callsBooked > 0
      ? `${n.callsBooked} call${n.callsBooked === 1 ? "" : "s"} booked this week.`
      : n.replies > 0
        ? `${n.replies} reply ${n.replies === 1 ? "message" : "messages"} recorded this week.`
        : n.postsPublished + n.emailsSent > 0
          ? [n.postsPublished > 0 ? `${n.postsPublished} publication confirmation${n.postsPublished === 1 ? "" : "s"}` : null, n.emailsSent > 0 ? `${n.emailsSent} mailbox send${n.emailsSent === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ") + " recorded for this period."
          : [p.now.dealsWon, p.now.callsBooked, p.now.replies, p.now.postsPublished, p.now.emailsSent].some(value => value === null)
            ? "Some recorded activity totals are unavailable; check the report's evidence notes."
            : "No deals, calls or replies recorded for this period; missing evidence is not proof of no activity.";
  const next: string[] = [];
  if (!p.ctx.hasPlan) next.push("Make your growth plan.");
  if (p.ctx.pendingApprovals > 0) next.push(`Approve ${p.ctx.pendingApprovals} draft${p.ctx.pendingApprovals === 1 ? "" : "s"}.`);
  if (n.replies > 0) next.push(`Review ${n.replies} recorded reply message${n.replies === 1 ? "" : "s"}.`);
  for (const c of p.ctx.upcomingCalls.slice(0, 3)) next.push(`Call with ${c.name}, ${new Date(c.startAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: p.timezone ?? "UTC" })}.`);
  if (p.ctx.hasPlan && !p.ctx.outboundOn) next.push("Review whether Find customers fits your current plan and capacity.");
  if (p.ctx.hasPlan && p.ctx.scheduledPosts === 0) next.push("Review next week's content schedule and publishing policy.");
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
