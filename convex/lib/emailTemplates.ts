import type { WeeklyReport } from "../../shared/report/weekly";
/**
 * Plain, accessible transactional email templates for ClimbOS platform mail.
 * Inline styles only; every email has a text alternative.
 */

const GREEN = "#0b5d46";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(
    title,
  )}</title></head><body style="margin:0;background:#eef0ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1f1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #dfe3e0;border-radius:10px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700;font-size:18px;color:${GREEN}">ClimbOS</p>
${bodyHtml}
<p style="margin:32px 0 0;font-size:12px;color:#6b6f69">ClimbOS · climbos.app · You received this because of activity on your ClimbOS account.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function signInCodeEmail(code: string) {
  const pretty = `${code.slice(0, 4)} ${code.slice(4)}`;
  return {
    subject: `Your ClimbOS sign-in code: ${pretty}`,
    text: `Your ClimbOS sign-in code is ${pretty}. It expires in 15 minutes. If you didn't ask for this, you can ignore this email.`,
    html: layout(
      "Your ClimbOS sign-in code",
      `<h1 style="margin:0 0 8px;font-size:22px">Your sign-in code</h1>
<p style="margin:0 0 20px;color:#454a44">Enter this code to continue. It expires in 15 minutes.</p>
<p style="margin:0 0 20px;font-size:32px;letter-spacing:6px;font-weight:700;color:${GREEN}">${escapeHtml(pretty)}</p>
<p style="margin:0;color:#6b6f69;font-size:14px">If you didn't ask for this, you can safely ignore this email.</p>`,
    ),
  };
}

export function invitationEmail(params: { orgName: string; inviterName: string; role: string; url: string }) {
  const { orgName, inviterName, role, url } = params;
  return {
    subject: `${inviterName} invited you to ${orgName} on ClimbOS`,
    text: `${inviterName} invited you to join ${orgName} on ClimbOS as ${role}. Accept: ${url} (link expires in 7 days).`,
    html: layout(
      "You're invited to ClimbOS",
      `<h1 style="margin:0 0 8px;font-size:22px">Join ${escapeHtml(orgName)}</h1>
<p style="margin:0 0 20px;color:#454a44">${escapeHtml(inviterName)} invited you to help grow ${escapeHtml(orgName)} as <strong>${escapeHtml(role)}</strong>.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Accept invitation</a></p>
<p style="margin:0;color:#6b6f69;font-size:14px">This link expires in 7 days.</p>`,
    ),
  };
}

export function usageAlertEmail(params: { orgName: string; percent: number; meter: string; url: string }) {
  const { orgName, percent, meter, url } = params;
  const reached = percent >= 100;
  return {
    subject: reached
      ? `${orgName}: ${meter} limit reached for this month`
      : `${orgName}: ${percent}% of this month's ${meter.toLowerCase()} used`,
    text: `${orgName} has used ${percent}% of this month's ${meter}. ${
      reached ? "New work of this type is paused until next month or until you add capacity." : ""
    } Details: ${url}`,
    html: layout(
      "Usage update",
      `<h1 style="margin:0 0 8px;font-size:22px">${reached ? "Monthly limit reached" : `${percent}% used`}</h1>
<p style="margin:0 0 20px;color:#454a44">${escapeHtml(orgName)} has used ${percent}% of this month's <strong>${escapeHtml(meter)}</strong>.${
        reached ? " New work of this type is paused. Nothing will be charged automatically." : ""
      }</p>
<p style="margin:0"><a href="${escapeHtml(url)}" style="color:${GREEN};font-weight:600">See usage and options</a></p>`,
    ),
  };
}

/** Credits running low (or out): top up on a package, upgrade on free. */
export function creditAlertEmail(params: { orgName: string; percent: number; left: number; paid: boolean; url: string }) {
  const { orgName, percent, left, paid, url } = params;
  const out = percent >= 100 || left <= 0;
  const next = paid ? "Add a top-up (lasts 12 months) or wait for your monthly credits to renew." : "Pick a package to keep going: Starter gives 1,100 credits a month.";
  return {
    subject: out ? `${orgName}: you're out of credits` : `${orgName}: ${left.toLocaleString("en-US")} credits left`,
    text: `${orgName} has used ${percent}% of its credits (${left} left). ${next} Nothing is charged automatically. ${url}`,
    html: layout(
      "Credits update",
      `<h1 style="margin:0 0 8px;font-size:22px">${out ? "Out of credits" : `${left.toLocaleString("en-US")} credits left`}</h1>
<p style="margin:0 0 20px;color:#454a44">${escapeHtml(orgName)} has used ${percent}% of its credits. ${escapeHtml(next)} Nothing is charged automatically.</p>
<p style="margin:0"><a href="${escapeHtml(url)}" style="color:${GREEN};font-weight:600">${paid ? "Top up" : "See packages"}</a></p>`,
    ),
  };
}

/** Weekly CEO report email. */
export function weeklyReportEmail(params: { orgName: string; report: WeeklyReport; url: string }) {
  const { orgName, report, url } = params;
  const range = `${fmtDay(report.weekStart)}–${fmtDay(report.weekEnd - 1)}`;
  const delta = (c: number | null) => (c === null || c === 0 ? "" : c > 0 ? ` (+${c.toLocaleString("en-US")})` : ` (${c.toLocaleString("en-US")})`);
  const rows = report.lines.map((l) => `${l.label}: ${l.value.toLocaleString("en-US")}${delta(l.change)}`);
  return {
    subject: `${orgName} this week: ${report.headline.replace(/\.$/, "")}`,
    text: `${report.headline}\n\n${rows.join("\n")}\n\nNext week:\n${report.next.map((n) => `- ${n}`).join("\n")}\n\n${url}`,
    html: layout(
      `Week of ${range}`,
      `<h1 style="margin:0 0 6px;font-size:22px">${escapeHtml(report.headline)}</h1>
<p style="margin:0 0 16px;color:#6b7068;font-size:13px">${escapeHtml(orgName)} · ${escapeHtml(range)}</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px">${report.lines
        .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #ecebe6;color:#454a44">${escapeHtml(l.label)}</td><td style="padding:6px 0;border-bottom:1px solid #ecebe6;text-align:right;font-weight:600">${l.value.toLocaleString("en-US")}<span style="color:${(l.change ?? 0) >= 0 ? GREEN : "#b42318"};font-weight:500">${escapeHtml(delta(l.change))}</span></td></tr>`)
        .join("")}</table>
${report.competitors?.length ? `<p style="margin:0 0 6px;font-weight:600">Competitors</p><ul style="margin:0 0 20px;padding-left:18px;color:#454a44">${report.competitors.map((c) => `<li style="margin-bottom:4px"><strong>${escapeHtml(c.name)}</strong>: ${escapeHtml(c.summary)}</li>`).join("")}</ul>` : ""}
${report.next.length ? `<p style="margin:0 0 6px;font-weight:600">Next week</p><ul style="margin:0 0 20px;padding-left:18px;color:#454a44">${report.next.map((n) => `<li style="margin-bottom:4px">${escapeHtml(n)}</li>`).join("")}</ul>` : ""}
<p style="margin:0"><a href="${escapeHtml(url)}" style="color:${GREEN};font-weight:600">Open the full report</a></p>`,
    ),
  };
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function digestEmail(params: { orgName: string; lines: string[]; url: string; cadence: string }) {
  const { orgName, lines, url, cadence } = params;
  return {
    subject: `${orgName}: your ${cadence} ClimbOS summary`,
    text: `${lines.join("\n")}\n\nOpen ClimbOS: ${url}`,
    html: layout(
      "Your ClimbOS summary",
      `<h1 style="margin:0 0 12px;font-size:22px">Your ${escapeHtml(cadence)} summary</h1>
<ul style="margin:0 0 20px;padding-left:18px;color:#454a44">${lines.map((l) => `<li style="margin-bottom:6px">${escapeHtml(l)}</li>`).join("")}</ul>
<p style="margin:0"><a href="${escapeHtml(url)}" style="color:${GREEN};font-weight:600">Open ClimbOS</a></p>`,
    ),
  };
}

function button(url: string, label: string, primary = true): string {
  return primary
    ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`
    : `<a href="${escapeHtml(url)}" style="display:inline-block;color:${GREEN};text-decoration:underline;padding:10px 4px;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`;
}

/** Safety window: an automatic post is about to go out; one tap stops it. */
export function headsUpEmail(params: { orgName: string; channel: string; when: string; title: string; preview: string; stopUrl: string; openUrl: string }) {
  const p = params;
  return {
    subject: `Going out ${p.when} on ${p.channel}: "${p.title.slice(0, 60)}"`,
    text: `${p.orgName}: autopilot will post this on ${p.channel} ${p.when}.\n\n${p.title}\n${p.preview}\n\nStop it: ${p.stopUrl}\nOpen in ClimbOS: ${p.openUrl}`,
    html: layout(
      "A post is about to go out",
      `<p style="margin:0 0 6px;font-size:13px;color:#59615c">Autopilot · ${escapeHtml(p.channel)} · ${escapeHtml(p.when)}</p>
<h1 style="margin:0 0 10px;font-size:20px">${escapeHtml(p.title)}</h1>
<p style="margin:0 0 20px;color:#434b47;white-space:pre-line">${escapeHtml(p.preview)}</p>
<p style="margin:0 0 8px">${button(p.stopUrl, "Stop this post")} ${button(p.openUrl, "Open in ClimbOS", false)}</p>
<p style="margin:12px 0 0;color:#59615c;font-size:13px">Do nothing and it posts as planned. Stopping sends it back to your review list.</p>`,
    ),
  };
}

/** Daily nudge: drafts waiting for the owner, each with a one-tap approve link. */
export function approvalsEmail(params: { orgName: string; items: { title: string; channel: string; preview: string; approveUrl: string; openUrl: string }[]; allUrl: string }) {
  const p = params;
  const n = p.items.length;
  return {
    subject: `${p.orgName}: ${n} post${n === 1 ? "" : "s"} waiting for your OK`,
    text: `${p.items.map((i) => `${i.channel}: ${i.title}\nApprove: ${i.approveUrl}\nOpen: ${i.openUrl}`).join("\n\n")}\n\nAll drafts: ${p.allUrl}`,
    html: layout(
      "Waiting for your OK",
      `<h1 style="margin:0 0 16px;font-size:20px">${n} post${n === 1 ? "" : "s"} waiting for your OK</h1>
${p.items
  .map(
    (i) => `<div style="border:1px solid #dfe3e0;border-radius:8px;padding:14px;margin:0 0 12px">
<p style="margin:0 0 4px;font-size:13px;color:#59615c">${escapeHtml(i.channel)}</p>
<p style="margin:0 0 6px;font-weight:600">${escapeHtml(i.title)}</p>
<p style="margin:0 0 12px;color:#434b47;font-size:14px">${escapeHtml(i.preview)}</p>
${button(i.approveUrl, "Approve")} ${button(i.openUrl, "Review first", false)}
</div>`,
  )
  .join("")}
<p style="margin:8px 0 0">${button(p.allUrl, "See everything waiting", false)}</p>`,
    ),
  };
}

export function providerDownEmail(params: { provider: string; reason: string; url: string }) {
  const { provider, reason, url } = params;
  return {
    subject: `ClimbOS ops: ${provider} is failing (${reason})`,
    text: `${provider} calls are failing: ${reason}. New AI work pauses and retries every minute. Owners see "AI providers aren't available". Console: ${url}`,
    html: layout(
      "Provider alert",
      `<h1 style="margin:0 0 8px;font-size:22px">${escapeHtml(provider)} is failing</h1>
<p style="margin:0 0 8px;color:#454a44"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p style="margin:0 0 20px;color:#454a44">New AI work pauses and retries every minute. Nothing is charged to customers for failed work.</p>
<p style="margin:0"><a href="${escapeHtml(url)}" style="color:${GREEN};font-weight:600">Open the ops console</a></p>`,
    ),
  };
}

/** Reminder the day before, with a link to cancel or pick another time. */
export function bookingReminderEmail(p: { title: string; when: string; minutes: number; withName: string; manageUrl: string }) {
  return {
    subject: `Tomorrow: ${p.title}, ${p.when}`,
    text: `A reminder: ${p.title}, ${p.when} (${p.minutes} min) with ${p.withName}.\nCan't make it? Cancel or pick another time: ${p.manageUrl}`,
    html: layout(
      "Call reminder",
      `<h1 style="margin:0 0 8px;font-size:22px">See you tomorrow</h1>
<p style="margin:0 0 4px;color:#454a44"><strong>${escapeHtml(p.when)}</strong> · ${p.minutes} min · with ${escapeHtml(p.withName)}</p>
<p style="margin:16px 0 0">${button(p.manageUrl, "Cancel or pick another time")}</p>`,
    ),
  };
}

/** Sent when the owner marks a no-show: friendly, one link to rebook. */
export function noShowEmail(p: { withName: string; rebookUrl: string }) {
  return {
    subject: `Sorry we missed you`,
    text: `Hi, sorry we missed each other today. If you'd still like to talk, pick any time that suits you: ${p.rebookUrl}\n\n${p.withName}`,
    html: layout(
      "Missed call",
      `<h1 style="margin:0 0 8px;font-size:22px">Sorry we missed you</h1>
<p style="margin:0 0 16px;color:#454a44">If you'd still like to talk, pick any time that suits you.</p>
<p style="margin:0">${button(p.rebookUrl, "Pick a new time")}</p>
<p style="margin:16px 0 0;color:#6b7068;font-size:13px">${escapeHtml(p.withName)}</p>`,
    ),
  };
}

/** Sent to the guest when the owner cancels their call: one link to pick another time. */
export function bookingCancelledEmail(p: { title: string; when: string; withName: string; rebookUrl: string }) {
  return {
    subject: `Cancelled: ${p.title}, ${p.when}`,
    text: `${p.withName} had to cancel your call (${p.when}). Sorry about that. Pick another time: ${p.rebookUrl}`,
    html: layout(
      "Call cancelled",
      `<h1 style="margin:0 0 8px;font-size:22px">Your call was cancelled</h1>
<p style="margin:0 0 16px;color:#454a44">${escapeHtml(p.withName)} had to cancel <strong>${escapeHtml(p.when)}</strong>. Sorry about that.</p>
<p style="margin:0">${button(p.rebookUrl, "Pick another time")}</p>`,
    ),
  };
}

export function bookingEmail(params: { title: string; when: string; minutes: number; withName: string; startAt: number; endAt: number; note: string | null; manageUrl?: string }) {
  const { title, when, minutes, withName, startAt, endAt, note, manageUrl } = params;
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(startAt)}/${fmt(endAt)}&details=${encodeURIComponent(`Call with ${withName}`)}`;
  return {
    subject: `Confirmed: ${title}, ${when}`,
    text: `${title}\n${when} (${minutes} min) with ${withName}.${note ? `\nNote: ${note}` : ""}\nAdd to Google Calendar: ${gcal}${manageUrl ? `\nCancel or pick another time: ${manageUrl}` : ""}`,
    html: layout(
      "Call confirmed",
      `<h1 style="margin:0 0 8px;font-size:22px">${escapeHtml(title)}</h1>
<p style="margin:0 0 4px;color:#454a44"><strong>${escapeHtml(when)}</strong> · ${minutes} min · with ${escapeHtml(withName)}</p>
${note ? `<p style="margin:0 0 12px;color:#454a44">Note: ${escapeHtml(note)}</p>` : ""}
<p style="margin:16px 0 0">${button(gcal, "Add to Google Calendar")}</p>
${manageUrl ? `<p style="margin:12px 0 0;font-size:13px"><a href="${escapeHtml(manageUrl)}" style="color:#6b7068">Cancel or pick another time</a></p>` : ""}`,
    ),
  };
}
