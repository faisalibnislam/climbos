/**
 * Daily time-series primitives.
 *
 * Dates are calendar days ("YYYY-MM-DD") already expressed in the business
 * timezone. Day arithmetic is done on the calendar (UTC-anchored) so it is
 * unaffected by DST or the host timezone.
 */

export interface DailyPoint {
  /** Calendar day in the business timezone, "YYYY-MM-DD". */
  date: string;
  value: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True when `date` is a real calendar day in "YYYY-MM-DD" form. */
export function isValidDateString(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" string. Throws on malformed input. */
export function dateToDayNumber(date: string): number {
  if (!isValidDateString(date)) throw new RangeError(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  const m = DATE_RE.exec(date) as RegExpExecArray;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

/** Inverse of {@link dateToDayNumber}. */
export function dayNumberToDate(day: number): string {
  const d = new Date(day * MS_PER_DAY);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const da = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Calendar day `n` days after `date` (n may be negative). */
export function addDays(date: string, n: number): string {
  return dayNumberToDate(dateToDayNumber(date) + n);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return dateToDayNumber(to) - dateToDayNumber(from);
}

/** Returns a new array sorted ascending by date. Does not mutate the input. */
export function sortSeries(series: readonly DailyPoint[]): DailyPoint[] {
  return [...series].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface SeriesValidation {
  ok: boolean;
  issues: string[];
}

/**
 * Checks dates are well-formed and unique and values are finite numbers.
 * Order is not required (use {@link sortSeries}); gaps are not errors here
 * (use {@link findMissingDates}).
 */
export function validateSeries(series: readonly DailyPoint[]): SeriesValidation {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const p of series) {
    if (!isValidDateString(p.date)) issues.push(`Invalid date "${p.date}"`);
    else if (seen.has(p.date)) issues.push(`Duplicate date ${p.date}`);
    seen.add(p.date);
    if (typeof p.value !== "number" || !Number.isFinite(p.value)) {
      issues.push(`Non-finite value on ${p.date}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Thrown when a series fails validation or contiguity requirements. */
export class SeriesValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid series: ${issues.slice(0, 5).join("; ")}${issues.length > 5 ? ` (+${issues.length - 5} more)` : ""}`);
    this.name = "SeriesValidationError";
    this.issues = issues;
  }
}

/** Validates then sorts; throws {@link SeriesValidationError} on any issue. */
export function assertValidSeries(series: readonly DailyPoint[]): DailyPoint[] {
  const v = validateSeries(series);
  if (!v.ok) throw new SeriesValidationError(v.issues);
  return sortSeries(series);
}

/** Calendar days between the first and last observation that have no point. */
export function findMissingDates(series: readonly DailyPoint[]): string[] {
  const sorted = sortSeries(series);
  const missing: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = dateToDayNumber(sorted[i - 1].date);
    const cur = dateToDayNumber(sorted[i].date);
    for (let d = prev + 1; d < cur; d++) missing.push(dayNumberToDate(d));
  }
  return missing;
}

export type FillMode =
  /** Report gaps only; never invent values. */
  | "report_only"
  /** Insert 0 for missing days. Only valid for count metrics where "no record" truly means zero. */
  | "zero_fill_known_count";

export interface FillResult {
  series: DailyPoint[];
  missingDates: string[];
  filled: boolean;
}

/**
 * Makes gaps explicit. By default (`report_only`) the series is returned
 * sorted and unchanged alongside the list of missing dates. Zero-filling must
 * be requested explicitly and is only appropriate for counts with known-zero
 * semantics (e.g. orders per day from a complete ledger) — never for rates,
 * revenue from a possibly-broken source, or gauges.
 */
export function fillMissingDays(series: readonly DailyPoint[], mode: FillMode = "report_only"): FillResult {
  const sorted = assertValidSeries(series);
  const missingDates = findMissingDates(sorted);
  if (mode === "report_only" || missingDates.length === 0) {
    return { series: sorted, missingDates, filled: false };
  }
  const filled = sortSeries([...sorted, ...missingDates.map((date) => ({ date, value: 0 }))]);
  return { series: filled, missingDates, filled: true };
}

/** Throws unless the (sorted) series has exactly one point per calendar day. */
export function assertContiguous(series: readonly DailyPoint[]): void {
  const missing = findMissingDates(series);
  if (missing.length > 0) {
    throw new SeriesValidationError([
      `Series has ${missing.length} missing day(s) (first: ${missing[0]}). Call fillMissingDays explicitly before forecasting.`,
    ]);
  }
}

export interface ChronologicalSplit {
  train: DailyPoint[];
  test: DailyPoint[];
}

/**
 * Splits a series in time order: `train` holds dates strictly before
 * `splitDate`, `test` holds dates on or after it. No shuffling, ever.
 */
export function splitChronological(series: readonly DailyPoint[], splitDate: string): ChronologicalSplit {
  if (!isValidDateString(splitDate)) throw new RangeError(`Invalid split date "${splitDate}"`);
  const sorted = sortSeries(series);
  const train = sorted.filter((p) => p.date < splitDate);
  const test = sorted.filter((p) => p.date >= splitDate);
  assertNoLeakage(train, test.length > 0 ? test[0].date : splitDate);
  return { train, test };
}

/** Splits so that the last `testDays` points form the test set. */
export function splitLastN(series: readonly DailyPoint[], testDays: number): ChronologicalSplit {
  const sorted = sortSeries(series);
  const cut = Math.max(0, sorted.length - Math.max(0, Math.floor(testDays)));
  return { train: sorted.slice(0, cut), test: sorted.slice(cut) };
}

/** Thrown when training data overlaps the evaluation window. */
export class LeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeakageError";
  }
}

/**
 * Leakage guard: throws {@link LeakageError} if ANY training date is on or
 * after the first evaluation date. Called internally by the backtester for
 * every origin; exported so callers can guard their own splits.
 */
export function assertNoLeakage(train: readonly DailyPoint[], firstEvalDate: string): void {
  for (const p of train) {
    if (p.date >= firstEvalDate) {
      throw new LeakageError(`Training data includes ${p.date}, which is not strictly before evaluation start ${firstEvalDate}`);
    }
  }
}
