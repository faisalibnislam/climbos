/**
 * Google Search Console (read-only): sites.list and searchAnalytics.query.
 * Scope: https://www.googleapis.com/auth/webmasters.readonly
 */

import { asArray, asNumber, asString, collectPages, isRecord, readFailure, requestJson } from "./http";
import { SEARCH_CONSOLE_BASE } from "./registry";
import type { AdapterOptions, PaginationResult, ReadResult } from "./types";

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const SEARCH_CONSOLE_MAX_ROW_LIMIT = 25_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SearchDimension = "date" | "query" | "page" | "country" | "device" | "searchAppearance";

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Check whether a Search Console property can describe the recorded business website. */
export function searchConsolePropertyMatchesWebsite(property: string, website: string): boolean {
  const websiteUrl = parseHttpUrl(website);
  if (!websiteUrl) return false;
  const businessHost = normalizeHost(websiteUrl.hostname, true);
  if (property.startsWith("sc-domain:")) {
    const domain = normalizeHost(property.slice("sc-domain:".length), true);
    return Boolean(domain && (businessHost === domain || businessHost.endsWith(`.${domain}`)));
  }
  const propertyUrl = parseHttpUrl(property);
  if (!propertyUrl || normalizeHost(propertyUrl.hostname, false) !== normalizeHost(websiteUrl.hostname, false)) return false;
  const prefixPath = propertyUrl.pathname;
  const businessPath = websiteUrl.pathname;
  return prefixPath === "/" || businessPath === prefixPath || businessPath.startsWith(prefixPath.endsWith("/") ? prefixPath : `${prefixPath}/`);
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function normalizeHost(host: string, stripWww: boolean): string {
  const normalized = host.toLocaleLowerCase("en-US").replace(/\.$/, "");
  return stripWww ? normalized.replace(/^www\./, "") : normalized;
}

function auth(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listSites(input: AdapterOptions & { accessToken: string }): Promise<ReadResult<SearchConsoleSite[]>> {
  const out = await requestJson({ url: `${SEARCH_CONSOLE_BASE}/sites`, headers: auth(input.accessToken), fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
  if (out.kind !== "ok") return readFailure(out);
  const data = isRecord(out.data) ? out.data : {};
  const sites: SearchConsoleSite[] = [];
  for (const s of asArray(data.siteEntry)) {
    if (!isRecord(s)) continue;
    const siteUrl = asString(s.siteUrl);
    if (siteUrl) sites.push({ siteUrl, permissionLevel: asString(s.permissionLevel) ?? "unknown" });
  }
  return { ok: true, data: sites };
}

export interface SearchAnalyticsInput extends AdapterOptions {
  accessToken: string;
  /** "https://example.com/" or "sc-domain:example.com" */
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: SearchDimension[];
  rowLimit?: number;
  dataState?: "final" | "all";
  type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  maxPages?: number;
}

export function buildSearchAnalyticsBody(input: SearchAnalyticsInput, startRow: number): Record<string, unknown> {
  if (!DATE_RE.test(input.startDate) || !DATE_RE.test(input.endDate)) throw new Error("Dates must be YYYY-MM-DD");
  if (input.startDate > input.endDate) throw new Error("startDate must be on or before endDate");
  const dims = input.dimensions ?? ["date", "query", "page"];
  if (new Set(dims).size !== dims.length) throw new Error("Dimensions cannot repeat");
  const rowLimit = Math.max(1, Math.min(input.rowLimit ?? SEARCH_CONSOLE_MAX_ROW_LIMIT, SEARCH_CONSOLE_MAX_ROW_LIMIT));
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions: dims,
    type: input.type ?? "web",
    dataState: input.dataState ?? "final",
    rowLimit,
    startRow,
  };
}

export async function querySearchAnalytics(input: SearchAnalyticsInput): Promise<ReadResult<PaginationResult<SearchAnalyticsRow>>> {
  const url = `${SEARCH_CONSOLE_BASE}/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
  return collectPages<SearchAnalyticsRow>(
    async (cursor) => {
      const startRow = cursor ? Number(cursor) : 0;
      const body = buildSearchAnalyticsBody(input, startRow);
      const out = await requestJson({ url, method: "POST", headers: auth(input.accessToken), body, fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const rows: SearchAnalyticsRow[] = [];
      for (const r of asArray(data.rows)) {
        if (!isRecord(r)) continue;
        rows.push({
          keys: asArray(r.keys).map((k) => asString(k) ?? ""),
          clicks: asNumber(r.clicks),
          impressions: asNumber(r.impressions),
          ctr: asNumber(r.ctr),
          position: asNumber(r.position),
        });
      }
      const limit = body.rowLimit as number;
      return { ok: true, data: { items: rows, nextCursor: rows.length === limit ? String(startRow + rows.length) : undefined } };
    },
    { maxPages: input.maxPages ?? 10 },
  );
}
