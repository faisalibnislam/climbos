export type RegistrySource = {
  url: string;
  retrieved_at: string;
  records: { verification_status: string }[];
};

export type SourceFreshness = {
  status: "checked_recently" | "recheck_due" | "direct_check_required" | "not_scheduled" | "invalid_check_date";
  checkedAt: string | null;
  nextCheckAt: string | null;
  cadenceDays: number | null;
  directPageRead: boolean;
};

/** Platform/API/legal guidance is checked weekly by default; this is a review cadence, not a freshness guarantee. */
const WEEKLY_REVIEW_HOSTS = [
  "docs.convex.dev",
  "resend.com",
  "vercel.com",
  "developers.openai.com",
  "developers.google.com",
  "support.google.com",
  "developer.apple.com",
  "developer.android.com",
  "learn.microsoft.com",
  "developers.facebook.com",
  "facebook.com",
  "ftc.gov",
  "senders.yahooinc.com",
];

const INDEX_ONLY = new Set(["primary_search_index_only", "verified_official_search_content"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isScheduledReview(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return WEEKLY_REVIEW_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Derive a review state from registry evidence. A recent retrieval is never
 * described as proof that the source content itself is current.
 */
export function sourceFreshness(source: RegistrySource, now = Date.now()): SourceFreshness {
  const checked = Date.parse(`${source.retrieved_at}T00:00:00.000Z`);
  if (!Number.isFinite(checked)) return { status: "invalid_check_date", checkedAt: null, nextCheckAt: null, cadenceDays: null, directPageRead: false };
  const checkedAt = new Date(checked).toISOString();
  const directPageRead = source.records.some((record) => !INDEX_ONLY.has(record.verification_status));
  if (!directPageRead) return { status: "direct_check_required", checkedAt, nextCheckAt: null, cadenceDays: null, directPageRead: false };
  if (!isScheduledReview(source.url)) return { status: "not_scheduled", checkedAt, nextCheckAt: null, cadenceDays: null, directPageRead: true };
  const next = checked + WEEK_MS;
  return {
    status: now >= next ? "recheck_due" : "checked_recently",
    checkedAt,
    nextCheckAt: new Date(next).toISOString(),
    cadenceDays: 7,
    directPageRead: true,
  };
}
