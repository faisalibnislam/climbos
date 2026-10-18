/**
 * Engine Lab privacy: reviewer feedback from many workspaces is scrubbed of
 * anything that could identify a business before it reaches a model or staff.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Removes links, emails, handles, sites, phone numbers, the business's names and (unless kept) figures. */
export function redactFeedback(text: string, names: (string | undefined | null)[], opts: { keepNumbers?: boolean } = {}): string {
  let out = text
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]")
    .replace(/(^|\s)@\w{2,}/g, "$1[handle]")
    .replace(/\b(?:[a-z0-9-]{2,}\.)+[a-z]{2,6}\b/gi, "[site]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
  for (const n of names) {
    const name = n?.trim();
    if (!name || name.length < 3) continue;
    const host = name.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
    for (const s of new Set([name, host, host.split(".")[0]])) if (s.length >= 3) out = out.replace(new RegExp(`\\b${escapeRe(s)}\\b`, "gi"), "[business]");
  }
  if (!opts.keepNumbers) out = out.replace(/[$£€]?\d[\d,.]*(?:\s?%)?(?:[km]\b)?/gi, "N");
  return out.slice(0, 400);
}
