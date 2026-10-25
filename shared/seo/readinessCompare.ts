/**
 * Side-by-side search readiness for the business and its monitored competitors, limited to checks that can be
 * read from a homepage's HTML alone (competitors have no crawler-rule or robots evidence). Observable signals only;
 * not a ranking or visibility comparison.
 */

export const PAGE_CHECKS: { id: string; title: string }[] = [
  { id: "missing-title", title: "Page title" },
  { id: "long-title", title: "Title length" },
  { id: "missing-description", title: "Search description" },
  { id: "missing-h1", title: "Main heading" },
  { id: "multiple-h1", title: "Single main heading" },
  { id: "heading-order", title: "Heading order" },
  { id: "no-structured-data", title: "Structured data" },
  { id: "invalid-json-ld", title: "Valid structured data" },
  { id: "missing-viewport", title: "Mobile viewport" },
  { id: "missing-document-language", title: "Page language" },
  { id: "missing-image-alt", title: "Image descriptions" },
  { id: "thin-readable-content", title: "Readable text" },
];
const PAGE_IDS = new Set(PAGE_CHECKS.map((c) => c.id));

export type CheckStatus = "ok" | "attention" | "unknown";
export interface SiteReadiness { name: string; checkedAt: number | null; findingIds: string[] | null }

export function compareReadiness(own: SiteReadiness, competitors: readonly SiteReadiness[]): { checks: { id: string; title: string; you: CheckStatus; competitors: { name: string; status: CheckStatus }[] }[]; youBehind: string[] } {
  const status = (s: SiteReadiness, id: string): CheckStatus => (s.findingIds === null ? "unknown" : s.findingIds.filter((f) => PAGE_IDS.has(f)).includes(id) ? "attention" : "ok");
  const checks = PAGE_CHECKS.map((c) => ({ id: c.id, title: c.title, you: status(own, c.id), competitors: competitors.map((x) => ({ name: x.name, status: status(x, c.id) })) }));
  return {
    checks,
    // Checks where the business needs attention but at least one competitor passes.
    youBehind: checks.filter((c) => c.you === "attention" && c.competitors.some((x) => x.status === "ok")).map((c) => c.title),
  };
}
