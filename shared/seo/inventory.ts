export type SiteInventoryFinding = { id: string; level: "check" | "attention"; title: string; evidence: string; nextStep: string };
export type SiteInventoryPage = {
  url: string;
  status: "read" | "blocked_by_robots" | "failed";
  metadataState: "observed" | "unavailable";
  titleLength: number | null;
  descriptionLength: number | null;
  headingCounts: { h1: number; h2: number; h3: number } | null;
  canonicalUrl: string | null;
  robotsDirectives: string | null;
  structuredDataTypes: string[] | null;
  findings: SiteInventoryFinding[];
};
export type SiteInventorySnapshot = {
  runId: string;
  checkedAt: number;
  website: string;
  discoveredCandidates: number;
  pagesSampled: number;
  pagesRead: number;
  pagesWithStaticHtml: number;
  state: "measured" | "partial" | "unavailable";
  pages: SiteInventoryPage[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function text(value: unknown, max = 2_000): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

function sameSite(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    if (!["http:", "https:"].includes(left.protocol) || !["http:", "https:"].includes(right.protocol) || left.username || left.password || right.username || right.password) return false;
    return left.hostname.toLowerCase().replace(/^www\./, "") === right.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
}

function finding(value: unknown): SiteInventoryFinding | null {
  const item = record(value);
  if (!item || (item.level !== "check" && item.level !== "attention")) return null;
  const id = text(item.id, 120);
  const title = text(item.title, 300);
  const evidence = text(item.evidence, 1_000);
  const nextStep = text(item.nextStep, 1_000);
  return id && title && evidence && nextStep ? { id, level: item.level, title, evidence, nextStep } : null;
}

/** Read only bounded, same-site page observations from a saved verified audit output. */
export function extractSiteInventory(input: { output: string; runId: string; checkedAt: number; website: string }): SiteInventorySnapshot | null {
  let parsed: unknown;
  try { parsed = JSON.parse(input.output); } catch { return null; }
  const root = record(parsed);
  const audit = record(root?.auditCoverage);
  const coverage = record(audit?.website);
  const readiness = record(audit?.seoReadiness);
  const observedWebsite = text(coverage?.requestedUrl);
  if (!observedWebsite || !sameSite(observedWebsite, input.website)) return null;

  const readinessPages = Array.isArray(readiness?.pages) ? readiness.pages : [];
  const readinessByUrl = new Map<string, Record<string, unknown>>();
  for (const value of readinessPages) {
    const page = record(value);
    const url = text(page?.url);
    if (page && url && sameSite(url, input.website)) readinessByUrl.set(urlKey(url), page);
  }
  const findingsByUrl = new Map<string, SiteInventoryFinding[]>();
  for (const value of Array.isArray(readiness?.findings) ? readiness.findings : []) {
    const item = record(value);
    const url = text(item?.pageUrl);
    const parsedFinding = finding(item);
    if (!url || !sameSite(url, input.website) || !parsedFinding) continue;
    const key = urlKey(url);
    findingsByUrl.set(key, [...(findingsByUrl.get(key) ?? []), parsedFinding]);
  }
  const rawPages = Array.isArray(coverage?.pages) ? coverage.pages.slice(0, 10) : [];
  const pages: SiteInventoryPage[] = [];
  for (const value of rawPages) {
    const raw = record(value);
    const url = text(raw?.url);
    const status = raw?.status;
    if (!url || !sameSite(url, input.website) || (status !== "read" && status !== "blocked_by_robots" && status !== "failed")) continue;
    const key = urlKey(url);
    const observed = status === "read" ? readinessByUrl.get(key) : undefined;
    const heading = record(observed?.headingCounts);
    pages.push({
      url,
      status,
      metadataState: observed?.metadataState === "observed" ? "observed" : "unavailable",
      titleLength: observed?.titleLength === null || typeof observed?.titleLength === "number" ? observed.titleLength : null,
      descriptionLength: observed?.descriptionLength === null || typeof observed?.descriptionLength === "number" ? observed.descriptionLength : null,
      headingCounts: heading && [heading.h1, heading.h2, heading.h3].every((value) => typeof value === "number")
        ? { h1: count(heading.h1), h2: count(heading.h2), h3: count(heading.h3) }
        : null,
      canonicalUrl: text(observed?.canonicalUrl),
      robotsDirectives: text(observed?.robotsDirectives, 500),
      structuredDataTypes: Array.isArray(observed?.structuredDataTypes) ? observed.structuredDataTypes.slice(0, 20).filter((item): item is string => typeof item === "string" && item.length <= 200) : null,
      findings: findingsByUrl.get(key)?.slice(0, 20) ?? [],
    });
  }
  const state = readiness?.state === "measured" || readiness?.state === "partial" ? readiness.state : "unavailable";
  return {
    runId: input.runId,
    checkedAt: count(input.checkedAt),
    website: observedWebsite,
    discoveredCandidates: count(coverage?.discoveredCandidates),
    pagesSampled: count(coverage?.pagesSampled),
    pagesRead: count(coverage?.pagesRead),
    pagesWithStaticHtml: count(readiness?.pagesWithStaticHtml),
    state,
    pages,
  };
}
import { urlKey } from "../agents/provenance";

