/**
 * Social autopilot rules: pure functions shared by Convex jobs, the UI and
 * tests. The owner picks one of three modes:
 *
 * - always_ask: every post waits for the owner.
 * - trust_ladder: a channel starts in always-ask; after TRUST_THRESHOLD
 *   drafts in a row approved without edits it publishes on its own. Any
 *   rejection, or a problem after an automatic post, drops it back.
 * - auto: posts publish on schedule unless a safety gate says otherwise.
 *
 * Safety gates apply in every mode, so "auto" never publishes unconfirmed
 * facts, prices or regulated claims, or a channel's first post.
 */

export type AutopilotMode = "always_ask" | "trust_ladder" | "auto";
export const AUTOPILOT_MODES: readonly AutopilotMode[] = ["always_ask", "trust_ladder", "auto"];
export const TRUST_THRESHOLD = 5;

/** Channels ClimbOS can publish to directly today (others go out via the export pack). */
export const DIRECT_PUBLISH_CHANNELS = new Set(["instagram", "facebook", "linkedin", "x"]);

export const AUTOPILOT_CHANNELS = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "pinterest"] as const;
export type AutopilotChannel = (typeof AUTOPILOT_CHANNELS)[number];

/** Defaults from published platform timing studies, used until the business's own results say otherwise. */
export const DEFAULT_HOURS: Record<string, number[]> = {
  instagram: [11, 18],
  facebook: [9, 13],
  linkedin: [8, 12],
  x: [9, 15],
  tiktok: [19, 12],
  youtube: [15, 19],
  pinterest: [20, 14],
};

export interface TrustState {
  channel: string;
  streak: number;
  unlocked: boolean;
}

export type TrustEvent = "approved_unedited" | "approved_edited" | "rejected" | "auto_problem";

export function nextTrust(t: TrustState, e: TrustEvent): TrustState {
  switch (e) {
    case "approved_unedited": {
      const streak = t.streak + 1;
      return { ...t, streak, unlocked: t.unlocked || streak >= TRUST_THRESHOLD };
    }
    // An edit means the draft wasn't ready as written: keep going, but don't count it.
    case "approved_edited":
      return { ...t, streak: t.unlocked ? t.streak : 0 };
    case "rejected":
    case "auto_problem":
      return { ...t, streak: 0, unlocked: false };
  }
}

const SENSITIVE: { re: RegExp; why: string }[] = [
  { re: /(\$|£|€)\s?\d|\b\d+\s?%\s?off\b|\b(discount|coupon|promo code|sale ends|limited time|free trial|pricing|price)\b/i, why: "mentions a price or offer" },
  { re: /\b(cure|treat|diagnos|clinically|guarantee[ds]?|risk[- ]free|returns? of|ROI of|income|lose \d+ ?(lbs|kg|pounds))\b/i, why: "makes a health, money or guarantee claim" },
  { re: /\b(giveaway|contest|sweepstake|raffle)\b/i, why: "runs a giveaway or contest" },
  { re: /\[NEEDS FACT/i, why: "still has a fact for you to fill in" },
];

export interface RouteInput {
  mode: AutopilotMode;
  channel: string;
  text: string;
  trust?: TrustState;
  /** Claims the draft makes that aren't backed by confirmed facts. */
  unsupportedClaims: string[];
  /** The expert review's ship decision (null when there was no review, e.g. demo). */
  reviewShipped: boolean | null;
  /** The planner flagged this slot for the owner. */
  plannerNeedsOwner?: boolean;
  plannerNote?: string;
  alwaysAskTopics: string[];
  /** Nothing has been published on this channel by ClimbOS yet. */
  firstOnChannel: boolean;
  /** A connected account can receive the post directly. */
  canPublish: boolean;
}

export interface RouteResult {
  decision: "auto" | "ask";
  reasons: string[];
}

export function routeDraft(i: RouteInput): RouteResult {
  const reasons: string[] = [];
  if (i.mode === "always_ask") return { decision: "ask", reasons: ["You review every post."] };
  if (!DIRECT_PUBLISH_CHANNELS.has(i.channel)) reasons.push(`ClimbOS can't post to ${label(i.channel)} directly yet, so you'll post it from the export pack.`);
  else if (!i.canPublish) reasons.push(`Connect ${label(i.channel)} so ClimbOS can post it for you.`);
  if (i.firstOnChannel) reasons.push(`It's the first post on ${label(i.channel)}, so you see it before it goes out.`);
  if (i.unsupportedClaims.length) reasons.push("It makes a claim we couldn't match to your confirmed facts.");
  if (i.reviewShipped === false) reasons.push("Our reviewer wasn't fully happy with it.");
  if (i.plannerNeedsOwner) reasons.push(i.plannerNote?.trim() ? `Planner: ${i.plannerNote.trim()}` : "The planner flagged it for you.");
  for (const s of SENSITIVE) if (s.re.test(i.text)) reasons.push(`It ${s.why}.`);
  const lower = i.text.toLowerCase();
  for (const topic of i.alwaysAskTopics) {
    const t = topic.trim().toLowerCase();
    if (t && lower.includes(t)) reasons.push(`It mentions "${topic.trim()}", which you asked to approve yourself.`);
  }
  if (i.mode === "trust_ladder" && !i.trust?.unlocked) {
    const left = TRUST_THRESHOLD - (i.trust?.streak ?? 0);
    reasons.push(`${label(i.channel)} earns auto-posting after ${left} more approval${left === 1 ? "" : "s"} without edits.`);
  }
  return reasons.length ? { decision: "ask", reasons: [...new Set(reasons)] } : { decision: "auto", reasons: [i.mode === "auto" ? "Autopilot: passed every safety check." : `Trusted on ${label(i.channel)}: passed every safety check.`] };
}

export function label(channel: string): string {
  return ({ instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest" } as Record<string, string>)[channel] ?? channel;
}

/* ---------------- Time zones and slot timing ---------------- */

/** Offset in minutes of `timeZone` from UTC at `utcMs` (positive east of UTC). */
export function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return Math.round((asUtc - utcMs) / 60_000);
  } catch {
    return 0;
  }
}

/** UTC ms for a wall-clock time in `timeZone`. */
export function zonedTime(year: number, month0: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month0, day, hour, minute);
  const first = guess - tzOffsetMinutes(guess, timeZone) * 60_000;
  // Second pass corrects for a DST change between the guess and the answer.
  return guess - tzOffsetMinutes(first, timeZone) * 60_000;
}

/** Local calendar date parts of a UTC instant in `timeZone`. */
export function localDate(utcMs: number, timeZone: string): { year: number; month0: number; day: number; weekday: number } {
  const shifted = new Date(utcMs + tzOffsetMinutes(utcMs, timeZone) * 60_000);
  const wd = shifted.getUTCDay(); // 0 = Sunday
  return { year: shifted.getUTCFullYear(), month0: shifted.getUTCMonth(), day: shifted.getUTCDate(), weekday: wd === 0 ? 7 : wd };
}

/** The Monday (local) of the week after `now`, as "YYYY-MM-DD". */
export function nextWeekOf(now: number, timeZone: string): string {
  const d = localDate(now, timeZone);
  const monday = new Date(Date.UTC(d.year, d.month0, d.day + (8 - d.weekday)));
  return monday.toISOString().slice(0, 10);
}

/** The Monday (local) of the week containing `now`. */
export function thisWeekOf(now: number, timeZone: string): string {
  const d = localDate(now, timeZone);
  return new Date(Date.UTC(d.year, d.month0, d.day - (d.weekday - 1))).toISOString().slice(0, 10);
}

export interface SlotTimingInput {
  weekOf: string;
  day: number;
  channel: string;
  timeZone: string;
  /** Owner's preferred posting hours (local); falls back to channel defaults. */
  preferredHours?: number[];
  quietHours?: { start: number; end: number };
  /** How many slots already sit on this channel and day (to stagger times). */
  indexOnDay: number;
}

function inQuiet(h: number, q?: { start: number; end: number }) {
  if (!q || q.start === q.end) return false;
  return q.start < q.end ? h >= q.start && h < q.end : h >= q.start || h < q.end;
}

export function slotTime(i: SlotTimingInput): number {
  const [y, m, d] = i.weekOf.split("-").map(Number);
  const day = Math.min(7, Math.max(1, Math.round(i.day)));
  const hours = (i.preferredHours?.length ? i.preferredHours : DEFAULT_HOURS[i.channel] ?? [10, 16]).filter((h) => !inQuiet(h, i.quietHours));
  const pool = hours.length ? hours : [12];
  const hour = pool[i.indexOnDay % pool.length];
  const date = new Date(Date.UTC(y, m - 1, d + day - 1));
  return zonedTime(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, 0, i.timeZone);
}

/** Spread `n` posts over a week: Monday-first, evenly spaced days (1-7). */
export function spreadDays(n: number): number[] {
  if (n <= 0) return [];
  if (n >= 7) return Array.from({ length: n }, (_, i) => (i % 7) + 1);
  return Array.from({ length: n }, (_, i) => Math.min(7, 1 + Math.floor((i * 7) / n)));
}

export function clampCadence(n: number): number {
  return Math.max(0, Math.min(7, Math.round(n)));
}
