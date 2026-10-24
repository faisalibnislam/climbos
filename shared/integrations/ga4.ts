/**
 * Google Analytics 4 (read-only): Data API runReport + Admin API accountSummaries.
 * Scope: https://www.googleapis.com/auth/analytics.readonly
 */

import { asArray, asNumber, asString, collectPages, isRecord, readFailure, requestJson } from "./http";
import { GA4_ADMIN_BASE, GA4_DATA_BASE } from "./registry";
import type { AdapterOptions, PaginationResult, ReadResult } from "./types";

export const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_LIMIT = 10_000;

export interface Ga4Property {
  property: string; // "properties/123"
  displayName: string;
  account: string;
  accountDisplayName: string;
  propertyType?: string;
}

export interface Ga4DailyRow {
  /** YYYY-MM-DD */
  date: string;
  sessionSource: string;
  sessionMedium: string;
  sessions: number;
  totalUsers: number;
  keyEvents: number;
  purchaseRevenue: number;
}

export const AI_REFERRAL_PROVIDERS = ["ChatGPT", "Perplexity", "Claude", "Gemini", "Microsoft Copilot"] as const;
export type AiReferralProvider = typeof AI_REFERRAL_PROVIDERS[number];

const AI_REFERRER_HOSTS: Record<AiReferralProvider, readonly string[]> = {
  ChatGPT: ["chatgpt.com", "chat.openai.com"],
  Perplexity: ["perplexity.ai"],
  Claude: ["claude.ai"],
  Gemini: ["gemini.google.com", "bard.google.com"],
  "Microsoft Copilot": ["copilot.microsoft.com", "copilot.com"],
};

/** Identify only explicit assistant referrer hosts; ordinary google/organic stays unclassified. */
export function aiReferralProvider(source: string): AiReferralProvider | undefined {
  const normalized = source.trim().toLocaleLowerCase("en-US").replace(/^www\./u, "");
  const hostname = (() => {
    try { return new URL(normalized.includes("://") ? normalized : `https://${normalized}`).hostname.toLocaleLowerCase("en-US"); }
    catch { return normalized.split("/")[0]?.split(":")[0] ?? ""; }
  })();
  for (const [provider, hosts] of Object.entries(AI_REFERRER_HOSTS) as [AiReferralProvider, readonly string[]][]) {
    if (hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return provider;
  }
  return undefined;
}

/** Only a GA4 referral session is counted; UTM-tagged paid/email traffic is not. */
export function aiReferralAttribution(source: string, medium: string): AiReferralProvider | undefined {
  return medium.trim().toLocaleLowerCase("en-US") === "referral" ? aiReferralProvider(source) : undefined;
}

export interface Ga4ReportInput extends AdapterOptions {
  accessToken: string;
  /** numeric id or "properties/123" */
  propertyId: string;
  startDate: string;
  endDate: string;
  maxPages?: number;
}

function auth(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export function normalizePropertyName(id: string): string {
  const trimmed = id.trim();
  if (/^properties\/\d+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `properties/${trimmed}`;
  throw new Error(`Invalid GA4 property id: ${id}`);
}

export async function listAccessibleProperties(
  input: AdapterOptions & { accessToken: string; maxPages?: number },
): Promise<ReadResult<PaginationResult<Ga4Property>>> {
  return collectPages<Ga4Property>(
    async (cursor) => {
      const url = new URL(`${GA4_ADMIN_BASE}/accountSummaries`);
      url.searchParams.set("pageSize", "200");
      if (cursor) url.searchParams.set("pageToken", cursor);
      const out = await requestJson({ url: url.toString(), headers: auth(input.accessToken), fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const items: Ga4Property[] = [];
      for (const acct of asArray(data.accountSummaries)) {
        if (!isRecord(acct)) continue;
        for (const prop of asArray(acct.propertySummaries)) {
          if (!isRecord(prop)) continue;
          const property = asString(prop.property);
          if (!property) continue;
          items.push({
            property,
            displayName: asString(prop.displayName) ?? property,
            account: asString(acct.account) ?? "",
            accountDisplayName: asString(acct.displayName) ?? "",
            propertyType: asString(prop.propertyType),
          });
        }
      }
      return { ok: true, data: { items, nextCursor: asString(data.nextPageToken) || undefined } };
    },
    { maxPages: input.maxPages ?? 5 },
  );
}

export function buildDailyReportBody(startDate: string, endDate: string, offset: number): Record<string, unknown> {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error("Dates must be YYYY-MM-DD");
  if (startDate > endDate) throw new Error("startDate must be on or before endDate");
  return {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }, { name: "purchaseRevenue" }],
    limit: String(PAGE_LIMIT),
    offset: String(offset),
    keepEmptyRows: false,
    returnPropertyQuota: true,
    orderBys: [{ dimension: { dimensionName: "date" } }],
  };
}

function gaDate(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

export function parseRunReportRows(data: unknown): { rows: Ga4DailyRow[]; rowCount: number } {
  if (!isRecord(data)) return { rows: [], rowCount: 0 };
  const dimHeaders = asArray(data.dimensionHeaders).map((h) => (isRecord(h) ? asString(h.name) ?? "" : ""));
  const metHeaders = asArray(data.metricHeaders).map((h) => (isRecord(h) ? asString(h.name) ?? "" : ""));
  const rows: Ga4DailyRow[] = [];
  for (const r of asArray(data.rows)) {
    if (!isRecord(r)) continue;
    const dims: Record<string, string> = {};
    asArray(r.dimensionValues).forEach((v, i) => {
      dims[dimHeaders[i] ?? String(i)] = isRecord(v) ? asString(v.value) ?? "" : "";
    });
    const mets: Record<string, number> = {};
    asArray(r.metricValues).forEach((v, i) => {
      mets[metHeaders[i] ?? String(i)] = isRecord(v) ? asNumber(v.value) : 0;
    });
    rows.push({
      date: gaDate(dims.date ?? ""),
      sessionSource: dims.sessionSource ?? "(not set)",
      sessionMedium: dims.sessionMedium ?? "(not set)",
      sessions: mets.sessions ?? 0,
      totalUsers: mets.totalUsers ?? 0,
      keyEvents: mets.keyEvents ?? 0,
      purchaseRevenue: mets.purchaseRevenue ?? 0,
    });
  }
  return { rows, rowCount: asNumber(data.rowCount) };
}

/** Daily sessions/users/keyEvents/purchaseRevenue by sessionSource/medium, paginated by offset. */
export async function runDailyReport(input: Ga4ReportInput): Promise<ReadResult<PaginationResult<Ga4DailyRow>>> {
  const property = normalizePropertyName(input.propertyId);
  const url = `${GA4_DATA_BASE}/${property}:runReport`;
  return collectPages<Ga4DailyRow>(
    async (cursor) => {
      const offset = cursor ? Number(cursor) : 0;
      const out = await requestJson({
        url,
        method: "POST",
        headers: auth(input.accessToken),
        body: buildDailyReportBody(input.startDate, input.endDate, offset),
        fetchImpl: input.fetchImpl,
        timeoutMs: input.timeoutMs,
      });
      if (out.kind !== "ok") return readFailure(out);
      const { rows, rowCount } = parseRunReportRows(out.data);
      const next = offset + rows.length;
      return { ok: true, data: { items: rows, nextCursor: rows.length > 0 && next < rowCount ? String(next) : undefined } };
    },
    { maxPages: input.maxPages ?? 10 },
  );
}
