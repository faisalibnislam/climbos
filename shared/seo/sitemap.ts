/** Parse bounded <loc> values from a sitemap document; never treats them as trusted fetch targets. */
export function parseSitemapLocations(xml: string, baseUrl: string, limit = 500): string[] {
  const maxEntries = Math.max(0, Math.min(Math.floor(limit), 2_000));
  if (maxEntries === 0) return [];
  const source = xml.slice(0, 1_000_000);
  const out: string[] = [];
  const seen = new Set<string>();
  const decodeXml = (value: string) => value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  const loc = /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi;
  let match: RegExpExecArray | null;
  while (out.length < maxEntries && (match = loc.exec(source)) !== null) {
    const raw = decodeXml((match[1] ?? "").replace(/<[^>]*>/g, "").trim());
    if (!raw || raw.length > 2_048) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      const normalized = url.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    } catch {
      // Ignore malformed sitemap locations.
    }
  }
  return out;
}
