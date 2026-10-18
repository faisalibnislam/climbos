"use node";

import { lookup, resolveMx } from "node:dns/promises";
import { CONTACT_PATH, domainOf, publishedEmails, type FoundEmail } from "../../shared/outbound";
import { extractPageContent, isPathAllowed, RESEARCH_USER_AGENT, safeFetchPage } from "../../shared/integrations/website";
import { normalizeWebsite } from "./research";

/**
 * Checks one prospect with our own fetcher (no data vendor): is the website
 * real and live, which emails does it publish (homepage + up to 2 contact
 * pages), and can its domain receive email (MX records). Robots rules are
 * respected; nothing is guessed.
 */

async function resolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export interface ProspectCheck {
  live: boolean;
  finalUrl: string | null;
  emails: FoundEmail[];
  mxOk: boolean | null;
  pagesFetched: number;
}

export async function checkProspect(website: string): Promise<ProspectCheck> {
  const url = normalizeWebsite(website);
  const out: ProspectCheck = { live: false, finalUrl: null, emails: [], mxOk: null, pagesFetched: 0 };
  if (!url) return out;
  const origin = new URL(url).origin;
  const robotsRes = await safeFetchPage({ url: `${origin}/robots.txt`, resolveHost, maxBytes: 200_000, timeoutMs: 6000 }).catch(() => null);
  const robots = robotsRes?.ok ? robotsRes.body : null;
  const allowed = (u: string) => !robots || isPathAllowed(robots, RESEARCH_USER_AGENT, new URL(u).pathname || "/");
  const pages: { url: string; text: string }[] = [];
  const home = allowed(url) ? await safeFetchPage({ url, resolveHost, maxBytes: 1_500_000, timeoutMs: 10_000 }).catch(() => null) : null;
  out.pagesFetched++;
  if (home?.ok && /html/i.test(home.contentType)) {
    out.live = true;
    out.finalUrl = home.finalUrl;
    pages.push({ url: home.finalUrl, text: home.body });
    const links = extractPageContent(home.body, home.finalUrl, { maxLinks: 80 }).links.map((l) => l.url);
    const contact = [...new Set(links.filter((u) => {
      try {
        const p = new URL(u);
        return p.origin === new URL(home.finalUrl).origin && CONTACT_PATH.test(p.pathname);
      } catch {
        return false;
      }
    }))].slice(0, 2);
    for (const c of contact) {
      if (!allowed(c)) continue;
      const r = await safeFetchPage({ url: c, resolveHost, maxBytes: 1_500_000, timeoutMs: 8000 }).catch(() => null);
      out.pagesFetched++;
      if (r?.ok) pages.push({ url: r.finalUrl, text: r.body });
    }
  }
  const domain = domainOf(out.finalUrl ?? url);
  out.emails = publishedEmails(pages, domain);
  try {
    out.mxOk = (await resolveMx(domain)).length > 0;
  } catch {
    out.mxOk = false;
  }
  return out;
}

/** Check many prospects with a small concurrency, within a time budget. */
export async function checkProspects(websites: string[], budgetMs = 120_000): Promise<Map<string, ProspectCheck>> {
  const results = new Map<string, ProspectCheck>();
  const deadline = Date.now() + budgetMs;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, websites.length) }, async () => {
      while (next < websites.length && Date.now() < deadline) {
        const w = websites[next++];
        results.set(w, await checkProspect(w).catch(() => ({ live: false, finalUrl: null, emails: [], mxOk: null, pagesFetched: 1 })));
      }
    }),
  );
  return results;
}
