/*
 * Plain filtering helpers shared by the filter components. No React here, so
 * the same logic can run on the server or inside a Convex query later.
 */

export type FieldType = "text" | "number" | "select" | "date";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterFieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: FilterOption[];
}

export type Operator = "contains" | "not_contains" | "is" | "is_not" | "gt" | "lt" | "before" | "after" | "is_empty" | "is_not_empty";

export const OPERATORS: Record<FieldType, { value: Operator; label: string }[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
    { value: "is", label: "is" },
    { value: "is_empty", label: "is empty" },
  ],
  number: [
    { value: "gt", label: "more than" },
    { value: "lt", label: "less than" },
    { value: "is", label: "equals" },
  ],
  select: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is set" },
  ],
  date: [
    { value: "after", label: "after" },
    { value: "before", label: "before" },
    { value: "is", label: "on" },
  ],
};

export const needsValue = (op: Operator) => op !== "is_empty" && op !== "is_not_empty";

export interface Condition {
  id: string;
  field: string;
  op: Operator;
  value: string;
}

export type Match = "and" | "or";

export function testCondition(raw: unknown, c: Condition): boolean {
  const empty = raw === null || raw === undefined || raw === "";
  if (c.op === "is_empty") return empty;
  if (c.op === "is_not_empty") return !empty;
  if (!c.value) return true; // unfinished rows don't filter
  const s = String(raw ?? "").toLowerCase();
  const v = c.value.toLowerCase();
  switch (c.op) {
    case "contains":
      return s.includes(v);
    case "not_contains":
      return !s.includes(v);
    case "is":
      return s === v;
    case "is_not":
      return s !== v;
    case "gt":
      return Number(raw) > Number(c.value);
    case "lt":
      return Number(raw) < Number(c.value);
    case "after":
      return s > v;
    case "before":
      return s < v;
    default:
      return true;
  }
}

export function applyConditions<T>(rows: T[], conditions: Condition[], match: Match, get: (row: T, key: string) => unknown): T[] {
  if (!conditions.length) return rows;
  return rows.filter((r) => (match === "and" ? conditions.every((c) => testCondition(get(r, c.field), c)) : conditions.some((c) => testCondition(get(r, c.field), c))));
}

/** Every word of `q` appears somewhere in `text` (case-insensitive). */
export function matchesQuery(text: string, q: string): boolean {
  const t = text.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}

export interface AdvancedQuery {
  all: string;
  exact: string;
  any: string;
  none: string;
  /** Field key to search in, or "any". */
  field: string;
}

export const EMPTY_ADVANCED: AdvancedQuery = { all: "", exact: "", any: "", none: "", field: "any" };

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

export function matchesAdvanced(text: string, a: AdvancedQuery): boolean {
  const t = text.toLowerCase();
  if (!words(a.all).every((w) => t.includes(w))) return false;
  if (a.exact.trim() && !t.includes(a.exact.trim().toLowerCase())) return false;
  const any = words(a.any);
  if (any.length && !any.some((w) => t.includes(w))) return false;
  if (words(a.none).some((w) => t.includes(w))) return false;
  return true;
}

/** Search-box syntax for an advanced query: `plumber "same day" (boiler OR leak) -commercial`. */
export function advancedToString(a: AdvancedQuery, fieldLabel?: string): string {
  const parts: string[] = [];
  if (a.all.trim()) parts.push(a.all.trim());
  if (a.exact.trim()) parts.push(`"${a.exact.trim()}"`);
  const any = words(a.any);
  if (any.length) parts.push(any.length > 1 ? `(${any.join(" OR ")})` : any[0]);
  words(a.none).forEach((w) => parts.push(`-${w}`));
  const q = parts.join(" ");
  return fieldLabel && a.field !== "any" && q ? `${fieldLabel.toLowerCase()}:${q}` : q;
}

export type SortDir = "asc" | "desc";

export function sortRows<T>(rows: T[], dir: SortDir, get: (row: T) => string | number): T[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * m;
  });
}

export function groupRows<T>(rows: T[], key: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const k = key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  });
  return [...map.entries()];
}

/* Dates: plain "YYYY-MM-DD" strings in UTC so server and client agree. */

export type DatePreset = "any" | "today" | "7d" | "30d" | "month" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

export interface DateRange {
  preset: DatePreset;
  from: string;
  to: string;
}

export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: DatePreset, today: string): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: shiftIso(today, -6), to: today };
    case "30d":
      return { from: shiftIso(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    default:
      return { from: "", to: "" };
  }
}

export function inRange(iso: string, r: DateRange): boolean {
  if (r.from && iso < r.from) return false;
  if (r.to && iso > r.to) return false;
  return true;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "3 Oct" from "2026-10-03" without locale/timezone drift. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
