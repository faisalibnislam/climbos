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
import { parseSitemapLocations } from "../../shared/seo/sitemap";
import { assessSearchReadiness, SEARCH_CRAWLERS, AI_DATA_USE_CONTROLS, type CrawlerCheck, type ReadinessFinding } from "../../shared/seo/readiness";

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
  canonicalUrl?: string;
  robotsDirectives?: string;
  crawlerRobotsDirectives?: { crawler: string; directives: string }[];
  headings?: string[];
  headingCounts?: { h1: number; h2: number; h3: number };
  internalLinks?: string[];
  htmlLang?: string;
  viewportPresent?: boolean;
  imageCount?: number;
  imagesWithAltAttribute?: number;
  structuredDataTypes?: string[];
  /** True only when bounded static HTML was fetched and parsed, independent of Firecrawl markdown. */
  htmlMetadataRead?: boolean;
  searchReadiness?: ReadinessFinding[];
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

type RobotsRead = { status: "available" | "not_found" | "unavailable"; body: string | null };

async function robotsFor(origin: string): Promise<RobotsRead> {
  const res = await safeFetchPage({ url: `${origin}/robots.txt`, resolveHost, maxBytes: 200_000, timeoutMs: 8000 });
  if (res.ok) return { status: "available", body: res.body };
  if (res.status === 404) return { status: "not_found", body: null };
  return { status: "unavailable", body: null };
}

function searchReadinessFor(page: ReturnType<typeof extractPageContent>, url: string, httpStatus: number, xRobotsTag: string | undefined, robots: string | null | undefined, robotsFileStatus: RobotsRead["status"]): ReadinessFinding[] {
  const crawlerChecks: CrawlerCheck[] = ([...SEARCH_CRAWLERS, ...AI_DATA_USE_CONTROLS] as const).map((crawler) => ({
    crawler,
    allowed: robots == null || isPathAllowed(robots, crawler, new URL(url).pathname || "/"),
  }));
  return assessSearchReadiness(page, {
    httpStatus,
    canonicalUrl: page.canonicalUrl,
    pageUrl: url,
    robotsDirectives: page.robotsDirectives,
    xRobotsTag,
    robotsFileStatus,
    crawlerChecks,
  });
}

async function fetchOne(url: string, robots?: RobotsRead): Promise<ResearchedPage> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (key) {
    try {
      const req = firecrawlScrapeRequest({ apiKey: key, url, timeoutMs: 30_000 });
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      const parsed = parseFirecrawlScrapeResponse(await res.json().catch(() => null), 24_000);
      if (parsed.ok) {
        const requestedHost = new URL(url).hostname;
        const html = await safeFetchPage({
          url,
          resolveHost,
          maxBytes: 2_000_000,
          timeoutMs: 15_000,
          allowRedirect: (_from, to) => {
            try {
              const target = new URL(to);
              return sameSite(target.hostname, requestedHost) && (!robots?.body || isPathAllowed(robots.body, RESEARCH_USER_AGENT, target.pathname || "/"));
            } catch {
              return false;
            }
          },
        }).catch(() => null);
        const meta = html?.ok && /html/i.test(html.contentType) ? extractPageContent(html.body, html.finalUrl, { maxTextChars: 1_000, maxLinks: 50 }) : null;
        const htmlFinalUrl = html?.finalUrl ?? url;
        const htmlStatus = html?.status ?? 200;
        return {
          url: meta && html ? html.finalUrl : url,
          title: meta?.title ?? parsed.title,
          ...(meta?.metaDescription ? { description: meta.metaDescription } : {}),
          ...(meta?.canonicalUrl ? { canonicalUrl: meta.canonicalUrl } : {}),
          ...(meta?.robotsDirectives ? { robotsDirectives: meta.robotsDirectives } : {}),
          ...(meta?.crawlerRobotsDirectives ? { crawlerRobotsDirectives: meta.crawlerRobotsDirectives } : {}),
          ...(meta ? {
            headings: meta.headings.slice(0, 12).map((heading) => heading.text),
            headingCounts: { h1: meta.headings.filter((heading) => heading.level === 1).length, h2: meta.headings.filter((heading) => heading.level === 2).length, h3: meta.headings.filter((heading) => heading.level === 3).length },
            internalLinks: meta.links.slice(0, 30).map((link) => link.url),
            htmlLang: meta.htmlLang,
            viewportPresent: meta.viewportPresent,
            imageCount: meta.imageCount,
            imagesWithAltAttribute: meta.imagesWithAltAttribute,
            structuredDataTypes: meta.jsonLdTypes,
            htmlMetadataRead: true,
            searchReadiness: searchReadinessFor(meta, htmlFinalUrl, htmlStatus, html?.xRobotsTag, robots?.body, robots?.status ?? "unavailable"),
          } : { htmlMetadataRead: false }),
          text: parsed.markdown,
          status: "ok",
          prices: meta?.jsonLdPrices.map((price) => `${price.name ?? "Offer"}: ${price.price} ${price.currency ?? ""}`.trim()) ?? [],
        };
      }
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
  const htmlMetadataRead = /html/i.test(res.contentType);
  return {
    url: res.finalUrl,
    title: page.title,
    description: page.metaDescription,
    ...(page.canonicalUrl ? { canonicalUrl: page.canonicalUrl } : {}),
    ...(page.robotsDirectives ? { robotsDirectives: page.robotsDirectives } : {}),
    ...(page.crawlerRobotsDirectives ? { crawlerRobotsDirectives: page.crawlerRobotsDirectives } : {}),
    ...(htmlMetadataRead ? { headingCounts: { h1: page.headings.filter((heading) => heading.level === 1).length, h2: page.headings.filter((heading) => heading.level === 2).length, h3: page.headings.filter((heading) => heading.level === 3).length } } : {}),
    headings: page.headings.slice(0, 12).map((heading) => heading.text),
    internalLinks: page.links.slice(0, 30).map((link) => link.url),
    ...(page.htmlLang ? { htmlLang: page.htmlLang } : {}),
    ...(htmlMetadataRead ? { viewportPresent: page.viewportPresent, imageCount: page.imageCount, imagesWithAltAttribute: page.imagesWithAltAttribute, structuredDataTypes: page.jsonLdTypes, htmlMetadataRead: true, searchReadiness: searchReadinessFor(page, res.finalUrl, res.status, res.xRobotsTag, robots?.body, robots?.status ?? "unavailable") } : { htmlMetadataRead: false }),
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

/** Read a bounded number of declared/default sitemaps and retain same-site page URLs only. */
async function sitemapPages(origin: string, robots: string | null): Promise<string[]> {
  const rootHost = new URL(origin).hostname;
  const declared = (robots ?? "").split(/\r?\n/)
    .map((line) => /^\s*sitemap\s*:\s*(\S+)/i.exec(line)?.[1])
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      try {
        const parsed = new URL(url, origin);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") && sameSite(parsed.hostname, rootHost);
      } catch {
        return false;
      }
    });
  const queue = [...new Set([...declared, new URL("/sitemap.xml", origin).toString()])].slice(0, 4);
  const visited = new Set<string>();
  const pages: string[] = [];
  const pageSet = new Set<string>();
  while (queue.length && visited.size < 4 && pages.length < 500) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    try {
      const parsed = new URL(sitemapUrl);
      if (!sameSite(parsed.hostname, rootHost) || (robots && !isPathAllowed(robots, RESEARCH_USER_AGENT, parsed.pathname || "/"))) continue;
    } catch {
      continue;
    }
    visited.add(sitemapUrl);
    const result = await safeFetchPage({
      url: sitemapUrl,
      resolveHost,
      maxBytes: 1_000_000,
      timeoutMs: 10_000,
      allowRedirect: (_from, to) => {
        try { return sameSite(new URL(to).hostname, rootHost); } catch { return false; }
      },
    }).catch(() => null);
    if (!result?.ok || !sameSite(new URL(result.finalUrl).hostname, rootHost) || !/xml|text\/plain/i.test(result.contentType)) continue;
    for (const location of parseSitemapLocations(result.body, result.finalUrl, 500)) {
      const parsed = new URL(location);
      if (!sameSite(parsed.hostname, rootHost)) continue;
      if (/\.xml$/i.test(parsed.pathname) && /sitemap/i.test(parsed.pathname)) {
        if (!visited.has(location) && queue.length + visited.size < 4) queue.push(location);
      } else if (!pageSet.has(location)) {
        pageSet.add(location);
        pages.push(location);
        if (pages.length >= 500) break;
      }
    }
  }
  return pages;
}

export async function researchWebsite(website: string, extraPages: number): Promise<{ pages: ResearchedPage[]; pagesFetched: number; discoveredCandidates: number }> {
  const url = normalizeWebsite(website);
  if (!url) return { pages: [{ url: website, text: "", status: "failed", error: "That doesn't look like a public website address.", prices: [] }], pagesFetched: 0, discoveredCandidates: 0 };
  const origin = new URL(url).origin;
  const robotsRead = await robotsFor(origin).catch((): RobotsRead => ({ status: "unavailable", body: null }));
  const robots = robotsRead.body;
  const allowed = (u: string) => !robots || isPathAllowed(robots, RESEARCH_USER_AGENT, new URL(u).pathname || "/");

  const pages: ResearchedPage[] = [];
  let fetched = 0;
  if (!allowed(url)) {
    return { pages: [{ url, text: "", status: "blocked_by_robots", prices: [] }], pagesFetched: 0, discoveredCandidates: 1 };
  }
  const home = await fetchOne(url, robotsRead);
  fetched++;
  pages.push(home);
  if (home.status !== "ok" || extraPages <= 0) return { pages, pagesFetched: fetched, discoveredCandidates: 1 };

  // Combine robots-declared sitemap URLs with same-origin homepage links. Both are
  // discovery hints only; neither proves that a search engine indexed a page.
  const [htmlRes, sitemapUrls] = await Promise.all([
    safeFetchPage({ url, resolveHost, maxBytes: 2_000_000, timeoutMs: 10_000 }).catch(() => null),
    sitemapPages(origin, robots),
  ]);
  const links = htmlRes?.ok ? extractPageContent(htmlRes.body, htmlRes.finalUrl, { maxLinks: 300 }).links : [];
  const seen = new Set([url.replace(/\/$/, ""), (htmlRes?.ok ? htmlRes.finalUrl : url).replace(/\/$/, "")]);
  // The site may redirect (involets.com → www.involets.com): links count as the same site either way.
  const siteHost = new URL(htmlRes?.ok ? htmlRes.finalUrl : url).hostname;
  const unique = [...new Set([...sitemapUrls, ...links.map((l) => l.url)].map((link) => link.split("#")[0].replace(/\/$/, "")))];
  const ranked = unique
    .map((u) => {
      try {
        const parsed = new URL(u);
        return sameSite(parsed.hostname, siteHost) && !seen.has(u) ? { u, rank: pageRank(parsed.pathname) } : null;
      } catch {
        return null;
      }
    })
    .filter((c): c is { u: string; rank: number } => c !== null)
    // Most useful kind first; within a kind, the shortest (top-level) path.
    .sort((a, b) => a.rank - b.rank || a.u.length - b.u.length);
  // This is the number of distinct same-site candidates found in the bounded
  // sitemap/homepage-link inventory, not a claim that every site URL was found.
  const discoveredCandidates = ranked.length + 1;
  // One page of each kind before a second page of any kind.
  const firsts = ranked.filter((c, i, all) => all.findIndex((x) => x.rank === c.rank) === i);
  const candidates = [...firsts, ...ranked.filter((c) => !firsts.includes(c))].slice(0, extraPages).map((c) => c.u);
  for (const c of candidates) {
    seen.add(c.replace(/\/$/, ""));
    if (!allowed(c)) {
      pages.push({ url: c, text: "", status: "blocked_by_robots", prices: [] });
      continue;
    }
    pages.push(await fetchOne(c, robotsRead));
    fetched++;
  }
  return { pages, pagesFetched: fetched, discoveredCandidates };
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
  const robots = new Map<string, RobotsRead>();
  await Promise.all(
    targets.map(async (u) => {
      const url = normalizeWebsite(u);
      if (!url) return;
      const origin = new URL(url).origin;
      if (!robots.has(origin)) robots.set(origin, await robotsFor(origin).catch((): RobotsRead => ({ status: "unavailable", body: null })));
      const r = robots.get(origin);
      if (r?.body && !isPathAllowed(r.body, RESEARCH_USER_AGENT, new URL(url).pathname || "/")) {
        out[key(u)] = null;
        return;
      }
      const page = await fetchOne(url, r).catch(() => null);
      out[key(u)] = page?.status === "ok" ? `${page.text}\n${page.prices.join("\n")}` : null;
    }),
  );
  return out;
}
