import { parseCruxPerformance, parseLighthousePerformance } from "../../shared/site/performance";
import { validateResearchUrl } from "../../shared/integrations/website";

const METRICS = ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"];
const MAX_RESPONSE_CHARS = 2_000_000;
const TIMEOUT_MS = 25_000;

async function readJson(url: URL, init?: RequestInit): Promise<{ ok: boolean; data: unknown; status: number }> {
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { ok: false, data: null, status: response.status };
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARS) return { ok: false, data: null, status: response.status };
    return { ok: true, data: JSON.parse(body) as unknown, status: response.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

/** One page, one mobile lab run, and (when configured) one mobile real-user CrUX lookup. */
export async function measureSitePerformance(pageUrl: string) {
  const checked = validateResearchUrl(pageUrl);
  const now = Date.now();
  if (!checked.ok) {
    return { pageUrl: null, checkedAt: now, fieldData: { status: "unavailable" as const, reason: "The inspected page URL is not eligible for measurement." }, labData: { status: "unavailable" as const, reason: "The inspected page URL is not eligible for measurement." } };
  }
  const canonicalUrl = checked.url;
  const pagespeedUrl = new URL("https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed");
  pagespeedUrl.searchParams.set("url", canonicalUrl);
  pagespeedUrl.searchParams.set("strategy", "mobile");
  pagespeedUrl.searchParams.set("category", "performance");
  pagespeedUrl.searchParams.set("locale", "en");
  if (process.env.GOOGLE_PAGESPEED_API_KEY) pagespeedUrl.searchParams.set("key", process.env.GOOGLE_PAGESPEED_API_KEY);

  const cruxKey = process.env.GOOGLE_CRUX_API_KEY;
  const cruxUrl = new URL("https://chromeuxreport.googleapis.com/v1/records:queryRecord");
  if (cruxKey) cruxUrl.searchParams.set("key", cruxKey);

  const [lab, field] = await Promise.all([
    readJson(pagespeedUrl),
    cruxKey
      ? readJson(cruxUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ url: canonicalUrl, formFactor: "PHONE", metrics: METRICS }),
        })
      : Promise.resolve({ ok: false, data: null, status: 0 }),
  ]);

  const parsedLab = lab.ok ? parseLighthousePerformance(lab.data, canonicalUrl, now) : null;
  const parsedField = field.ok ? parseCruxPerformance(field.data, now) : null;
  return {
    pageUrl: canonicalUrl,
    checkedAt: now,
    fieldData: parsedField ?? (cruxKey && field.status === 404
      ? { status: "no_data" as const, formFactor: "PHONE" as const, recordUrl: canonicalUrl, collectionPeriod: null, fetchedAt: now, metrics: [] }
      : { status: cruxKey ? "unavailable" as const : "not_configured" as const, formFactor: "PHONE" as const, recordUrl: null, collectionPeriod: null, fetchedAt: now, metrics: [] }),
    labData: parsedLab ?? { status: "unavailable" as const, strategy: "mobile" as const, requestedUrl: canonicalUrl, finalUrl: null, fetchedAt: now, score: null, metrics: [], opportunities: [] },
  };
}
