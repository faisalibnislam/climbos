/**
 * Learned-rate definitions (S4, REQ-LEARN-01..03). Every rate names what it
 * counts and the window both of its counts cover. A cumulative counter is
 * never divided into a windowed count: when views are only kept as a
 * lifetime total, the conversions use the lifetime too.
 */

export type MetricWindow = "120d" | "lifetime";
export const OUTREACH_REPLY_WINDOW_DAYS = 21;
const DAY_MS = 86_400_000;

/** Don't count a stopped outreach campaign until its reply-watch window closes. */
export function outreachCohortMature(input: {
  sendingStatus?: "on" | "paused" | "done";
  lastSentAt?: number;
  latestObservedSentAt: number;
  now: number;
}): boolean {
  if (input.sendingStatus === "on") return false;
  const lastSentAt = input.lastSentAt ?? input.latestObservedSentAt;
  return input.now - lastSentAt >= OUTREACH_REPLY_WINDOW_DAYS * DAY_MS;
}

export interface MetricDef {
  label: string;
  /** What the denominator and numerator are, in plain words. */
  counts: string;
  window: MetricWindow;
  minTrials: number;
  /** Optional maturity rule for outcome cohorts. */
  maturity?: string;
}

export const LEARN_WINDOW_DAYS = 120;
export const MAX_POOLED_TRIALS_PER_WORKSPACE = 100;

/** Bound one workspace's influence before pooling; keep an approximately proportional success count. */
export function boundedPoolContribution(trials: number, successes: number, maxTrials = MAX_POOLED_TRIALS_PER_WORKSPACE): { trials: number; successes: number } {
  if (!(trials > maxTrials)) return { trials: Math.max(0, trials), successes: Math.min(Math.max(0, trials), Math.max(0, successes)) };
  return { trials: maxTrials, successes: Math.min(maxTrials, Math.max(0, Math.round((successes / trials) * maxTrials))) };
}

export const METRIC_DEFS: Record<string, MetricDef> = {
  // Any reply, including "no thanks": not a measure of interest on its own.
  outreach_reply: { label: "Outreach emails → any reply", counts: "first emails sent → prospects who replied (any reply, including no)", window: "120d", minTrials: 30, maturity: `campaign stopped and ${OUTREACH_REPLY_WINDOW_DAYS}-day reply window elapsed` },
  outreach_qualified_reply: { label: "Outreach emails → qualified reply", counts: "first emails sent → prospects whose reply was explicitly marked qualified by the owner", window: "120d", minTrials: 30, maturity: `campaign stopped and ${OUTREACH_REPLY_WINDOW_DAYS}-day reply window elapsed` },
  outreach_booking: { label: "Outreach replies → booked calls", counts: "replies → booked or won", window: "120d", minTrials: 5, maturity: `campaign stopped and ${OUTREACH_REPLY_WINDOW_DAYS}-day reply window elapsed` },
  outreach_booked: { label: "Outreach emails → booked calls", counts: "first emails sent → booked or won", window: "120d", minTrials: 30, maturity: `campaign stopped and ${OUTREACH_REPLY_WINDOW_DAYS}-day reply window elapsed` },
  booking_attended: { label: "Booked calls → attended", counts: "calls with an outcome → attended", window: "120d", minTrials: 5 },
  landing_lead: { label: "Landing page views → leads", counts: "page views → leads, both all-time counters", window: "lifetime", minTrials: 50 },
  chat_lead: { label: "Website chats → email captured", counts: "chats → chats with an email", window: "120d", minTrials: 10 },
  review_click: { label: "Review requests → opened review link", counts: "requests sent → link opened", window: "120d", minTrials: 10 },
  bio_signup: { label: "Link-in-bio views → sign-ups", counts: "page views → sign-ups, both all-time", window: "lifetime", minTrials: 50 },
};

export interface RawLearningInputs {
  /** Per campaign: prospects sent a first email in the window, and their current stage. */
  outreach: { contacted: number; replied: number; qualified: number; booked: number }[];
  /** Bookings in the window with a recorded outcome. */
  bookingOutcomes: ("attended" | "no_show")[];
  /** Lifetime counters per landing page. */
  landing: { views: number; leads: number }[];
  chats: { total: number; withEmail: number };
  reviews: { sent: number; clicked: number };
  /** Lifetime bio views and lifetime bio sign-ups (null when there's no bio page). */
  bio: { views: number; signups: number } | null;
}

export type Counts = Record<string, { trials: number; successes: number }>;

export function learningCounts(x: RawLearningInputs): Counts {
  const c: Counts = {};
  const add = (m: string, t: number, s: number) => {
    if (!(t > 0)) return;
    c[m] = { trials: (c[m]?.trials ?? 0) + t, successes: (c[m]?.successes ?? 0) + Math.min(s, t) };
  };
  for (const o of x.outreach) {
    add("outreach_reply", o.contacted, o.replied);
    add("outreach_qualified_reply", o.contacted, o.qualified);
    add("outreach_booking", o.replied, o.booked);
    add("outreach_booked", o.contacted, o.booked);
  }
  add("booking_attended", x.bookingOutcomes.length, x.bookingOutcomes.filter((o) => o === "attended").length);
  for (const p of x.landing) add("landing_lead", p.views, p.leads);
  add("chat_lead", x.chats.total, x.chats.withEmail);
  add("review_click", x.reviews.sent, x.reviews.clicked);
  if (x.bio) add("bio_signup", x.bio.views, x.bio.signups);
  return c;
}

/** 90% Wilson interval for a rate (uncertainty, not causality). */
export function wilson90(successes: number, trials: number): { low: number; high: number } | null {
  if (!(trials > 0)) return null;
  const z = 1.645;
  const p = successes / trials;
  const d = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / d;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;

/** One planner line: counts, window, interval and what the rate does and doesn't mean. */
export function rateLine(metric: string, scope: "own" | { workspaces: number; label: string }, r: { trials: number; successes: number }): string {
  const def = METRIC_DEFS[metric];
  const rate = r.trials ? r.successes / r.trials : 0;
  const ci = wilson90(r.successes, r.trials);
  const window = `${def.window === "120d" ? `last ${LEARN_WINDOW_DAYS} days` : "all time"}${def.maturity ? `; ${def.maturity}` : ""}`;
  const range = ci ? `, 90% range ${pct(ci.low)}–${pct(ci.high)}` : "";
  if (scope === "own") {
    const cautious = r.trials < def.minTrials && ci
      ? `; cautious planning rate ${pct(ci.low)} (90% Wilson lower bound; ${r.trials}/${def.minTrials} minimum trials)`
      : "";
    return `- ${def.label}: THIS BUSINESS ${pct(rate)} (${r.successes}/${r.trials}, ${window}${range}${cautious}) [first-party counts of ${def.counts}; observed, not proof of cause]`;
  }
  const roundedPct = (x: number) => `${Math.round(x / 0.05) * 5}%`;
  const roundedCount = (x: number) => Math.round(x / 10) * 10;
  const workspaceBand = scope.workspaces >= 20 ? `${Math.floor(scope.workspaces / 10) * 10}+` : "10+";
  const pooledRange = ci ? `, rounded 90% range ${roundedPct(ci.low)}–${roundedPct(ci.high)}` : "";
  return `- ${def.label}: ClimbOS ${scope.label} ${roundedPct(rate)} (~${roundedCount(r.successes)}/~${roundedCount(r.trials)}, ${workspaceBand} workspaces, ${window}${pooledRange}) [privacy-rounded pooled counts; each workspace contributes at most ${MAX_POOLED_TRIALS_PER_WORKSPACE} trials; compare offer, channel, audience, market and stage before transferring]`;
}
