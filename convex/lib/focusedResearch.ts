import { fitText, reportDropped } from "../../shared/agents/context";

type Page = { url?: string; excerpt?: string; fetchedAt: number };
type Research = { notes: string; retrievedAt?: number };
const HEADER = "Previously collected public-source evidence and AI research notes. Preserve source claims, inferences and uncertainty; this is not independent product testing or measured demand. Each retrieval date belongs only to its own record; it is not a publication date. Listed URLs alone do not establish unseen claims. Keep conflicting records distinguishable.";

function dated(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? new Date(value).toISOString() : "unknown";
}

/** Caller supplies only already-scoped, unexpired successful reads and same-business cache rows. */
export function focusedResearchNotes(pages: readonly Page[], cached: readonly Research[]): string {
  const pageText = pages.map(page => `FIRST-PARTY PAGE EXCERPT ${page.url}\nRetrieved ${dated(page.fetchedAt)}; source-reported, not product-tested.\n${page.excerpt?.trim() || "No page text retained. Use only separately supplied facts for detailed claims."}`).join("\n\n");
  // Retain actual source text even when a summary exists, within the previous total context ceiling.
  const boundedPages = reportDropped("focused saved page excerpts", fitText(pageText, 12000, "page excerpts"));
  const cacheText = cached.map(row => `CACHED AI RESEARCH NOTES\nRetrieved ${dated(row.retrievedAt)}; summary claims and inferences, not a fresh page read.\n${row.notes}`).join("\n\n");
  const boundedCache = reportDropped("focused cached research", fitText(cacheText, 30000 - HEADER.length - boundedPages.length - 4, "cached notes"));
  return [HEADER, boundedPages, boundedCache].filter(Boolean).join("\n\n");
}
