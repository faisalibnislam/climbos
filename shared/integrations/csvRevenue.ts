/**
 * Revenue CSV import: RFC 4180 parsing, per-row validation, currency-aware
 * decimal → minor-unit conversion, duplicate event_id detection and row caps.
 *
 * Columns: event_id, occurred_at, customer_id, order_id, currency, amount,
 * refunded_amount, utm_source, utm_medium, utm_campaign.
 * Required: event_id, occurred_at, currency, amount. A file over the row limit
 * is rejected as a whole (no partial imports).
 */

import { decimalToMinor, isValidCurrencyCode } from "./currency";
import type { ImportedRevenueEvent } from "./types";

export const CSV_DEFAULT_MAX_ROWS = 50_000;
export const CSV_COLUMNS = [
  "event_id",
  "occurred_at",
  "customer_id",
  "order_id",
  "currency",
  "amount",
  "refunded_amount",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;
export const CSV_REQUIRED_COLUMNS = ["event_id", "occurred_at", "currency", "amount"] as const;

export type CsvParse = { ok: true; records: string[][] } | { ok: false; error: string; line: number };

/** RFC 4180 parser (quoted fields, "" escapes, CRLF/LF, embedded newlines). */
export function parseCsv(text: string, maxRecords = Number.POSITIVE_INFINITY): CsvParse {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false; // field had any content or quotes
  let quotedField = false;
  let line = 1;
  let i = 0;
  const pushField = (): void => {
    row.push(field);
    field = "";
    fieldStarted = false;
    quotedField = false;
  };
  const pushRow = (): boolean => {
    pushField();
    if (!(row.length === 1 && row[0] === "")) records.push(row); // skip blank lines
    row = [];
    return records.length <= maxRecords;
  };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        const next = src[i];
        if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") {
          return { ok: false, error: "Unexpected character after closing quote", line };
        }
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (fieldStarted) return { ok: false, error: "Quote inside an unquoted field (wrap the field in quotes and double inner quotes)", line };
      inQuotes = true;
      quotedField = true;
      fieldStarted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      i++;
      if (!pushRow()) return { ok: true, records };
      line++;
      continue;
    }
    field += ch;
    fieldStarted = true;
    i++;
  }
  if (inQuotes) return { ok: false, error: "Unterminated quoted field", line };
  if (field !== "" || row.length > 0 || quotedField) pushRow();
  return { ok: true, records };
}

export interface CsvRowError {
  /** 1-based data row number (header = row 0). */
  row: number;
  column?: string;
  message: string;
}

export interface CsvRevenueRow {
  row: number;
  event: ImportedRevenueEvent;
  utm: { source?: string; medium?: string; campaign?: string };
}

export interface CsvRevenueResult {
  ok: boolean;
  rows: CsvRevenueRow[];
  errors: CsvRowError[];
  duplicateEventIds: string[];
  /** File-level problem (missing columns, too many rows, malformed CSV). */
  fatal?: string;
  totalDataRows: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2}))?$/;

export function parseIsoTimestamp(value: string): number | undefined {
  const v = value.trim();
  const m = ISO_RE.exec(v);
  if (!m) return undefined;
  const [, y, mo, d, hh] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const ms = Date.parse(hh === undefined ? `${y}-${mo}-${d}T00:00:00Z` : v);
  if (Number.isNaN(ms)) return undefined;
  // Reject rollovers like 2025-02-30.
  const check = new Date(Date.UTC(Number(y), month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;
  return ms;
}

export function parseRevenueCsv(
  text: string,
  options: { maxRows?: number; source?: string; maxBytes?: number } = {},
): CsvRevenueResult {
  const maxRows = options.maxRows ?? CSV_DEFAULT_MAX_ROWS;
  const source = options.source ?? "csv";
  const empty = (fatal: string, totalDataRows = 0): CsvRevenueResult => ({ ok: false, rows: [], errors: [], duplicateEventIds: [], fatal, totalDataRows });
  if (text.length > (options.maxBytes ?? 50_000_000)) return empty("File is too large.");

  const parsed = parseCsv(text, maxRows + 1); // header + maxRows
  if (!parsed.ok) return empty(`CSV is malformed at line ${parsed.line}: ${parsed.error}`);
  const [header, ...data] = parsed.records;
  if (!header) return empty("File is empty.");
  if (data.length > maxRows) return empty(`File has more than ${String(maxRows).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} rows. Split it into smaller files.`, data.length);

  const cols = header.map((h) => h.trim().toLowerCase());
  const missing = CSV_REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length) return empty(`Missing required column(s): ${missing.join(", ")}.`);
  const dupCols = cols.filter((c, i) => c && cols.indexOf(c) !== i);
  if (dupCols.length) return empty(`Duplicate column(s): ${[...new Set(dupCols)].join(", ")}.`);
  const idx = (name: string): number => cols.indexOf(name);

  const rows: CsvRevenueRow[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  data.forEach((rec, i) => {
    const rowNum = i + 1;
    const get = (name: string): string => {
      const j = idx(name);
      return j >= 0 ? (rec[j] ?? "").trim() : "";
    };
    const rowErrors: CsvRowError[] = [];
    if (rec.length !== header.length) rowErrors.push({ row: rowNum, message: `Expected ${header.length} fields, found ${rec.length}.` });

    const eventId = get("event_id");
    if (!eventId) rowErrors.push({ row: rowNum, column: "event_id", message: "event_id is required." });
    else if (eventId.length > 200) rowErrors.push({ row: rowNum, column: "event_id", message: "event_id is too long." });

    const occurredRaw = get("occurred_at");
    const occurredAt = parseIsoTimestamp(occurredRaw);
    if (occurredAt === undefined) {
      rowErrors.push({ row: rowNum, column: "occurred_at", message: `"${occurredRaw}" is not an ISO 8601 date or date-time with a time zone (e.g. 2026-10-17T14:30:00Z).` });
    }

    const currency = get("currency").toUpperCase();
    const currencyOk = isValidCurrencyCode(currency);
    if (!currencyOk) rowErrors.push({ row: rowNum, column: "currency", message: `"${get("currency")}" is not a 3-letter currency code.` });

    let amountMinor = 0;
    let refundedMinor = 0;
    if (currencyOk) {
      const amt = decimalToMinor(get("amount"), currency);
      if (!amt.ok) rowErrors.push({ row: rowNum, column: "amount", message: amt.error });
      else if (amt.minor < 0) rowErrors.push({ row: rowNum, column: "amount", message: "amount cannot be negative; use refunded_amount for refunds." });
      else amountMinor = amt.minor;
      const refRaw = get("refunded_amount");
      if (refRaw) {
        const ref = decimalToMinor(refRaw, currency);
        if (!ref.ok) rowErrors.push({ row: rowNum, column: "refunded_amount", message: ref.error });
        else if (ref.minor < 0) rowErrors.push({ row: rowNum, column: "refunded_amount", message: "refunded_amount cannot be negative." });
        else if (amt.ok && amt.minor >= 0 && ref.minor > amt.minor) rowErrors.push({ row: rowNum, column: "refunded_amount", message: "refunded_amount is larger than amount." });
        else refundedMinor = ref.minor;
      }
    }

    if (eventId) {
      if (seen.has(eventId)) {
        duplicates.add(eventId);
        rowErrors.push({ row: rowNum, column: "event_id", message: `Duplicate event_id "${eventId}" (first occurrence kept).` });
      } else {
        seen.add(eventId);
      }
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }
    const event: ImportedRevenueEvent = {
      sourceEventId: eventId,
      source,
      occurredAt: occurredAt ?? 0,
      currency,
      amountMinor,
      refundedMinor,
      kind: "order",
    };
    const customer = get("customer_id");
    if (customer) event.customerRef = customer;
    const order = get("order_id");
    if (order) event.orderRef = order;
    const utm: CsvRevenueRow["utm"] = {};
    const us = get("utm_source");
    if (us) utm.source = us;
    const um = get("utm_medium");
    if (um) utm.medium = um;
    const uc = get("utm_campaign");
    if (uc) utm.campaign = uc;
    rows.push({ row: rowNum, event, utm });
  });

  return { ok: errors.length === 0, rows, errors, duplicateEventIds: [...duplicates], totalDataRows: data.length };
}
