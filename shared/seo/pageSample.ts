export interface ReadinessPageSample {
  url: string;
  status: "read" | "blocked_by_robots" | "failed";
  checkedAt: number;
  visibleText: string;
  internalLinks: string[];
  /** Includes observed external profile links; older samples may not have these. */
  observedLinks?: string[];
  findings: { id: string; level: "check" | "attention"; title: string; evidence: string; nextStep: string }[];
}

/** A bounded link sample is not a whole-site orphan detector. */
export function addSampleLinkFindings(pages: ReadinessPageSample[]): ReadinessPageSample[] {
  const read = pages.filter((page) => page.status === "read");
  if (read.length < 2) return pages;
  const key = (url: string) => { const parsed = new URL(url); parsed.hash = ""; return parsed.toString().replace(/\/$/, ""); };
  return pages.map((page, index) => index === 0 || page.status !== "read" || read.some((other) => other.url !== page.url && other.internalLinks.some((url) => key(url) === key(page.url))) ? page : { ...page, findings: [...page.findings, { id: "no-observed-incoming-link", level: "check", title: "No link into this page was observed in the sample", evidence: "Other sampled pages did not link to this URL. Links elsewhere on the site are not known.", nextStep: "Check navigation and relevant related pages. This sample cannot establish that the page is orphaned." }] });
}
