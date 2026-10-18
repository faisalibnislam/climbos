import { localDate, zonedTime } from "../autopilot";
import type { OutreachOutput, ProspectsOutput } from "../agents/specs";

/**
 * Outbound: "Drop your website link. Our AI finds the people who need your
 * product, writes the emails and books the calls." Pure helpers shared by the
 * backend, the UI and tests: booking slots, email merge, CSV export and the
 * deterministic demo campaign.
 */

export const PROSPECT_STAGES = ["suggested", "approved", "skipped", "contacted", "replied", "booked", "won", "lost"] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

/** Pipeline order shown to owners (skipped is hidden from the funnel). */
export const FUNNEL_STAGES: ProspectStage[] = ["suggested", "approved", "contacted", "replied", "booked", "won"];

export const STAGE_LABEL: Record<ProspectStage, string> = {
  suggested: "Suggested",
  approved: "Approved",
  skipped: "Skipped",
  contacted: "Emailed",
  replied: "Replied",
  booked: "Call booked",
  won: "Won",
  lost: "Lost",
};

/** One 0-100 priority: mostly fit, plus timing (a fresh trigger moves people up). */
export function prospectScore(p: { fit: number; timing: number }): number {
  return Math.round(p.fit * 0.7 + p.timing * 0.3);
}

/* ---------------- Booking slots ---------------- */

export interface BookingRules {
  durationMin: number;
  timezone: string;
  /** 1 = Monday … 7 = Sunday. */
  days: number[];
  startHour: number;
  endHour: number;
  bufferMin: number;
  noticeHours: number;
}

export const DEFAULT_BOOKING: Omit<BookingRules, "timezone"> = { durationMin: 30, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, bufferMin: 15, noticeHours: 12 };

/** Open start times (UTC ms) for the next `horizonDays`, skipping taken ranges (with buffers). */
export function openSlots(rules: BookingRules, taken: { startAt: number; endAt: number }[], now: number, horizonDays = 14): number[] {
  const out: number[] = [];
  const step = rules.durationMin + rules.bufferMin;
  const earliest = now + rules.noticeHours * 3_600_000;
  const today = localDate(now, rules.timezone);
  for (let d = 0; d < horizonDays; d++) {
    const date = new Date(Date.UTC(today.year, today.month0, today.day + d));
    const wd = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (!rules.days.includes(wd)) continue;
    for (let m = rules.startHour * 60; m + rules.durationMin <= rules.endHour * 60; m += step) {
      const start = zonedTime(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), Math.floor(m / 60), m % 60, rules.timezone);
      const end = start + rules.durationMin * 60_000;
      if (start < earliest) continue;
      const pad = rules.bufferMin * 60_000;
      if (taken.some((t) => start < t.endAt + pad && end > t.startAt - pad)) continue;
      out.push(start);
    }
  }
  return out;
}

/** An .ics invite for a confirmed call. */
export function icsInvite(p: { uid: string; startAt: number; endAt: number; title: string; description: string; organizer: string }): string {
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClimbOS//Booking//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${p.uid}@climbos.app`,
    `DTSTAMP:${fmt(Date.now())}`,
    `DTSTART:${fmt(p.startAt)}`,
    `DTEND:${fmt(p.endAt)}`,
    `SUMMARY:${esc(p.title)}`,
    `DESCRIPTION:${esc(p.description)}`,
    `ORGANIZER;CN=${esc(p.organizer)}:mailto:hello@climbos.app`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ---------------- Emails ---------------- */

/** Step 1 with the prospect's opener merged in; later steps unchanged. */
export function mergeEmail(body: string, firstLine: string): string {
  const line = firstLine.trim();
  return body
    .replace(/\{\{firstLine\}\}\s*/g, line ? `${line}\n\n` : "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The footer every cold email carries (sender, address, a plain opt-out). */
export function emailFooter(p: { sender: string; company: string; address: string; bookingUrl?: string }): string {
  return [`${p.sender}, ${p.company}`, p.address, p.bookingUrl ? `Book a time: ${p.bookingUrl}` : "", "Not relevant? Reply \"no\" and I won't email again."].filter(Boolean).join("\n");
}

function csvCell(v: string): string {
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Approved prospects with their merged first email, ready for any mailbox or sequencer. */
export function prospectsCsv(rows: { company: string; website: string; contact: string; publicEmail?: string; location: string; why: string; firstLine: string }[], sequence: { subject: string; body: string }[]): string {
  const head = ["Company", "Website", "Contact", "Email", "Location", "Why now", "Subject", "Email 1", ...sequence.slice(1).map((_, i) => `Follow-up ${i + 1}`)];
  const lines = rows.map((r) => [r.company, r.website, r.contact, r.publicEmail ?? "", r.location, r.why, sequence[0]?.subject ?? "", mergeEmail(sequence[0]?.body ?? "", r.firstLine), ...sequence.slice(1).map((s) => s.body)].map(csvCell).join(","));
  return [head.map(csvCell).join(","), ...lines].join("\r\n");
}

export function domainOf(url: string): string {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** A short public slug for a booking page. */
export function bookingSlug(name: string, salt: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "meet";
  return `${base}-${salt.slice(-4).toLowerCase()}`;
}

/* ---------------- Demo / fixture campaign ---------------- */

export function fixtureOutbound(p: { businessName: string; who: string; where: string; count: number }): { prospects: ProspectsOutput; outreach: OutreachOutput } {
  const where = p.where || "your area";
  const who = p.who || "small teams that publish online";
  const names = ["Northwind Studio", "Harbor & Pine", "Brightline Clinic", "Copper Kettle Co.", "Atlas Fitness Lab", "Juniper Legal", "Mosaic Learning", "Riverside Dental"];
  const prospects = names.slice(0, Math.max(3, Math.min(p.count, names.length))).map((company, i) => {
    const slug = company.toLowerCase().replace(/[^a-z]+/g, "");
    return {
      company,
      website: `https://${slug}.example`,
      location: where,
      sizeBand: i % 2 ? "11-50" : "1-10",
      why: `Example prospect: matches "${who}" and shows a recent change worth a note.`,
      evidence: [{ url: `https://${slug}.example/about`, observation: "Demo data: an example observation from their site." }],
      trigger: i % 3 === 0 ? "Hiring for a marketing role (demo)" : "",
      fit: 88 - i * 6,
      timing: i % 3 === 0 ? 80 : 55,
      contact: i % 2 ? "Head of marketing" : "Owner",
      publicEmail: "",
    };
  });
  return {
    prospects: {
      icp: { summary: `${who} in ${where} that would get value from ${p.businessName} now.`, mustHaves: [who, `Based in ${where}`], disqualifiers: ["Existing customers", "Competitors"], triggers: ["Hiring", "New location", "Website change"], decisionMaker: "Owner or head of marketing" },
      prospects,
      excluded: [{ company: "Example Competitor Ltd", reason: "Competitor" }],
    },
    outreach: {
      sequence: [
        { day: 0, subject: "quick question", body: `{{firstLine}}\nWe help teams like yours get more from ${p.businessName}. Worth a 15-minute look?`, purpose: "Open with their situation, one offer, an easy yes." },
        { day: 3, subject: "re: quick question", body: "One more thing: most teams we talk to start with a small test. Want the one-page version?", purpose: "Add something new." },
        { day: 7, subject: "re: quick question", body: "Should I close the loop? If timing is off, reply \"later\" and I'll check back next quarter.", purpose: "Honest close-out." },
      ],
      firstLines: prospects.map((x) => ({ company: x.company, line: `Saw ${x.company} is ${x.trigger ? x.trigger.replace(/ \(demo\)$/, "").toLowerCase() : "growing"} (demo).` })),
      ownerNotes: ["Demo data: no real companies or emails.", "Check every opener before sending."],
    },
  };
}

/* ---------------- published emails (our own finder: only what a site publishes) ---------------- */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const NEVER = /^(no-?reply|donotreply|privacy|legal|abuse|postmaster|hostmaster|webmaster|dmarc|bounce|mailer-daemon|jobs|careers|recruit|hr|unsubscribe|gdpr|dpo)\b/i;
const ROLE = /^(hello|hi|contact|info|team|sales|partners|partnerships|business|enquiries|inquiries|office|founders?|ceo)\b/i;
const SUPPORT = /^(support|help|care|service|billing)\b/i;

export interface FoundEmail {
  email: string;
  url: string;
  kind: "person" | "role" | "support";
}

/**
 * Emails a prospect publishes on its own pages (never guessed). Same-domain
 * only, junk and do-not-contact boxes dropped, ranked person > role > support.
 */
export function publishedEmails(pages: { url: string; text: string }[], domain: string): FoundEmail[] {
  const base = domain.replace(/^www\./, "").toLowerCase();
  const seen = new Map<string, FoundEmail>();
  for (const p of pages) {
    const decoded = p.text.replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, "@").replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".");
    for (const raw of decoded.match(EMAIL_RE) ?? []) {
      const email = raw.toLowerCase().replace(/^mailto:/, "").replace(/[.,;:]+$/, "");
      const [local, host] = email.split("@");
      if (!local || !host) continue;
      if (!(host === base || host.endsWith(`.${base}`))) continue;
      if (/\.(png|jpe?g|gif|svg|webp)$/.test(email) || NEVER.test(local)) continue;
      if (!seen.has(email)) seen.set(email, { email, url: p.url, kind: ROLE.test(local) ? "role" : SUPPORT.test(local) ? "support" : "person" });
    }
  }
  const rank = { person: 0, role: 1, support: 2 } as const;
  return [...seen.values()].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Same-site pages likely to list contact details. */
export const CONTACT_PATH = /(contact|about|team|people|company|imprint|impressum|leadership|founders?)/i;
