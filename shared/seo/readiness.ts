import type { ExtractedPage } from "../integrations/website";

export type ReadinessFinding = {
  id: string;
  level: "check" | "attention";
  title: string;
  evidence: string;
  nextStep: string;
};

/** Observable page checks only. This deliberately does not predict ranking or citation. */
export function assessSearchReadiness(page: ExtractedPage): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  if (!page.title?.trim()) findings.push({ id: "missing-title", level: "attention", title: "Page title is missing", evidence: "No document title was found in the homepage HTML.", nextStep: "Add a short, specific title that describes the business and its main offer." });
  else if (page.title.trim().length > 60) findings.push({ id: "long-title", level: "check", title: "Page title may be hard to scan", evidence: `The title has ${page.title.trim().length} characters.`, nextStep: "Review whether the title can describe the page more directly and briefly." });
  if (!page.metaDescription?.trim()) findings.push({ id: "missing-description", level: "attention", title: "Search description is missing", evidence: "No meta description was found in the homepage HTML.", nextStep: "Write a plain-language summary of the offer and who it helps." });
  if (!page.headings.some((heading) => heading.level === 1)) findings.push({ id: "missing-h1", level: "attention", title: "Main page heading was not found", evidence: "No H1 heading was found in the extracted homepage HTML.", nextStep: "Use one visible main heading that clearly states what the business offers." });
  const h1s = page.headings.filter((heading) => heading.level === 1);
  if (h1s.length > 1) findings.push({ id: "multiple-h1", level: "check", title: "Several main headings were found", evidence: `${h1s.length} H1 headings were extracted.`, nextStep: "Check that the page has one clear primary heading; keep section headings at lower levels." });
  const skipped = page.headings.some((heading, index) => index > 0 && heading.level > (page.headings[index - 1]?.level ?? heading.level) + 1);
  if (skipped) findings.push({ id: "heading-order", level: "check", title: "Heading levels skip a step", evidence: "At least one heading jumps over an intermediate level.", nextStep: "Arrange section headings in order so the page outline is easier to follow." });
  if (page.text.trim().length < 200) findings.push({ id: "thin-readable-content", level: "check", title: "Little page text was readable", evidence: `Only ${page.text.trim().length} characters of visible text were extracted.`, nextStep: "Make the core offer, audience, and useful details available as readable page text." });
  if (!page.jsonLdTypes.length) findings.push({ id: "no-structured-data", level: "check", title: "No structured data was detected", evidence: "No JSON-LD @type values were extracted from the homepage.", nextStep: "If it fits the business, add accurate structured data that matches visible page content." });
  return findings;
}
