import { zonedTime } from "../autopilot";

/** These are separate observations, never interchangeable stages or a combined score. */
export const POST_RESULT_FIELDS = [
  ["qualifiedVisits", "Qualified visits"], ["signups", "Signups"], ["payingCustomers", "Paying customers"],
  ["activatedCustomers", "Activated customers"], ["retainedCustomers", "Retained customers"],
  ["customerQuestionsAnswered", "Customer questions answered"], ["operatingMinutes", "Operating time (minutes)"],
  ["impressions", "Impressions"], ["reach", "Reach"], ["likes", "Likes"], ["comments", "Comments"],
  ["shares", "Shares"], ["saves", "Saves"], ["clicks", "Link clicks"],
] as const;
export type PostResultKey = typeof POST_RESULT_FIELDS[number][0];
export type PostResultValues = Partial<Record<PostResultKey, number>>;
export type PostResultRecord = PostResultValues & {
  source: "owner" | "platform" | "fixture"; capturedAt: number;
  artifactVersionId?: string; artifactVersionNumber?: number; contentHash?: string; fromDate?: string; toDate?: string; timeZone?: string;
  periodStart?: number; periodEnd?: number; measurementNote?: string;
};

/** Completed local dates, inclusive in the UI and exclusive at the upper timestamp. */
export function postResultWindow(from: string, to: string, timeZone: string, now: number) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose valid completed dates.");
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error("Choose valid completed dates.");
    return value.split("-").map(Number);
  };
  const [fy, fm, fd] = parse(from), [ty, tm, td] = parse(to);
  // Intl rejects invalid timezones; no browser or currency fallback.
  new Intl.DateTimeFormat("en", { timeZone }).format(now);
  const next = new Date(Date.UTC(ty, tm - 1, td + 1));
  const periodStart = zonedTime(fy, fm - 1, fd, 0, 0, timeZone);
  const periodEnd = zonedTime(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 0, 0, timeZone);
  if (![now, periodStart, periodEnd].every(Number.isFinite) || from > to || periodEnd <= periodStart || periodEnd > now || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1 > 366) throw new Error("Use completed dates covering at most 366 days.");
  return { periodStart, periodEnd };
}

export function postResultValueIssue(values: PostResultValues): string | null {
  for (const [key, label] of POST_RESULT_FIELDS) {
    const value = values[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) return `${label} must be a nonnegative whole number; leave it blank if unknown.`;
  }
  return null;
}

/** Legacy observations without version/window identity remain visible, but cannot support a new plan. */
export function postResultEvidenceIssue(report: PostResultRecord, version: { id: string; contentHash: string; createdAt: number } | null, now: number, demo: boolean): string | null {
  if (report.source === "fixture" && !demo) return "Synthetic data is not business evidence.";
  if (!version || report.artifactVersionId !== version.id || report.contentHash !== version.contentHash) return "The report is not bound to this exact content version.";
  if (!Number.isFinite(report.capturedAt) || report.capturedAt > now || report.capturedAt < version.createdAt) return "The report capture time is invalid or conflicts with the content version.";
  if (!report.fromDate || !report.toDate || !report.timeZone || !report.measurementNote?.trim()) return "The measurement window or method is unknown.";
  try {
    const bounds = postResultWindow(report.fromDate, report.toDate, report.timeZone, report.capturedAt);
    if (bounds.periodStart !== report.periodStart || bounds.periodEnd !== report.periodEnd || bounds.periodEnd <= version.createdAt) return "The measurement dates conflict with the saved window or content version.";
  } catch { return "The measurement dates are invalid or incomplete."; }
  return postResultValueIssue(report);
}

export function postResultBrief(report: PostResultRecord | null, issue: string | null): string {
  if (issue) return `Latest post report not used: ${issue} Outcomes remain unknown; earlier reports are not substituted.`;
  if (!report) return "Post outcomes unknown: no report recorded.";
  const values = POST_RESULT_FIELDS.map(([key, label]) => `${label}: ${report[key] === undefined ? "unknown" : report[key]}`).join("; ");
  return `${report.source === "owner" ? "MEMBER-REPORTED" : report.source === "fixture" ? "SYNTHETIC DEMO" : "PLATFORM-REPORTED"} post observations, ${report.fromDate} through ${report.toDate} (${report.timeZone}), captured ${new Date(report.capturedAt).toISOString()}. ${values}. Method and qualification definition (reported, unverified): ${report.measurementNote}. These are one reported window, not independent verification, unique cross-platform totals or causal lift. Impressions and interactions are not customers or revenue; compare only compatible definitions and windows.`;
}
