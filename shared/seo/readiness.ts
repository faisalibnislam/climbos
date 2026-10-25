import type { ExtractedPage } from "../integrations/website";

export type ReadinessFinding = {
  id: string;
  level: "check" | "attention";
  title: string;
  evidence: string;
  nextStep: string;
};

export type CrawlerCheck = {
  crawler: "Googlebot" | "Bingbot" | "OAI-SearchBot" | "PerplexityBot" | "Claude-SearchBot" | "GPTBot" | "ClaudeBot" | "Google-Extended";
  allowed: boolean;
};
export const AI_DATA_USE_TOKENS: ReadonlySet<CrawlerCheck["crawler"]> = new Set(["GPTBot", "ClaudeBot", "Google-Extended"]);
export const SEARCH_CRAWLERS = ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"] as const;
export const AI_DATA_USE_CONTROLS = ["GPTBot", "ClaudeBot", "Google-Extended"] as const;
export type TechnicalEvidence = {
  httpStatus: number;
  canonicalUrl?: string;
  pageUrl: string;
  robotsDirectives?: string;
  xRobotsTag?: string;
  robotsFileStatus: "available" | "not_found" | "unavailable";
  crawlerChecks: CrawlerCheck[];
};

/** Observable page checks only. This deliberately does not predict ranking or citation. */
export function assessSearchReadiness(page: ExtractedPage, technical?: TechnicalEvidence): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  if (technical) {
    if (technical.httpStatus < 200 || technical.httpStatus >= 300) findings.push({ id: "http-status", level: "attention", title: "Page did not return a successful response", evidence: `The checked page returned HTTP ${technical.httpStatus}.`, nextStep: "Check the public page response and redirect destination, then confirm the page is available to visitors and crawlers." });
    const directives = `${technical.robotsDirectives ?? ""},${technical.xRobotsTag ?? ""}`.split(/[\s,]+/).map((item) => item.trim().toLowerCase());
    if (directives.includes("noindex") || directives.includes("none")) findings.push({ id: "page-noindex", level: "attention", title: "A noindex directive was found for this page", evidence: `The checked page includes the directive “${directives.includes("none") ? "none" : "noindex"}” (${[technical.robotsDirectives, technical.xRobotsTag ? `X-Robots-Tag: ${technical.xRobotsTag}` : undefined].filter(Boolean).join("; ")}).`, nextStep: "Review which crawlers the directive applies to, and remove it only if you want those crawlers to index the page." });
    if (technical.canonicalUrl) {
      try {
        if (new URL(technical.canonicalUrl).origin !== new URL(technical.pageUrl).origin) findings.push({ id: "cross-site-canonical", level: "check", title: "The page canonical points to another site", evidence: `The declared canonical is ${technical.canonicalUrl}.`, nextStep: "Confirm this cross-site canonical is intentional; otherwise set it to the preferred URL for this page." });
      } catch { /* malformed values are not actionable evidence */ }
    }
    if (technical.robotsFileStatus === "available") for (const crawler of technical.crawlerChecks) {
      if (!crawler.allowed) {
        const dataUseControl = AI_DATA_USE_TOKENS.has(crawler.crawler);
        findings.push({
          id: `robots-${crawler.crawler.toLowerCase()}`,
          level: "attention",
          title: `${crawler.crawler} is disallowed by robots.txt`,
          evidence: `The fetched robots.txt rules disallow ${crawler.crawler} from the checked page path.`,
          nextStep: dataUseControl
            ? `This token controls provider data use (training or grounding), not ordinary search visibility. Review it against your content-use preference.`
            : `If you want ${crawler.crawler} to discover or cite this public page, review the matching robots.txt rule. This is an access prerequisite, not a guarantee of indexing or citation.`,
        });
      }
    }
    if (technical.robotsFileStatus === "unavailable") findings.push({ id: "robots-unavailable", level: "check", title: "Crawler rules could not be verified", evidence: "ClimbOS could not retrieve a successful robots.txt response for this site.", nextStep: "Check that robots.txt is reachable. This check cannot verify CDN, firewall, or crawler IP rules." });
  }
  if (!page.title?.trim()) findings.push({ id: "missing-title", level: "attention", title: "Page title is missing", evidence: "No document title was found in the fetched page HTML.", nextStep: "Add a short, specific title that describes the page and its main offer." });
  else if (page.title.trim().length > 60) findings.push({ id: "long-title", level: "check", title: "Page title may be hard to scan", evidence: `The title has ${page.title.trim().length} characters.`, nextStep: "Review whether the title can describe the page more directly and briefly." });
  if (!page.htmlLang?.trim()) findings.push({ id: "missing-document-language", level: "check", title: "Document language was not declared", evidence: "The fetched HTML does not declare a non-empty language on its html element.", nextStep: "Declare the page's primary language on the html element so assistive technology can choose an appropriate pronunciation. Verify pages with multiple languages separately." });
  if (!page.metaDescription?.trim()) findings.push({ id: "missing-description", level: "attention", title: "Search description is missing", evidence: "No meta description was found in the fetched page HTML.", nextStep: "Write a plain-language summary of the page offer and who it helps." });
  if (!page.headings.some((heading) => heading.level === 1)) findings.push({ id: "missing-h1", level: "attention", title: "Main page heading was not found", evidence: "No H1 heading was found in the fetched page HTML.", nextStep: "Use one visible main heading that clearly states what the page offers." });
  const h1s = page.headings.filter((heading) => heading.level === 1);
  if (h1s.length > 1) findings.push({ id: "multiple-h1", level: "check", title: "Several main headings were found", evidence: `${h1s.length} H1 headings were extracted.`, nextStep: "Check that the page has one clear primary heading; keep section headings at lower levels." });
  const skipped = page.headings.some((heading, index) => index > 0 && heading.level > (page.headings[index - 1]?.level ?? heading.level) + 1);
  if (skipped) findings.push({ id: "heading-order", level: "check", title: "Heading levels skip a step", evidence: "At least one heading jumps over an intermediate level.", nextStep: "Arrange section headings in order so the page outline is easier to follow." });
  if (page.text.trim().length < 200) findings.push({ id: "thin-readable-content", level: "check", title: "Little page text was readable", evidence: `Only ${page.text.trim().length} characters of visible text were extracted.`, nextStep: "Make the core offer, audience, and useful details available as readable page text." });
  const jsonLdErrors = page.jsonLdScriptParseErrors ?? 0;
  if (jsonLdErrors > 0) findings.push({ id: "invalid-json-ld", level: "attention", title: "A structured-data block could not be read", evidence: `${jsonLdErrors} of the inspected JSON-LD script block${jsonLdErrors === 1 ? " was" : "s were"} not valid JSON.`, nextStep: "Correct the JSON syntax, then validate the markup and confirm it matches content visible on the page. This syntax check does not establish rich-result eligibility or search visibility." });
  if (!page.jsonLdTypes.length && jsonLdErrors === 0) findings.push({ id: "no-structured-data", level: "check", title: "No JSON-LD structured data was detected", evidence: "This check found no JSON-LD @type values in the fetched page. It does not inspect Microdata or RDFa.", nextStep: "Before adding markup, check whether the page already uses another structured-data format. Add only accurate markup that matches visible content; do not add it solely to seek AI citations." });
  if (!page.viewportPresent) findings.push({ id: "missing-viewport", level: "check", title: "Responsive viewport metadata was not found", evidence: "The fetched HTML did not contain a non-empty viewport meta declaration.", nextStep: "Check the page on a phone and add a responsive viewport declaration if the delivered page is missing one." });
  if (page.imageCount > page.imagesWithAltAttribute) {
    const missingAlt = page.imageCount - page.imagesWithAltAttribute;
    findings.push({ id: "missing-image-alt", level: "check", title: "Some images have no alt attribute", evidence: `${missingAlt} of ${page.imageCount} extracted images lack an alt attribute.`, nextStep: "Add concise alt text to informative images and an empty alt attribute to decorative images; do not repeat keywords." });
  }
  return findings;
}
