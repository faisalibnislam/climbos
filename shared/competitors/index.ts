/** Competitor watch: normalise page text and find what changed between checks. */

/** Drop volatile noise (years, dates, counters, cookie banners) so only real changes count. */
export function normaliseForDiff(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) =>
      l
        // Query-only analytics parameters create artificial diffs without changing the page.
        .replace(/[?&](?:utm_[a-z_]+|gclid|fbclid|mc_[ce]id)=[^&\s)\]]*/gi, "")
        .replace(/\s+/g, " ")
        .replace(/\b(19|20)\d{2}\b/g, "YEAR")
        .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, "DATE")
        .replace(/\b\d{1,3}(,\d{3})+\+?\b/g, "N")
        .trim(),
    )
    .filter((l) =>
      l.length >= 3 &&
      !/cookie|consent|privacy preferences|accept all/i.test(l) &&
      !/^(?:home|menu|main menu|navigation|skip to content|skip navigation|search|log in|login|sign in|sign up|register|account|cart|basket|back to top|all rights reserved)$/i.test(l),
    )
    .slice(0, 800);
}

export interface PageDiff {
  added: string[];
  removed: string[];
}

/** True only when a proposed test points to one exact line retained in the page diff. */
export function isObservedChangeQuote(
  quote: string | null | undefined,
  evidence: PageDiff | undefined,
): boolean {
  const normalizedQuote = quote?.trim() ?? "";
  if (!normalizedQuote || normalizedQuote.length > 300 || !evidence) return false;
  return [...evidence.added, ...evidence.removed].some((line) => line.slice(0, 300) === normalizedQuote);
}

export function diffLines(before: string[], after: string[]): PageDiff {
  const b = new Set(before);
  const a = new Set(after);
  return { added: after.filter((l) => !b.has(l)).slice(0, 60), removed: before.filter((l) => !a.has(l)).slice(0, 60) };
}

/** Worth a summary: a few lines changed, or anything that looks like a price. */
export function meaningful(d: PageDiff): boolean {
  const lines = [...d.added, ...d.removed];
  if (lines.some((l) => /[$€£¥]\s?\d|\d\s?(usd|eur|gbp)|\/mo|per month|pricing|free trial/i.test(l))) return true;
  return lines.filter((l) => l.length > 20).length >= 3;
}

export async function textHash(lines: string[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(lines.join("\n")));
  return Array.from(new Uint8Array(buf).slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
}
