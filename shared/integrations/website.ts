/**
 * Website research helpers: SSRF-safe URL validation, redirect re-validation,
 * robots.txt (RFC 9309), bounded HTML → text extraction, and a Firecrawl v2
 * scrape request builder.
 *
 * DNS rebinding: hostname validation alone cannot stop a public name resolving
 * to a private address. Callers that can resolve DNS must pass the resolved
 * addresses through validateResolvedAddresses() and connect only to those.
 */

import { FIRECRAWL_SCRAPE_URL } from "./registry";
import type { FetchLike } from "./types";

export const RESEARCH_USER_AGENT = "ClimbOSBot";
export const MAX_URL_LENGTH = 2048;
export const MAX_REDIRECTS = 3;

export type UrlValidation = { ok: true; url: string; hostname: string } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// IP classification
// ---------------------------------------------------------------------------

export function parseIPv4(s: string): number[] | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return undefined;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p >= 0 && p <= 255) ? parts : undefined;
}

type Cidr4 = [number, number, number, number, number];
const BLOCKED_V4: Cidr4[] = [
  [0, 0, 0, 0, 8], // "this network" incl. 0.0.0.0
  [10, 0, 0, 0, 8],
  [100, 64, 0, 0, 10], // CGNAT
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16], // link-local incl. 169.254.169.254 metadata
  [172, 16, 0, 0, 12],
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 0, 2, 0, 24], // TEST-NET-1
  [192, 88, 99, 0, 24], // 6to4 relay anycast
  [192, 168, 0, 0, 16],
  [198, 18, 0, 0, 15], // benchmarking
  [198, 51, 100, 0, 24], // TEST-NET-2
  [203, 0, 113, 0, 24], // TEST-NET-3
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved + broadcast
];

function v4ToInt(p: number[]): number {
  return (((p[0] ?? 0) << 24) >>> 0) + ((p[1] ?? 0) << 16) + ((p[2] ?? 0) << 8) + (p[3] ?? 0);
}

export function isBlockedIPv4(parts: number[]): boolean {
  const ip = v4ToInt(parts);
  return BLOCKED_V4.some(([a, b, c, d, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((ip & mask) >>> 0) === ((v4ToInt([a, b, c, d]) & mask) >>> 0);
  });
}

/** Parse an IPv6 literal (no brackets, no zone) into 8 16-bit groups. */
export function parseIPv6(input: string): number[] | undefined {
  let s = input.toLowerCase();
  if (s.includes("%")) return undefined; // zone ids are never allowed
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  const maybeV4 = s.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) return undefined;
    tail = [((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0)];
    s = s.slice(0, lastColon + 1) + "0:0"; // placeholder groups, replaced below
  }
  const halves = s.split("::");
  if (halves.length > 2) return undefined;
  const parseGroups = (part: string): number[] | undefined => {
    if (part === "") return [];
    const groups = part.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return undefined;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(halves[0] ?? "");
  const rest = halves.length === 2 ? parseGroups(halves[1] ?? "") : [];
  if (!head || !rest) return undefined;
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return undefined;
    groups = [...head, ...new Array<number>(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return undefined;
  if (tail.length === 2) {
    groups[6] = tail[0] ?? 0;
    groups[7] = tail[1] ?? 0;
  }
  return groups;
}

function embeddedV4(g: number[], hi: number, lo: number): number[] {
  const a = g[hi] ?? 0;
  const b = g[lo] ?? 0;
  return [a >> 8, a & 0xff, b >> 8, b & 0xff];
}

export function isBlockedIPv6(g: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0] = g;
  const first96Zero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0;
  if (first96Zero) return true; // ::, ::1, IPv4-compatible (deprecated)
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIPv4(embeddedV4(g, 6, 7)); // ::ffff:a.b.c.d mapped
  }
  if (g0 === 0x64 && g1 === 0xff9b) return true; // NAT64 64:ff9b::/96 and 64:ff9b:1::/48 → may reach internal v4
  if ((g0 & 0xe000) !== 0x2000) return true; // outside 2000::/3 global unicast (covers fc00::/7, fe80::/10, ff00::/8, 100::/64…)
  if (g0 === 0x2001 && g1 < 0x0200) return true; // 2001::/23 IETF protocol assignments (Teredo, ORCHID, benchmarking)
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2002) return true; // 6to4 can tunnel to private v4
  if (g0 === 0x3fff && g1 < 0x1000) return true; // 3fff::/20 documentation
  return false;
}

export type IpCheck = { kind: "ipv4" | "ipv6"; blocked: boolean } | { kind: "not_ip" };

export function classifyIpLiteral(host: string): IpCheck {
  const h = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const v4 = parseIPv4(h);
  if (v4) return { kind: "ipv4", blocked: isBlockedIPv4(v4) };
  if (h.includes(":")) {
    const v6 = parseIPv6(h);
    return { kind: "ipv6", blocked: v6 ? isBlockedIPv6(v6) : true };
  }
  return { kind: "not_ip" };
}

/** For callers that resolve DNS: every resolved address must be public. */
export function validateResolvedAddresses(addresses: string[]): { ok: true } | { ok: false; reason: string; blocked: string[] } {
  if (addresses.length === 0) return { ok: false, reason: "Host did not resolve to any address", blocked: [] };
  const blocked = addresses.filter((a) => {
    const c = classifyIpLiteral(a.trim());
    return c.kind === "not_ip" || c.blocked;
  });
  return blocked.length ? { ok: false, reason: "Host resolves to a private or reserved address", blocked } : { ok: true };
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa", ".intranet", ".corp", ".lan"];

export function validateResearchUrl(input: string): UrlValidation {
  if (typeof input !== "string" || input.length === 0) return { ok: false, reason: "URL is empty" };
  if (input.length > MAX_URL_LENGTH) return { ok: false, reason: "URL is too long" };
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "Only http and https URLs are allowed" };
  if (url.username || url.password) return { ok: false, reason: "URLs with embedded credentials are not allowed" };
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return { ok: false, reason: "Only ports 80 and 443 are allowed" };

  const rawHost = url.hostname.toLowerCase();
  if (!rawHost) return { ok: false, reason: "URL has no host" };
  const ip = classifyIpLiteral(rawHost);
  if (ip.kind !== "not_ip") {
    if (ip.blocked) return { ok: false, reason: "IP address is private, loopback, link-local or reserved" };
  } else {
    const host = rawHost.replace(/\.$/, "");
    if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: "Local or internal hostnames are not allowed" };
    if (!host.includes(".")) return { ok: false, reason: "Single-label hostnames are not allowed" };
    if (!/^[a-z0-9.-]+$/.test(host)) return { ok: false, reason: "Hostname contains invalid characters" };
    if (host.split(".").some((l) => l.length === 0 || l.length > 63)) return { ok: false, reason: "Hostname has an invalid label" };
    if (/^\d+$/.test(host.split(".").pop() ?? "")) return { ok: false, reason: "Numeric top-level domains are not allowed" };
    url.hostname = host;
  }
  url.hash = "";
  return { ok: true, url: url.toString(), hostname: url.hostname };
}

/** Re-validate a redirect hop. hop is 1-based; https → http downgrades are refused. */
export function isAllowedRedirect(fromUrl: string, location: string, hop: number, maxHops: number = MAX_REDIRECTS): UrlValidation {
  if (hop > maxHops) return { ok: false, reason: `Too many redirects (max ${maxHops})` };
  let target: string;
  try {
    target = new URL(location, fromUrl).toString();
  } catch {
    return { ok: false, reason: "Redirect location is not a valid URL" };
  }
  const v = validateResearchUrl(target);
  if (!v.ok) return v;
  if (fromUrl.startsWith("https:") && v.url.startsWith("http:")) return { ok: false, reason: "Redirect downgrades https to http" };
  return v;
}

export interface SafeFetchResult {
  ok: boolean;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
  /** Present for conditional requests that returned 304 Not Modified. */
  notModified?: boolean;
  etag?: string;
  lastModified?: string;
  error?: string;
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = Math.max(0, maxBytes - total);
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), truncated };
}

/**
 * Fetch a public page with manual, re-validated redirects and a byte cap.
 * `resolveHost` (optional) lets server callers enforce DNS-rebinding checks.
 */
export async function safeFetchPage(input: {
  url: string;
  fetchImpl?: FetchLike;
  resolveHost?: (hostname: string) => Promise<string[]>;
  maxBytes?: number;
  timeoutMs?: number;
  /** Conditional validators from a prior safe read. Sent only to the original origin across redirects. */
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  /** Optional caller policy applied to every redirect target before it is fetched. */
  allowRedirect?: (fromUrl: string, toUrl: string) => boolean;
}): Promise<SafeFetchResult> {
  const doFetch: FetchLike = input.fetchImpl ?? ((u, i) => fetch(u, i));
  const maxBytes = input.maxBytes ?? 2_000_000;
  const first = validateResearchUrl(input.url);
  if (!first.ok) return { ok: false, finalUrl: input.url, status: 0, contentType: "", body: "", truncated: false, error: first.reason };
  const originalOrigin = new URL(first.url).origin;
  let current = first;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (input.resolveHost && classifyIpLiteral(current.hostname).kind === "not_ip") {
      const check = validateResolvedAddresses(await input.resolveHost(current.hostname));
      if (!check.ok) return { ok: false, finalUrl: current.url, status: 0, contentType: "", body: "", truncated: false, error: check.reason };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);
    let res: Response;
    try {
      const headers: Record<string, string> = { "User-Agent": `${RESEARCH_USER_AGENT}/1.0`, Accept: "text/html,text/plain;q=0.9,*/*;q=0.1" };
      if (new URL(current.url).origin === originalOrigin) {
        const etag = input.ifNoneMatch?.trim();
        const modifiedSince = input.ifModifiedSince?.trim();
        if (etag && etag.length <= 512 && !/[\r\n]/u.test(etag)) headers["If-None-Match"] = etag;
        if (modifiedSince && modifiedSince.length <= 128 && !/[\r\n]/u.test(modifiedSince)) headers["If-Modified-Since"] = modifiedSince;
      }
      res = await doFetch(current.url, { redirect: "manual", signal: controller.signal, headers });
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, finalUrl: current.url, status: 0, contentType: "", body: "", truncated: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (res.status === 304) {
      clearTimeout(timer);
      const etag = res.headers.get("etag") ?? undefined;
      const lastModified = res.headers.get("last-modified") ?? undefined;
      return { ok: true, finalUrl: current.url, status: res.status, contentType: res.headers.get("content-type") ?? "", body: "", truncated: false, notModified: true, ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}) };
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, finalUrl: current.url, status: res.status, contentType: "", body: "", truncated: false, error: "Redirect without location" };
      const next = isAllowedRedirect(current.url, loc, hop + 1);
      if (!next.ok) return { ok: false, finalUrl: current.url, status: res.status, contentType: "", body: "", truncated: false, error: next.reason };
      if (input.allowRedirect && !input.allowRedirect(current.url, next.url)) return { ok: false, finalUrl: current.url, status: res.status, contentType: "", body: "", truncated: false, error: "Redirect was rejected by caller policy" };
      current = next;
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const etag = res.headers.get("etag") ?? undefined;
    const lastModified = res.headers.get("last-modified") ?? undefined;
    let text = "";
    let truncated = false;
    try {
      const bounded = await readBoundedBody(res, maxBytes);
      text = bounded.text;
      truncated = bounded.truncated;
    } finally {
      clearTimeout(timer);
    }
    return { ok: res.ok, finalUrl: current.url, status: res.status, contentType, body: text, truncated, ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}) };
  }
  return { ok: false, finalUrl: current.url, status: 0, contentType: "", body: "", truncated: false, error: "Too many redirects" };
}

// ---------------------------------------------------------------------------
// robots.txt (RFC 9309)
// ---------------------------------------------------------------------------

interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
  crawlDelaySec?: number;
}

export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  let lastWasAgent = false;
  for (const rawLine of text.slice(0, 500_000).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value === "") continue; // empty rule matches nothing
      current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelaySec = n;
    }
  }
  return groups;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

function normalizeRobotsPath(p: string): string {
  // Decode unreserved percent-escapes so /%7Efoo and /~foo compare equal.
  return p.replace(/%([0-9a-fA-F]{2})/g, (m, hex: string) => {
    const ch = String.fromCharCode(parseInt(hex, 16));
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : m.toUpperCase();
  });
}

function selectGroups(groups: RobotsGroup[], userAgent: string): RobotsGroup[] {
  const token = userAgent.toLowerCase().split("/")[0]?.trim() ?? "";
  const specific = groups.filter((g) => g.userAgents.some((ua) => ua !== "*" && ua.split("/")[0] === token));
  if (specific.length) return specific;
  return groups.filter((g) => g.userAgents.includes("*"));
}

/** RFC 9309: most specific (longest) matching rule wins; Allow wins ties; no rules → allowed. */
export function isPathAllowed(robotsTxt: string, userAgent: string, path: string): boolean {
  const target = normalizeRobotsPath(path.startsWith("/") ? path : `/${path}`);
  if (target === "/robots.txt") return true;
  const groups = selectGroups(parseRobotsTxt(robotsTxt), userAgent);
  let best: { len: number; allow: boolean } | undefined;
  for (const g of groups) {
    for (const r of g.rules) {
      const pattern = normalizeRobotsPath(r.pattern);
      if (!patternToRegExp(pattern).test(target)) continue;
      const len = pattern.length;
      if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow };
    }
  }
  return best ? best.allow : true;
}

export function getCrawlDelaySec(robotsTxt: string, userAgent: string): number | undefined {
  const delays = selectGroups(parseRobotsTxt(robotsTxt), userAgent)
    .map((g) => g.crawlDelaySec)
    .filter((d): d is number => d !== undefined);
  return delays.length ? Math.max(...delays) : undefined;
}

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const cp = parseInt(ent.slice(2), 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    if (ent.startsWith("#")) {
      const cp = parseInt(ent.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[a-zA-Z0-9]+/, "").replace(/\/?>$/, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const name = (m[1] ?? "").toLowerCase();
    if (!name) continue;
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export interface JsonLdPrice {
  name?: string;
  price: string;
  currency?: string;
  availability?: string;
  type: string;
}

export interface ExtractedPage {
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robotsDirectives?: string;
  og: Record<string, string>;
  headings: Array<{ level: 1 | 2 | 3; text: string }>;
  links: Array<{ url: string; text: string }>;
  jsonLdPrices: JsonLdPrice[];
  jsonLdTypes: string[];
  text: string;
  truncated: boolean;
}

function asTypeList(t: unknown): string[] {
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function collectJsonLdPrices(node: unknown, out: JsonLdPrice[], parentName: string | undefined, depth: number): void {
  if (depth > 10 || out.length >= 50) return;
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdPrices(n, out, parentName, depth + 1);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const rec = node as Record<string, unknown>;
  const types = asTypeList(rec["@type"]);
  const name = typeof rec.name === "string" ? rec.name : parentName;
  if (types.some((t) => t === "Offer" || t === "AggregateOffer")) {
    const priceRaw = rec.price ?? rec.lowPrice;
    if (typeof priceRaw === "string" || typeof priceRaw === "number") {
      const entry: JsonLdPrice = { price: String(priceRaw), type: types.join(",") };
      if (name) entry.name = name;
      if (typeof rec.priceCurrency === "string") entry.currency = rec.priceCurrency.toUpperCase();
      if (typeof rec.availability === "string") entry.availability = rec.availability;
      out.push(entry);
    }
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "@context") continue;
    if (typeof v === "object" && v !== null) collectJsonLdPrices(v, out, types.includes("Product") ? name : parentName, depth + 1);
  }
}

export function extractPageContent(
  html: string,
  pageUrl: string,
  options: { maxTextChars?: number; maxLinks?: number; maxHtmlChars?: number } = {},
): ExtractedPage {
  const maxText = options.maxTextChars ?? 40_000;
  const maxLinks = options.maxLinks ?? 50;
  let src = html.slice(0, options.maxHtmlChars ?? 3_000_000);

  // JSON-LD first (before scripts are removed).
  const jsonLdPrices: JsonLdPrice[] = [];
  const jsonLdTypes = new Set<string>();
  const ldRe = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = ldRe.exec(src)) !== null) {
    try {
      const data = JSON.parse((ld[1] ?? "").trim()) as unknown;
      collectJsonLdPrices(data, jsonLdPrices, undefined, 0);
      collectJsonLdTypes(data, jsonLdTypes, 0);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  src = src
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|object|canvas)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(script|style)\b[^>]*\/>/gi, " ");

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(src);
  const title = titleMatch ? stripTags(titleMatch[1] ?? "").slice(0, 500) : undefined;

  let metaDescription: string | undefined;
  let robotsDirectives: string | undefined;
  const og: Record<string, string> = {};
  for (const tag of src.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = parseAttributes(tag);
    const content = (a.content ?? "").trim().slice(0, 1000);
    if (!content) continue;
    if (a.name?.toLowerCase() === "description" && metaDescription === undefined) metaDescription = content;
    if (["robots", "googlebot"].includes(a.name?.toLowerCase() ?? "") && robotsDirectives === undefined) robotsDirectives = content.toLowerCase();
    const prop = (a.property ?? a.name ?? "").toLowerCase();
    if (prop.startsWith("og:") && !(prop in og) && Object.keys(og).length < 30) og[prop] = content;
  }

  let canonicalUrl: string | undefined;
  for (const tag of src.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    if ((attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && attrs.href) {
      try {
        const parsed = new URL(attrs.href, pageUrl);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") canonicalUrl = parsed.toString();
      } catch {
        // An invalid canonical is not an observed canonical URL.
      }
      if (canonicalUrl) break;
    }
  }

  const headings: ExtractedPage["headings"] = [];
  const hRe = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  let h: RegExpExecArray | null;
  while ((h = hRe.exec(src)) !== null && headings.length < 100) {
    const text = stripTags(h[2] ?? "").slice(0, 300);
    if (text) headings.push({ level: Number(h[1]) as 1 | 2 | 3, text });
  }

  const links: ExtractedPage["links"] = [];
  let origin: string | undefined;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = undefined;
  }
  const seen = new Set<string>();
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let a: RegExpExecArray | null;
  while (origin && (a = aRe.exec(src)) !== null && links.length < maxLinks) {
    const href = parseAttributes(`<a ${a[1] ?? ""}>`).href;
    if (!href || /^(javascript|mailto|tel|data):/i.test(href.trim())) continue;
    let abs: URL;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin || (abs.protocol !== "http:" && abs.protocol !== "https:")) continue;
    abs.hash = "";
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, text: stripTags(a[2] ?? "").slice(0, 200) });
  }

  const bodyMatch = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(src);
  const bodySrc = (bodyMatch ? bodyMatch[1] ?? "" : src.replace(/<head\b[\s\S]*?<\/head\s*>/i, " "))
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|pre|table|ul|ol)\s*>/gi, "\n");
  let text = decodeEntities(bodySrc.replace(/<[^>]*>/g, " "))
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let truncated = false;
  if (text.length > maxText) {
    text = text.slice(0, maxText);
    truncated = true;
  }

  const page: ExtractedPage = { og, headings, links, jsonLdPrices, jsonLdTypes: [...jsonLdTypes].slice(0, 50), text, truncated };
  if (title) page.title = title;
  if (metaDescription) page.metaDescription = metaDescription;
  if (canonicalUrl) page.canonicalUrl = canonicalUrl;
  if (robotsDirectives) page.robotsDirectives = robotsDirectives;
  return page;
}

function collectJsonLdTypes(node: unknown, out: Set<string>, depth: number): void {
  if (depth > 10 || out.size >= 50) return;
  if (Array.isArray(node)) {
    for (const child of node) collectJsonLdTypes(child, out, depth + 1);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  for (const type of asTypeList(record["@type"])) if (type.trim()) out.add(type.trim().split("/").pop()!.split("#").pop()!);
  for (const [key, value] of Object.entries(record)) {
    if (key !== "@context" && typeof value === "object" && value !== null) collectJsonLdTypes(value, out, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Firecrawl v2
// ---------------------------------------------------------------------------

export interface FirecrawlRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

export function firecrawlScrapeRequest(input: {
  apiKey: string;
  url: string;
  onlyMainContent?: boolean;
  timeoutMs?: number;
  maxAgeMs?: number;
}): FirecrawlRequest {
  if (!input.apiKey) throw new Error("FIRECRAWL_API_KEY is required");
  const v = validateResearchUrl(input.url);
  if (!v.ok) throw new Error(`Refusing to scrape: ${v.reason}`);
  const timeout = Math.max(1000, Math.min(input.timeoutMs ?? 30_000, 300_000));
  const body: Record<string, unknown> = {
    url: v.url,
    formats: ["markdown"],
    onlyMainContent: input.onlyMainContent ?? true,
    timeout,
    blockAds: true,
    removeBase64Images: true,
  };
  if (input.maxAgeMs !== undefined) body.maxAge = Math.max(0, input.maxAgeMs);
  return {
    url: FIRECRAWL_SCRAPE_URL,
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  };
}

export function parseFirecrawlScrapeResponse(
  json: unknown,
  maxChars = 40_000,
): { ok: true; markdown: string; title?: string; sourceUrl?: string; truncated: boolean } | { ok: false; error: string } {
  if (typeof json !== "object" || json === null) return { ok: false, error: "Invalid Firecrawl response" };
  const rec = json as Record<string, unknown>;
  if (rec.success !== true) return { ok: false, error: typeof rec.error === "string" ? rec.error : "Firecrawl scrape failed" };
  const data = (typeof rec.data === "object" && rec.data !== null ? rec.data : {}) as Record<string, unknown>;
  const md = typeof data.markdown === "string" ? data.markdown : "";
  const meta = (typeof data.metadata === "object" && data.metadata !== null ? data.metadata : {}) as Record<string, unknown>;
  const out: { ok: true; markdown: string; title?: string; sourceUrl?: string; truncated: boolean } = {
    ok: true,
    markdown: md.slice(0, maxChars),
    truncated: md.length > maxChars,
  };
  if (typeof meta.title === "string") out.title = meta.title;
  if (typeof meta.sourceURL === "string") out.sourceUrl = meta.sourceURL;
  return out;
}
