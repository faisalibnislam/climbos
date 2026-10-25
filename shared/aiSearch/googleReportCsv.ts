import { parseCsv } from "../integrations/csvRevenue";

export type GoogleAiReportDimension = "page" | "date" | "country" | "device";
export type GoogleAiReportRow = { dimensionValue: string; impressions: number };
export type GoogleAiReportParse = { ok: true; dimension: GoogleAiReportDimension; rows: GoogleAiReportRow[] } | { ok: false; error: string };

const DIMENSION_HEADERS: Record<GoogleAiReportDimension, string[]> = {
  page: ["page", "pages", "top pages", "url"],
  date: ["date", "day", "week", "month"],
  country: ["country", "countries"],
  device: ["device", "devices"],
};

function headerKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

/** Parse one English Google Search Console Generative AI table export. */
export function parseGoogleAiReportCsv(csv: string, maxRows = 1_000): GoogleAiReportParse {
  if (csv.length > 2_000_000) return { ok: false, error: "The CSV is over 2 MB. Export a smaller date range." };
  const parsed = parseCsv(csv, maxRows + 1);
  if (!parsed.ok) return { ok: false, error: `CSV could not be read on line ${parsed.line}: ${parsed.error}.` };
  const [header, ...records] = parsed.records;
  if (!header || !records.length) return { ok: false, error: "The CSV needs a header row and at least one data row." };
  if (records.length > maxRows) return { ok: false, error: `The CSV has more than ${maxRows.toLocaleString()} rows. Export a smaller date range.` };
  const keys = header.map(headerKey);
  const impressionIndex = keys.findIndex((value) => ["impressions", "ai impressions", "generative ai impressions"].includes(value));
  if (impressionIndex < 0) return { ok: false, error: "Could not find an Impressions column. Export the table data from Google’s Generative AI performance report." };
  const candidates = (Object.entries(DIMENSION_HEADERS) as [GoogleAiReportDimension, string[]][])
    .map(([dimension, headers]) => ({ dimension, index: keys.findIndex((value) => headers.includes(value)) }))
    .filter((item) => item.index >= 0);
  if (candidates.length !== 1) return { ok: false, error: "Use a single-dimension table export: Pages, Dates, Countries, or Devices." };
  const { dimension, index } = candidates[0]!;
  const rows: GoogleAiReportRow[] = [];
  const merged = new Map<string, number>();
  for (const record of records) {
    const dimensionValue = record[index]?.trim() ?? "";
    const raw = record[impressionIndex]?.trim() ?? "";
    if (!dimensionValue || !raw) continue;
    const normalized = raw === "-" || raw === "~" ? 0 : Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(normalized) || normalized < 0) return { ok: false, error: `Invalid impressions value for “${dimensionValue.slice(0, 80)}”.` };
    if (dimension === "page") {
      try {
        const url = new URL(dimensionValue);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return { ok: false, error: "Page rows must contain public HTTP or HTTPS URLs without credentials." };
      } catch { return { ok: false, error: `Invalid page URL: “${dimensionValue.slice(0, 80)}”.` }; }
    }
    if (dimension === "date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dimensionValue);
      if (!match || new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toISOString().slice(0, 10) !== dimensionValue) return { ok: false, error: "Date rows must use a valid YYYY-MM-DD date." };
    }
    const key = dimension === "page" ? new URL(dimensionValue).toString() : dimensionValue;
    merged.set(key, (merged.get(key) ?? 0) + normalized);
  }
  for (const [dimensionValue, impressions] of merged) rows.push({ dimensionValue, impressions });
  if (!rows.length) return { ok: false, error: "No usable dimension and impressions rows were found." };
  return { ok: true, dimension, rows };
}
