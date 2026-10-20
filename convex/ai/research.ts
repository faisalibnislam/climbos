"use node";

import { lookup } from "node:dns/promises";
import {
  extractPageContent,
  firecrawlScrapeRequest,
  isPathAllowed,
  parseFirecrawlScrapeResponse,
  RESEARCH_USER_AGENT,
  safeFetchPage,
  validateResearchUrl,
} from "../../shared/integrations/website";

/**
 * Bounded public-website research. Untrusted content: the caller wraps every
 * page in <untrusted_content> before it reaches a model. Here, URLs suggested by
 * models are never fetched on a model's say-so: only the owner's site and
 * same-origin links, plus (for source checks) pages this run's web search
 * itself returned. The research model's own page reads (`fetch_page`) are a
 * separate, capped tool with the same URL, DNS, redirect and robots rules:
 * shared/ai/pageFetch.ts, given `resolveHost` from here.
 */

export interface ResearchedPage {
  url: string;
  title?: string;
  description?: string;
  text: string;
  status: "ok" | "blocked_by_robots" | "failed";
  error?: string;
  prices: string[];
}

/** Server DNS lookup: every address a host resolves to, for the private-address check. */
export async function resolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export function normalizeWebsite(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const v = validateResearchUrl(s);
  return v.ok ? v.url : null;
}

async function robotsFor(origin: string): Promise<string | null> {
  const res = await safeFetchPage({ url: `${origin}/robots.txt`, resolveHost, maxBytes: 200_000, timeoutMs: 8000 });
  return res.ok ? res.body : null;
}

async function fetchOne(url: string): Promise<ResearchedPage> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (key) {
    try {
      const req = firecrawlScrapeRequest({ apiKey: key, url, timeoutMs: 30_000 });
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      const parsed = parseFirecrawlScrapeResponse(await res.json().catch(() => null), 24_000);
      if (parsed.ok) return { url, title: parsed.title, text: parsed.markdown, status: "ok", prices: [] };
    } catch {
      // Fall through to the built-in fetcher.
    }
  }
  const res = await safeFetchPage({ url, resolveHost, maxBytes: 2_000_000, timeoutMs: 15_000 });
  if (!res.ok) return { url, text: "", status: "failed", error: res.error ?? `HTTP ${res.status}`, prices: [] };
  if (!/html|text\/plain/i.test(res.contentType)) {
    return { url, text: "", status: "failed", error: "Not a web page", prices: [] };
  }
  const page = extractPageContent(res.body, res.finalUrl, { maxTextChars: 16_000, maxLinks: 50 });
  return {
    url: res.finalUrl,
    title: page.title,
    description: page.metaDescription,
    text: [page.title, page.metaDescription, ...page.headings.map((h) => h.text), page.text].filter(Boolean).join("\n"),
    status: "ok",
    prices: page.jsonLdPrices.map((p) => `${p.name ?? "Offer"}: ${p.price} ${p.currency ?? ""}`.trim()),
    // links returned separately below
  };
}

/** Homepage plus up to `extraPages` same-origin pages likely to describe the product. */
/** What a planner most needs from a site, in order: price, offer, who it's for, rivals, story. */
const PAGE_PRIORITY = [/pricing|price|plans/i, /features?|product/i, /\/(for|solutions|use-cases|industries|customers)(\/|$)/i, /compare|vs[-/]|alternative/i, /about|how-it-works|story/i];
function sameSite(a: string, b: string): boolean {
  const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return bare(a) === bare(b);
}
function pageRank(path: string): number {
  const i = PAGE_PRIORITY.findIndex((re) => re.test(path));
  return i < 0 ? PAGE_PRIORITY.length : i;
}

export async function researchWebsite(website: string, extraPages: number): Promise<{ pages: ResearchedPage[]; pagesFetched: number }> {
  const url = normalizeWebsite(website);
  if (!url) return { pages: [{ url: website, text: "", status: "failed", error: "That doesn't look like a public website address.", prices: [] }], pagesFetched: 0 };
  const origin = new URL(url).origin;
  const robots = await robotsFor(origin).catch(() => null);
  const allowed = (u: string) => !robots || isPathAllowed(robots, RESEARCH_USER_AGENT, new URL(u).pathname || "/");

  const pages: ResearchedPage[] = [];
  let fetched = 0;
  if (!allowed(url)) {
    return { pages: [{ url, text: "", status: "blocked_by_robots", prices: [] }], pagesFetched: 0 };
  }
  const home = await fetchOne(url);
  fetched++;
  pages.push(home);
  if (home.status !== "ok" || extraPages <= 0) return { pages, pagesFetched: fetched };

  // Find candidate pages from the homepage's same-origin links.
  const htmlRes = await safeFetchPage({ url, resolveHost, maxBytes: 2_000_000, timeoutMs: 10_000 }).catch(() => null);
  const links = htmlRes?.ok ? extractPageContent(htmlRes.body, htmlRes.finalUrl, { maxLinks: 300 }).links : [];
  const seen = new Set([url.replace(/\/$/, ""), (htmlRes?.ok ? htmlRes.finalUrl : url).replace(/\/$/, "")]);
  // The site may redirect (involets.com → www.involets.com): links count as the same site either way.
  const siteHost = new URL(htmlRes?.ok ? htmlRes.finalUrl : url).hostname;
  const unique = [...new Set(links.map((l) => l.url.split("#")[0].replace(/\/$/, "")))];
  const ranked = unique
    .map((u) => {
      try {
        const parsed = new URL(u);
        return sameSite(parsed.hostname, siteHost) && !seen.has(u) ? { u, rank: pageRank(parsed.pathname) } : null;
      } catch {
        return null;
      }
    })
    .filter((c): c is { u: string; rank: number } => c !== null && c.rank < PAGE_PRIORITY.length)
    // Most useful kind first; within a kind, the shortest (top-level) path.
    .sort((a, b) => a.rank - b.rank || a.u.length - b.u.length);
  // One page of each kind before a second page of any kind.
  const firsts = ranked.filter((c, i, all) => all.findIndex((x) => x.rank === c.rank) === i);
  const candidates = [...firsts, ...ranked.filter((c) => !firsts.includes(c))].slice(0, extraPages).map((c) => c.u);
  for (const c of candidates) {
    seen.add(c.replace(/\/$/, ""));
    if (!allowed(c)) {
      pages.push({ url: c, text: "", status: "blocked_by_robots", prices: [] });
      continue;
    }
    pages.push(await fetchOne(c));
    fetched++;
  }
  return { pages, pagesFetched: fetched };
}

/**
 * Source checks: load cited pages so a quoted number can be verified against the
 * page itself. Only URLs the run's web search returned are fetched (a citation
 * outside them is stale or invented); robots.txt is honoured; at most 8 pages.
 */
export async function fetchCitedPages(cited: string[], searched: string[], key: (u: string) => string): Promise<Record<string, string | null>> {
  const allowed = new Set(searched.map(key));
  const out: Record<string, string | null> = {};
  const targets = [...new Set(cited.map((u) => u.trim()))].filter((u) => allowed.has(key(u))).slice(0, 8);
  const robots = new Map<string, string | null>();
  await Promise.all(
    targets.map(async (u) => {
      const url = normalizeWebsite(u);
      if (!url) return;
      const origin = new URL(url).origin;
      if (!robots.has(origin)) robots.set(origin, await robotsFor(origin).catch(() => null));
      const r = robots.get(origin);
      if (r && !isPathAllowed(r, RESEARCH_USER_AGENT, new URL(url).pathname || "/")) {
        out[key(u)] = null;
        return;
      }
      const page = await fetchOne(url).catch(() => null);
      out[key(u)] = page?.status === "ok" ? `${page.text}\n${page.prices.join("\n")}` : null;
    }),
  );
  return out;
}
