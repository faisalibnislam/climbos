import { mergeEmail } from "./index";

/**
 * Sending cold emails from the owner's own mailbox, safely:
 * - warm-up: 10 a day on day one, +5 a day, at most 50 a day;
 * - only on weekdays, 8:00–17:00 in the business's time zone, spaced out;
 * - every email has the sender, a postal address, a one-click unsubscribe
 *   link and "reply no"; replies, bounces and opt-outs stop the sequence.
 */

export const WARMUP = { start: 10, step: 5, max: 50 } as const;
export const SPACING_MINUTES = 7;

export function dailyCap(firstSentAt: number | null, now: number, override?: number | null): number {
  const days = firstSentAt ? Math.max(0, Math.floor((now - firstSentAt) / 86_400_000)) : 0;
  const ramp = Math.min(WARMUP.max, WARMUP.start + WARMUP.step * days);
  return override ? Math.max(1, Math.min(override, WARMUP.max)) : ramp;
}

function localParts(ms: number, timezone: string): { weekday: number; hour: number; minute: number; dayKey: string } {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, hour: Number(get("hour")) % 24, minute: Number(get("minute")), dayKey: `${get("year")}-${get("month")}-${get("day")}` };
}

/** Local calendar day (for the daily cap). */
export function localDayKey(ms: number, timezone: string): string {
  return localParts(ms, timezone).dayKey;
}

export function inSendWindow(ms: number, timezone: string): boolean {
  const p = localParts(ms, timezone);
  return p.weekday >= 1 && p.weekday <= 5 && p.hour >= 8 && p.hour < 17;
}

/** The next moment inside the send window (now, if already inside). */
export function nextSendWindow(ms: number, timezone: string): number {
  let t = ms;
  for (let i = 0; i < 7 * 24 * 4 + 1; i++) {
    if (inSendWindow(t, timezone)) return t;
    t += 15 * 60_000;
  }
  return ms;
}

/** When a follow-up goes out: `days` after the previous email, moved into the next send window. */
export function followUpAt(previousSentAt: number, days: number, timezone: string): number {
  return nextSendWindow(previousSentAt + Math.max(1, days) * 86_400_000, timezone);
}

export interface Sender {
  name: string;
  company: string;
  address: string;
  bookingUrl?: string;
}

/** Subject and plain-text body for one step, with first line, footer and unsubscribe link. */
export function composeEmail(p: { step: { subject: string; body: string }; stepIndex: number; firstLine: string; contactName?: string; sender: Sender; unsubscribeUrl: string }): { subject: string; text: string } {
  const body = mergeEmail(p.stepIndex === 0 ? p.step.body : p.step.body.replace(/\{\{firstLine\}\}\s*/g, ""), p.firstLine);
  const greeting = p.contactName && !/^(the )?(owner|founder|ceo|head|director|manager|team)/i.test(p.contactName) ? `Hi ${p.contactName.split(/\s+/)[0]},\n\n` : "Hi,\n\n";
  const footer = [
    "",
    "—",
    `${p.sender.name}, ${p.sender.company}`,
    p.sender.address,
    p.sender.bookingUrl ? `Book a time: ${p.sender.bookingUrl}` : "",
    `Not relevant? Reply "no", or unsubscribe: ${p.unsubscribeUrl}`,
  ].filter((l, i) => l || i < 2);
  const subject = p.stepIndex === 0 ? p.step.subject : p.step.subject.toLowerCase().startsWith("re:") ? p.step.subject : `Re: ${p.step.subject}`;
  return { subject: subject.slice(0, 160), text: `${greeting}${body}\n${footer.join("\n")}` };
}

/** "No", "not interested", "unsubscribe", "remove me": treat as an opt-out. */
export function isOptOutReply(text: string): boolean {
  const first = text.trim().split(/\n/)[0]?.toLowerCase() ?? "";
  return /^(no\.?|nope|not interested|unsubscribe|remove me|stop|please remove)\b/.test(first);
}

/** The new part of a reply: no quoted history, signature delimiter or MIME noise. */
export function replyText(raw: string): string {
  const lines = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).split(/\r?\n/);
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .+wrote:$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l) || l.trim() === "--" || /^From: /.test(l)) break;
    if (l.startsWith(">") || /^Content-(Type|Transfer-Encoding):/i.test(l) || /^--[\w=-]{10,}/.test(l)) continue;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Signed unsubscribe token: "<prospectId>.<sig>" (sig = first 20 hex chars of SHA-256(secret:id)). */
export async function unsubscribeToken(prospectId: string, secret: string): Promise<string> {
  return `${prospectId}.${(await sha256(`${secret}:${prospectId}`)).slice(0, 20)}`;
}

export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  return (await sha256(`${secret}:${id}`)).slice(0, 20) === sig ? id : null;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Common mailbox presets (owner uses an app password). */
export const MAILBOX_PRESETS = {
  gmail: { label: "Gmail / Google Workspace", smtpHost: "smtp.gmail.com", smtpPort: 465, imapHost: "imap.gmail.com", imapPort: 993, help: "Turn on 2-step verification, then create an app password (Google Account → Security → App passwords)." },
  outlook: { label: "Outlook / Microsoft 365", smtpHost: "smtp.office365.com", smtpPort: 587, imapHost: "outlook.office365.com", imapPort: 993, help: "Use an app password if your account has 2-step verification; SMTP AUTH must be allowed by your admin." },
  zoho: { label: "Zoho Mail", smtpHost: "smtp.zoho.com", smtpPort: 465, imapHost: "imap.zoho.com", imapPort: 993, help: "Create an app-specific password in Zoho Accounts → Security." },
  custom: { label: "Other (custom SMTP)", smtpHost: "", smtpPort: 587, imapHost: "", imapPort: 993, help: "Ask your email provider for SMTP and IMAP settings." },
} as const;

export type MailboxPreset = keyof typeof MAILBOX_PRESETS;
