/**
 * Plain, accessible transactional email templates for ClimbOS platform mail.
 * Inline styles only; every email has a text alternative.
 */

const GREEN = "#14532d";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(
    title,
  )}</title></head><body style="margin:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1f1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e6e2d8;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
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
