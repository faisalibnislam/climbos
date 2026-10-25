"use client";

import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, ExternalLink, Globe, Megaphone } from "@/components/icons";
import { Badge, Button, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { Prose } from "@/components/ds/content";
import { errorMessage } from "@/components/app/errors";
import { formatDateTime } from "./money";

type VisualEvidence = { view?: string; sourceUrl?: string; observation?: string };
type Finding = { area?: string; observation?: string; recommendation?: string; impact?: string; sourceUrl?: string; evidenceQuote?: string; evidenceKind?: string; visualEvidence?: VisualEvidence };
type Fix = { fix?: string; pageUrl?: string; evidenceQuote?: string; why?: string; effort?: string; expectedEffect?: string; contentStructure?: string[]; sampleCopy?: string; uxChanges?: string[]; measurementPlan?: string; visualEvidence?: VisualEvidence };
type SocialFinding = { sourceArtifactId?: string; platform?: string; sourceType?: string; sourceUrl?: string; observation?: string; recommendation?: string; priority?: string };
type SocialMixSuggestion = { platform?: string; format?: string; concept?: string; fitHypothesis?: string; basis?: string; sourceArtifactIds?: string[]; testSignal?: string };
type ReviewedSocialPost = { sourceArtifactId?: string; platform?: string; sourceType?: string; sourceUrl?: string };
type SocialSourceCoverage = { source?: string; state?: string; postsReviewed?: number };
type SocialPostPerformance = { sourceArtifactId?: string; platform?: string; metrics?: { metric?: string; value?: number }[] };
type SeoReadinessFinding = { pageUrl?: string; level?: string; title?: string; evidence?: string; nextStep?: string };
type SeoReadinessPage = { url?: string; metadataState?: string; titleLength?: number | null; descriptionLength?: number | null; headingCounts?: { h1?: number; h2?: number; h3?: number } | null; canonicalUrl?: string | null; robotsDirectives?: string | null; structuredDataTypes?: string[] | null };
type Coverage = { requestedUrl?: string | null; discoveredCandidates?: number; pagesAttempted?: number; pagesRead?: number; pages?: { url?: string; status?: string }[]; visualReview?: { state?: string; views?: string[]; capturedAt?: number; screenshots?: { view?: string; width?: number; height?: number }[] } };
type DesignDirection = { id?: string; name?: string; responseLevel?: "quick_fix" | "considered_redesign" | "bold_alternative"; communicates?: string; tradeoff?: string; change?: string; previewBrief?: string; measurementPlan?: string; effort?: string; assumptions?: string[]; risks?: string[] };
type FindingStatus = "accepted" | "dismissed" | "deferred" | "resolved" | "reopened" | "corrected" | "needs_information";
type FindingReview = { findingIndex: number; status?: FindingStatus; note: string; sourceUrl?: string; evidenceRef?: string; viewport?: string | null; screenshotCapturedAt?: number | null; selectedDirectionId?: string | null; selectedDirectionName?: string | null; selectedDirectionAt?: number | null; updatedAt: number };
type AuditScreenshot = { view: "desktop" | "mobile"; pageUrl: string; width: number; height: number; capturedAt: number; url: string | null };
type DesignFinding = { lens?: string; classification?: string; region?: string; observation?: string; businessOrUserGoal?: string; whyItMatters?: string; severity?: string; confidence?: string; evidence?: string; sourceUrl?: string; proposedChange?: string; directions?: DesignDirection[]; visualEvidence?: { view?: string; observation?: string }; automatedCheckIds?: string[]; requiresHumanEvaluation?: boolean };

const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const label = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

export function ConversionAuditView({ value, slug, runId }: { value: unknown; slug: string; runId: Id<"workflowRuns"> }) {
  const data = obj(value);
  const coverage = obj(data.auditCoverage);
  const website = obj(coverage.website) as Coverage;
  const websiteVisualReview = obj(website.visualReview);
  const performance = obj(coverage.performance);
  const seoReadiness = obj(coverage.seoReadiness);
  const seoFindings = list<SeoReadinessFinding>(seoReadiness.findings);
  const accessibility = obj(seoReadiness.accessibility);
  const accessibilityFindings = list<SeoReadinessFinding>(accessibility.findings);
  const seoPages = list<SeoReadinessPage>(seoReadiness.pages);
  const fieldData = obj(performance.fieldData);
  const labData = obj(performance.labData);
  const fieldMetrics = list<{ id?: string; label?: string; value?: number; unit?: string; verdict?: string }>(fieldData.metrics);
  const labMetrics = list<{ id?: string; label?: string; displayValue?: string }>(labData.metrics);
  const labOpportunities = list<{ id?: string; title?: string; displayValue?: string | null; description?: string }>(labData.opportunities);
  const labAccessibility = obj(labData.accessibility);
  const labAccessibilityChecks = list<{ id?: string; title?: string; displayValue?: string | null; description?: string }>(labAccessibility.failedChecks);
  const labSeo = obj(labData.seo);
  const labSeoChecks = list<{ id?: string; title?: string; displayValue?: string | null; description?: string }>(labSeo.failedChecks);
  const search = obj(coverage.searchConsole);
  const social = obj(coverage.social);
  const socialPostPerformance = list<SocialPostPerformance>(social.postPerformance);
  const findings = list<Finding>(data.findings);
  const fixes = list<Fix>(data.prioritizedFixes);
  const socialReview = obj(data.socialReview);
  const socialFindings = list<SocialFinding>(socialReview.findings);
  const socialMixSuggestions = list<SocialMixSuggestion>(socialReview.contentMixSuggestions);
  const reviewedSocialPosts = new Map(list<ReviewedSocialPost>(socialReview.reviewedPosts).map((post) => [String(post.sourceArtifactId), post]));
  const socialSources = list<SocialSourceCoverage>(socialReview.coverage);
  const pages = list<unknown>(website.pages);
  const limitations = list<string>(coverage.limitations);
  const designCritic = obj(data.designCritic);
  const designFindings = list<DesignFinding>(designCritic.findings);
  const approvedBrand = useQuery(api.brand.get, { slug });
  const [creativeRanges, setCreativeRanges] = useState<Record<number, "safer" | "distinctive" | "unconventional">>({});
  const [essentialElements, setEssentialElements] = useState<Record<number, string>>({});
  const [selectDirectionBusy, setSelectDirectionBusy] = useState<string | null>(null);
  const selectDirection = useMutation(api.designCritic.selectDirection);
  const findingReview = useQuery(api.designCritic.feedback, { slug, runId });
  const reviewsByIndex = new Map((findingReview?.rows ?? []).map((row) => [row.findingIndex, row as FindingReview]));

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-line bg-surface-2/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Globe aria-hidden className="size-4 text-brand-800" />What this review covered</div>
        <p className="mt-2 text-sm text-ink-2">Website: {Number(website.pagesRead ?? 0)} of {Number(website.pagesAttempted ?? 0)} sampled pages read{typeof website.discoveredCandidates === "number" ? `; ${website.discoveredCandidates} same-site page candidates found in the sitemap and homepage links` : ""}. This is a bounded sample, not a complete crawl. Social: {Number(social.postsReviewed ?? social.publishedPostsReviewed ?? 0)} posts sampled; visual review of {Number(social.visualPostsReviewed ?? 0)} Instagram still images when available. A still image does not represent a full carousel or video. Instagram insights: {social.instagramInsightsState === "reviewed" ? `metrics returned for ${Number(social.instagramPostsWithInsights ?? 0)} sampled posts` : social.instagramInsightsState === "not_authorized" ? "permission not granted" : social.instagramInsightsState === "no_posts" ? "no sampled posts" : social.instagramInsightsState === "unavailable" ? "not returned for this sample" : "not connected"}. Facebook counts, when present, are post-level reaction/comment/share snapshots. Neither source gives account-wide analytics here.</p>
        {search.state === "matched_to_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console: {Number(search.observedRows ?? 0)} observations for pages read, {label(search.startDate)} to {label(search.endDate)}. These are search activity, not conversions.</p> : search.state === "not_used_property_mismatch" ? <p className="mt-2 text-xs text-ink-3">Search Console data was left out because its property did not match this business website.</p> : search.state === "property_matched_no_rows_for_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console property matched, but no stored observations matched the pages read in this audit.</p> : null}
        {website.requestedUrl ? <a href={String(website.requestedUrl)} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">{String(website.requestedUrl)} <ExternalLink aria-hidden className="size-3" /></a> : <p className="mt-2 text-xs text-ink-3">No website address was saved for this business.</p>}
        {pages.length > 0 ? <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-2">{pages.map((raw, i) => { const page = obj(raw); return <li key={`${String(page.url)}-${i}`} className="flex flex-wrap items-center gap-2"><Badge tone={page.status === "read" ? "green" : "amber"}>{label(page.status, "not read").replaceAll("_", " ")}</Badge><span className="break-all">{label(page.url)}</span></li>; })}</ul> : null}
        {websiteVisualReview.state ? <p className="mt-2 text-xs text-ink-3">Visual website sample: {websiteVisualReview.state === "reviewed" ? `one page captured in ${(Array.isArray(websiteVisualReview.views) ? websiteVisualReview.views : []).join(" and ")} view${Array.isArray(websiteVisualReview.views) && websiteVisualReview.views.length === 1 ? "" : "s"}${Array.isArray(websiteVisualReview.screenshots) ? ` (${websiteVisualReview.screenshots.map((shot) => `${shot.view} ${shot.width}×${shot.height}`).join(", ")})` : ""}${typeof websiteVisualReview.capturedAt === "number" ? ` at ${formatDateTime(websiteVisualReview.capturedAt)}` : ""}` : websiteVisualReview.state === "unavailable" ? `screenshot unavailable${typeof websiteVisualReview.capturedAt === "number" ? `; attempted at ${formatDateTime(websiteVisualReview.capturedAt)}` : ""}` : "not attempted"}. Screenshots are synthetic snapshots, not customer behavior.</p> : null}
      </section>

      {seoReadiness.state ? <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="heading-section">Search readiness checks</h3><p className="mt-1 text-xs text-ink-3">ClimbOS&apos;s existing checks applied to sampled static HTML. They do not prove indexing or ranking.</p></div><Badge tone={seoReadiness.state === "measured" ? "green" : "amber"}>{Number(seoReadiness.pagesWithStaticHtml ?? 0)} of {Number(seoReadiness.pagesSampled ?? 0)} pages inspected</Badge></div>
        {seoFindings.length ? <ul className="mt-3 grid gap-2">{seoFindings.map((finding, i) => <li key={`${finding.pageUrl}-${finding.title}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.level === "attention" ? "amber" : "neutral"}>{label(finding.level, "check").replaceAll("_", " ")}</Badge><span className="text-sm font-medium text-ink">{label(finding.title, "Search readiness check")}</span></div>{finding.evidence ? <p className="mt-2 text-sm text-ink-2">{finding.evidence}</p> : null}{finding.nextStep ? <p className="mt-1 text-sm text-ink">{finding.nextStep}</p> : null}{finding.pageUrl ? <a href={finding.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex break-all text-xs text-link">Open checked page <ExternalLink aria-hidden className="ml-1 size-3" /></a> : null}</li>)}</ul> : seoReadiness.state === "unavailable" ? <p className="mt-3 text-sm text-ink-2">Static HTML metadata was unavailable for the pages read in this audit.</p> : <p className="mt-3 text-sm text-ink-2">No issues were found in the search readiness checks run on these sampled pages.</p>}
        {seoPages.some((page) => page.metadataState === "unavailable") ? <p className="mt-2 text-xs text-ink-3">Some page metadata could not be read, so no finding was inferred for those pages.</p> : null}
        {seoPages.filter((page) => page.metadataState === "observed").length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-link">Show observed page signals</summary><ul className="mt-2 grid gap-2">{seoPages.filter((page) => page.metadataState === "observed").map((page, i) => <li key={`${page.url}-${i}`} className="rounded-md border border-line p-3 text-xs text-ink-2"><a href={page.url} target="_blank" rel="noreferrer noopener" className="break-all text-link">{label(page.url)}</a><p className="mt-1">Title: {page.titleLength ?? 0} characters · Description: {page.descriptionLength ?? 0} characters · H1/H2/H3: {Number(page.headingCounts?.h1 ?? 0)}/{Number(page.headingCounts?.h2 ?? 0)}/{Number(page.headingCounts?.h3 ?? 0)}</p><p className="mt-1">Canonical: {page.canonicalUrl ? <a href={page.canonicalUrl} target="_blank" rel="noreferrer noopener" className="text-link">declared</a> : "not observed"} · Robots: {label(page.robotsDirectives, "not observed")}</p>{page.structuredDataTypes?.length ? <p className="mt-1">Structured data types observed: {page.structuredDataTypes.join(", ")}</p> : null}</li>)}</ul></details> : null}
        <div className="mt-4 border-t border-line pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold text-ink">Synthetic mobile SEO checks · Lighthouse</h4><p className="mt-1 text-xs text-ink-3">Automated page-level checks; they do not confirm Google indexing or predict rankings.</p></div>{labSeo.status === "measured" && typeof labSeo.score === "number" ? <Badge tone={labSeo.score >= 0.9 ? "green" : labSeo.score >= 0.5 ? "amber" : "red"}>Score {Math.round(labSeo.score * 100)}/100</Badge> : null}</div>
          {labSeo.status === "measured" ? labSeoChecks.length ? <ul className="mt-2 grid gap-2">{labSeoChecks.map((item, i) => <li key={`${item.id}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><p className="text-sm font-medium text-ink">{label(item.title, "SEO check")}{item.displayValue ? ` · ${item.displayValue}` : ""}</p>{item.description ? <p className="mt-1 text-xs text-ink-2">{item.description}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-ink-2">Lighthouse reported no failed automated SEO checks in this run.</p> : <p className="mt-2 text-sm text-ink-2">{labSeo.status === "no_result" ? "The response did not include a usable SEO result." : labData.status === "not_run" ? "No page was available for a Lighthouse check." : "A synthetic Lighthouse SEO result was unavailable."}</p>}
        </div>
      </section> : null}

      {seoReadiness.state ? <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="heading-section">Accessibility checks</h3><p className="mt-1 text-xs text-ink-3">Static HTML checks cover language, heading order, image alt attributes, and viewport metadata. Lighthouse adds a synthetic mobile check when available. Neither is a WCAG audit.</p></div><Badge tone={seoReadiness.state === "unavailable" ? "amber" : "neutral"}>{Number(accessibility.pagesWithStaticHtml ?? seoReadiness.pagesWithStaticHtml ?? 0)} pages with static HTML</Badge></div>
        {accessibilityFindings.length ? <ul className="mt-3 grid gap-2">{accessibilityFindings.map((finding, i) => <li key={`${finding.pageUrl}-${finding.title}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.level === "attention" ? "amber" : "neutral"}>{label(finding.level, "check").replaceAll("_", " ")}</Badge><span className="text-sm font-medium text-ink">{label(finding.title, "Accessibility check")}</span></div>{finding.evidence ? <p className="mt-2 text-sm text-ink-2">{finding.evidence}</p> : null}{finding.nextStep ? <p className="mt-1 text-sm text-ink">{finding.nextStep}</p> : null}{finding.pageUrl ? <a href={finding.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex break-all text-xs text-link">Open checked page <ExternalLink aria-hidden className="ml-1 size-3" /></a> : null}</li>)}</ul> : seoReadiness.state === "unavailable" ? <p className="mt-3 text-sm text-ink-2">Static HTML was unavailable, so these accessibility checks could not run.</p> : typeof accessibility.pagesWithStaticHtml !== "number" ? <p className="mt-3 text-sm text-ink-2">These checks were added after this audit was saved. Rerun the website audit to inspect this sample.</p> : <p className="mt-3 text-sm text-ink-2">No issues were found in these limited static HTML checks. Keyboard behavior, contrast, forms, and rendered content were not assessed.</p>}
        <div className="mt-4 border-t border-line pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold text-ink">Synthetic mobile checks · Lighthouse</h4><p className="mt-1 text-xs text-ink-3">A simulated run of one page. Findings are signals to review, not a certification.</p></div>{labAccessibility.status === "measured" && typeof labAccessibility.score === "number" ? <Badge tone={labAccessibility.score >= 0.9 ? "green" : labAccessibility.score >= 0.5 ? "amber" : "red"}>Score {Math.round(labAccessibility.score * 100)}/100</Badge> : null}</div>
          {labAccessibility.status === "measured" ? labAccessibilityChecks.length ? <ul className="mt-2 grid gap-2">{labAccessibilityChecks.map((item, i) => <li key={`${item.id}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><p className="text-sm font-medium text-ink">{label(item.title, "Accessibility check")}{item.displayValue ? ` · ${item.displayValue}` : ""}</p>{item.description ? <p className="mt-1 text-xs text-ink-2">{item.description}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-ink-2">Lighthouse reported no failed automated checks in this run. Manual and assistive-technology review is still needed.</p> : <p className="mt-2 text-sm text-ink-2">{labAccessibility.status === "no_result" ? "The response did not include a usable accessibility result." : labData.status === "not_run" ? "No page was available for a Lighthouse check." : "A synthetic Lighthouse accessibility result was unavailable."}</p>}
        </div>
      </section> : null}

      {label(data.clarityVerdict) ? <div><p className="text-overline">Website clarity</p><Prose text={label(data.clarityVerdict)} tone="default" /></div> : null}
      {label(data.messageMatch) ? <div><p className="text-overline">Message match</p><Prose text={label(data.messageMatch)} tone="muted" /></div> : null}

      {Object.keys(designCritic).length ? <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="heading-section">Design Critic</h3><p className="mt-1 text-xs text-ink-3">Brand, clarity, trust, craft, accessibility and measured behavior are judged as separate lenses. Subjective judgments are labeled.</p></div><Badge tone={designCritic.coverage === "visual_sampled" ? "blue" : "amber"}>{label(designCritic.coverage, "coverage unknown").replaceAll("_", " ")}</Badge></div>
        {designCritic.summary ? <p className="mt-3 text-sm text-ink-2">{label(designCritic.summary)}</p> : null}
        {findingReview?.screenshots?.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Website screenshots reviewed by Design Critic">{findingReview.screenshots.map((shot) => {
          const capture = shot as AuditScreenshot;
          return <figure key={capture.view} className="overflow-hidden rounded-lg border border-line bg-surface-2">
            {capture.url ? <a href={capture.url} target="_blank" rel="noreferrer noopener" aria-label={`Open full ${capture.view} screenshot of the reviewed page`}><Image src={capture.url} alt={`${capture.view === "desktop" ? "Desktop" : "Mobile"} screenshot of ${capture.pageUrl}`} width={capture.width} height={capture.height} unoptimized className="block max-h-72 w-full object-contain object-top" loading="lazy" /></a> : <div className="p-3 text-sm text-ink-3">This screenshot is no longer available.</div>}
            <figcaption className="p-3 text-xs text-ink-2"><span className="font-semibold capitalize text-ink">{capture.view} capture</span> · {capture.width} × {capture.height} · {formatDateTime(capture.capturedAt)}<a href={capture.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-1 block break-all text-link">Open reviewed page <ExternalLink aria-hidden className="ml-1 inline size-3" /></a></figcaption>
          </figure>;
        })}</div> : null}
        {designFindings.length ? <ul className="mt-3 grid gap-2">{designFindings.map((finding, i) => <li key={`${finding.sourceUrl}-${finding.region}-${i}`} className="rounded-lg border border-line bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={finding.severity === "high" ? "amber" : "neutral"}>{label(finding.severity, "severity unknown")} priority</Badge><span className="text-sm font-semibold text-ink">{label(finding.region, "Page region")}</span><Badge>{label(finding.lens, "design lens").replaceAll("_", " ")}</Badge><Badge tone={finding.classification === "objective_defect" || finding.classification === "automated_check" ? "blue" : "violet"}>{label(finding.classification, "judgment unlabelled").replaceAll("_", " ")}</Badge><span className="text-xs text-ink-3">{label(finding.confidence, "confidence unknown")} confidence</span></div>
          {finding.observation ? <p className="mt-2 text-sm text-ink-2">{label(finding.observation)}</p> : null}
          {finding.businessOrUserGoal ? <p className="mt-1 text-sm text-ink"><span className="font-medium">Goal: </span>{label(finding.businessOrUserGoal)}</p> : null}
          {finding.whyItMatters ? <p className="mt-1 text-sm text-ink-2"><span className="font-medium text-ink">Why it matters: </span>{label(finding.whyItMatters)}</p> : null}
          {finding.evidence ? <p className="mt-2 rounded-md bg-surface p-2 text-xs text-ink-2"><span className="font-medium text-ink">Evidence: </span>{label(finding.evidence)}</p> : null}
          {finding.visualEvidence?.observation ? <p className="mt-2 rounded-md border-l-2 border-violet-300 bg-surface p-2 text-sm text-ink-2">Visible in the {label(finding.visualEvidence.view)} screenshot: {label(finding.visualEvidence.observation)}</p> : null}
          {finding.automatedCheckIds?.length ? <p className="mt-1 text-xs text-ink-3">Automated checks: {finding.automatedCheckIds.join(", ")}</p> : null}
          {finding.requiresHumanEvaluation ? <p className="mt-1 text-xs text-amber-800">Needs human review; automated and screenshot checks cannot establish this finding alone.</p> : null}
          {finding.proposedChange ? <p className="mt-2 text-sm text-ink"><span className="font-medium">Proposed change: </span>{label(finding.proposedChange)}</p> : null}
          {finding.directions?.length ? <div className="mt-3 grid gap-2 border-t border-line pt-3">
            <p className="text-xs font-medium text-ink">Design response options · each is a hypothesis</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Creative range for the editable brief"><Select value={creativeRanges[i] ?? "distinctive"} onValueChange={(value) => setCreativeRanges((current) => ({ ...current, [i]: value as "safer" | "distinctive" | "unconventional" }))} options={[{ value: "safer", label: "Safer" }, { value: "distinctive", label: "More distinctive" }, { value: "unconventional", label: "More unconventional" }]} /></Field>
              <Field label="Essential brand elements to preserve"><Input value={essentialElements[i] ?? ""} onChange={(event) => setEssentialElements((current) => ({ ...current, [i]: event.target.value.slice(0, 240) }))} placeholder="Add owner-confirmed elements" /></Field>
            </div>
            {finding.directions.map((direction, directionIndex) => {
              const selected = Boolean(direction.id && reviewsByIndex.get(i)?.selectedDirectionId === direction.id);
              const selectionKey = `${i}:${direction.id ?? directionIndex}`;
              return <div key={direction.id ?? directionIndex} className="rounded-lg border border-line bg-surface p-3">
              {direction.responseLevel ? <Badge tone={direction.responseLevel === "bold_alternative" ? "violet" : direction.responseLevel === "quick_fix" ? "green" : "blue"}>{direction.responseLevel.replaceAll("_", " ")}</Badge> : null}
              {selected ? <Badge tone="green" className="ml-2">Owner chose this direction</Badge> : null}
              <p className="text-sm font-semibold text-ink">{label(direction.name, `Direction ${directionIndex + 1}`)}</p>
              {direction.communicates ? <p className="mt-1 text-xs text-ink-2"><span className="font-medium text-ink">Communicates: </span>{label(direction.communicates)}</p> : null}
              {direction.tradeoff ? <p className="mt-1 text-xs text-ink-2"><span className="font-medium text-ink">Tradeoff: </span>{label(direction.tradeoff)}</p> : null}
              {direction.change ? <p className="mt-1 text-xs text-ink-2">{label(direction.change)}</p> : null}
              {direction.effort ? <p className="mt-1 text-xs text-ink-3">Effort: {label(direction.effort)}</p> : null}
              {direction.assumptions?.length ? <p className="mt-1 text-xs text-ink-3">Assumptions: {direction.assumptions.join("; ")}</p> : null}
              {direction.risks?.length ? <p className="mt-1 text-xs text-ink-3">Risks: {direction.risks.join("; ")}</p> : null}
              {direction.measurementPlan ? <p className="mt-1 text-xs text-ink-3"><span className="font-medium">Measure: </span>{label(direction.measurementPlan)}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {findingReview?.canEdit && direction.id ? <Button size="sm" variant={selected ? "secondary" : "primary"} disabled={selected || selectDirectionBusy === selectionKey} loading={selectDirectionBusy === selectionKey} onClick={async () => {
                  setSelectDirectionBusy(selectionKey);
                  try {
                    await selectDirection({ slug, runId, findingIndex: i, directionId: direction.id! });
                    toast({ tone: "success", title: "Direction saved for this audit" });
                  } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
                  finally { setSelectDirectionBusy(null); }
                }}>{selected ? "Selected" : "Choose this direction"}</Button> : null}
                {direction.previewBrief ? selected
                  ? <Link href={`/app/${encodeURIComponent(slug)}/pages?${new URLSearchParams({ brief: designBrief(finding, direction, approvedBrand, creativeRanges[i] ?? "distinctive", essentialElements[i] ?? ""), designRunId: String(runId), designFindingIndex: String(i), designDirectionId: direction.id ?? "" }).toString()}`} className="inline-flex items-center gap-1 text-xs font-medium text-link">Prepare editable brief <ArrowRight aria-hidden className="size-3" /></Link>
                  : <span className="flex flex-col items-start gap-1">
                    <Button size="sm" variant="secondary" disabled>Prepare editable brief</Button>
                    <span className="text-xs text-ink-3">Choose and save this direction first.</span>
                  </span>
                  : null}
              </div>
              {selected ? <p className="mt-2 text-xs text-ink-3">Saved against this audit finding. It does not change or publish the audited website.</p> : null}
            </div>; })}
            <p className="text-xs text-ink-3">The brief opens as editable text. Approved brand rules are not included unless explicitly attached; inferred cues remain hypotheses. Creating a draft does not change the audited website.</p>
          </div> : null}
          {finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex break-all text-xs text-link">Open evidence page <ExternalLink aria-hidden className="ml-1 size-3" /></a> : null}
          <DesignFindingReview key={`${runId}:${i}:${reviewsByIndex.get(i)?.updatedAt ?? "open"}`} slug={slug} runId={runId} findingIndex={i} current={reviewsByIndex.get(i)} canEdit={findingReview?.canEdit === true} />
        </li>)}</ul> : <p className="mt-3 text-sm text-ink-2">No design findings were returned for this sample.</p>}
        {list<string>(designCritic.limitations).length ? <ul className="mt-3 list-disc pl-5 text-xs text-ink-3">{list<string>(designCritic.limitations).map((item, i) => <li key={i}>{item}</li>)}</ul> : null}
      </section> : null}

      {(performance.pageUrl || fieldData.status || labData.status) ? <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="heading-section">Mobile performance</h3><p className="mt-1 text-xs text-ink-3">Google PageSpeed Insights tests this public page. Real-user field data and simulated lab tests are shown separately.</p></div>
          {performance.pageUrl ? <a href={String(performance.pageUrl)} target="_blank" rel="noreferrer noopener" className="break-all text-xs text-link">Measured page</a> : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2/70 p-3">
            <h4 className="text-sm font-semibold text-ink">Real visitors · CrUX</h4>
            {fieldData.status === "measured" ? <>
              <p className="mt-1 text-xs text-ink-3">Phone traffic, 75th percentile{fieldData.collectionPeriod ? ` · ${String(fieldData.collectionPeriod)}` : ""}</p>
              <ul className="mt-2 flex flex-col gap-2">{fieldMetrics.map((metric) => <li key={metric.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{label(metric.label, "Core Web Vital")}</span><span className="flex items-center gap-2 font-medium">{typeof metric.value === "number" ? `${metric.value}${metric.unit === "score" ? "" : ` ${metric.unit ?? ""}`}` : "—"}<Badge tone={metric.verdict === "good" ? "green" : metric.verdict === "poor" ? "red" : "amber"}>{label(metric.verdict, "unrated").replaceAll("_", " ")}</Badge></span></li>)}</ul>
            </> : <p className="mt-1 text-sm text-ink-2">{fieldData.status === "not_configured" ? "Real-user data is unavailable until the Chrome UX Report API key is configured." : fieldData.status === "no_data" ? "Google has no real-user data for this page and device group." : fieldData.status === "not_run" ? "No page was available to measure." : "Real-user data could not be retrieved."}</p>}
          </div>
          <div className="rounded-lg bg-surface-2/70 p-3">
            <h4 className="text-sm font-semibold text-ink">Simulated mobile test · Lighthouse</h4>
            {labData.status === "measured" ? <>
              <p className="mt-1 text-sm text-ink-2">Performance score: {typeof labData.score === "number" ? `${Math.round(labData.score * 100)}/100` : "not reported"}</p>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-2">{labMetrics.map((metric) => <li key={metric.id} className="flex justify-between gap-2"><span>{label(metric.label, "Metric")}</span><span>{label(metric.displayValue, "not reported")}</span></li>)}</ul>
              {labOpportunities.length ? <div className="mt-3"><p className="text-xs font-semibold text-ink-3">Largest measured opportunities</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-ink-2">{labOpportunities.map((item) => <li key={item.id}>{label(item.title)}{item.displayValue ? ` · ${item.displayValue}` : ""}</li>)}</ul></div> : null}
            </> : <p className="mt-1 text-sm text-ink-2">{labData.status === "not_run" ? "No page was available to measure." : "The mobile lab test could not be completed."}</p>}
            <p className="mt-2 text-xs text-ink-3">A lab run simulates one visit; it is not a measurement of your customers.</p>
          </div>
        </div>
        {performance.checkedAt ? <p className="mt-2 text-xs text-ink-3">Checked {formatDateTime(Number(performance.checkedAt))}</p> : null}
      </section> : null}

      {fixes.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Start with these fixes</h3><ol className="grid gap-3">{fixes.map((fix, i) => <li key={i} className="rounded-lg border border-line p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={i === 0 ? "amber" : "neutral"}>{label(fix.effort, "effort not estimated")} effort</Badge><span className="text-sm font-medium text-ink">{label(fix.fix)}</span></div>{fix.pageUrl ? <a href={fix.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">Open target page <ExternalLink aria-hidden className="size-3" /></a> : null}{fix.evidenceQuote ? <blockquote className="mt-2 rounded-md border-l-2 border-brand-300 bg-surface-2 p-3 text-sm text-ink-2">“{fix.evidenceQuote}”<span className="ml-2 text-xs text-ink-3">Page evidence</span></blockquote> : null}{fix.visualEvidence?.observation ? <p className="mt-2 rounded-md border-l-2 border-violet-300 bg-surface-2 p-3 text-sm text-ink-2"><span className="font-medium text-ink">Visible in {label(fix.visualEvidence.view)} screenshot: </span>{fix.visualEvidence.observation}</p> : null}{fix.why ? <p className="mt-2 text-sm text-ink-2">{fix.why}</p> : null}{fix.expectedEffect ? <p className="mt-2 text-xs text-ink-3">What may improve: {fix.expectedEffect} This is a hypothesis, not a measured lift.</p> : null}{fix.contentStructure?.length ? <div className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Suggested page order</h4><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-2">{fix.contentStructure.map((item, j) => <li key={j}>{item}</li>)}</ol></div> : null}{fix.sampleCopy ? <div className="mt-3 rounded-lg bg-surface-2/70 p-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Sample draft copy</h4><p className="mt-1 whitespace-pre-wrap text-sm text-ink">{fix.sampleCopy}</p><p className="mt-1 text-xs text-ink-3">Review against confirmed business facts before publishing.</p></div> : null}{fix.uxChanges?.length ? <div className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Suggested experience changes</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{fix.uxChanges.map((item, j) => <li key={j}>{item}</li>)}</ul></div> : null}{fix.measurementPlan ? <p className="mt-3 rounded-lg border border-line p-3 text-sm text-ink-2"><span className="font-semibold text-ink">How to check it: </span>{fix.measurementPlan}</p> : null}</li>)}</ol></section> : null}

      {findings.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Website findings</h3><ul className="grid gap-2">{findings.map((finding, i) => <li key={i} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.impact === "high" ? "amber" : "neutral"}>{label(finding.impact, "priority not rated")} priority</Badge><span className="text-sm font-semibold text-ink">{label(finding.area, "Website")}</span><Badge tone={finding.evidenceKind === "observed" ? "blue" : "violet"}>{label(finding.evidenceKind, "evidence unlabelled")}</Badge></div>{finding.evidenceQuote ? <blockquote className="mt-2 rounded-md border-l-2 border-line bg-surface-2 p-3 text-sm text-ink-2">“{finding.evidenceQuote}”<span className="ml-2 text-xs text-ink-3">Page evidence</span></blockquote> : null}{finding.visualEvidence?.observation ? <p className="mt-2 rounded-md border-l-2 border-violet-300 bg-surface-2 p-3 text-sm text-ink-2"><span className="font-medium text-ink">Visible in {label(finding.visualEvidence.view)} screenshot: </span>{finding.visualEvidence.observation}</p> : null}{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">View source page <ExternalLink aria-hidden className="size-3" /></a> : null}</li>)}</ul></section> : null}

      <section className="rounded-xl border border-line p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Megaphone aria-hidden className="size-4 text-brand-800" />Social content review</div>
        {label(socialReview.summary) ? <p className="mt-2 text-sm text-ink-2">{label(socialReview.summary)}</p> : null}
        {socialSources.length ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="Social account source coverage">{socialSources.map((source) => {
          const state = source.state ?? "unavailable";
          const stateLabel = state === "reviewed" ? `${Number(source.postsReviewed ?? 0)} posts sampled` : state === "no_posts" ? "No captioned posts found" : state === "not_connected" ? "Not connected" : state === "not_authorized" ? "Read permission unavailable" : "Could not read posts";
          return <li key={source.source} className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2"><span className="font-medium capitalize">{source.source ?? "Source"}:</span> {stateLabel}</li>;
        })}</ul> : null}
        {socialPostPerformance.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Social post engagement snapshots">{socialPostPerformance.map((post) => {
          const reviewed = reviewedSocialPosts.get(String(post.sourceArtifactId));
          const metrics = list<{ metric?: string; value?: number }>(post.metrics);
          const platform = post.platform === "facebook" ? "Facebook" : "Instagram";
          return <li key={post.sourceArtifactId} className="rounded-lg border border-line p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink">{platform} post snapshot</span>{reviewed?.sourceUrl ? <a href={reviewed.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-link">Open post</a> : null}</div><dl className="mt-2 grid grid-cols-3 gap-2">{metrics.map((metric) => { const isRate = metric.metric === "calculated_actions_per_reach_pct"; return <div key={metric.metric} className="rounded-md bg-surface-2 px-2 py-1"><dt className="text-xs text-ink-3">{isRate ? "Actions per reach (calculated)" : label(metric.metric).replaceAll("_", " ")}</dt><dd className="text-sm font-medium tabular-nums text-ink">{typeof metric.value === "number" ? isRate ? `${metric.value.toFixed(1)}%` : new Intl.NumberFormat().format(metric.value) : "—"}</dd></div>; })}</dl>{metrics.some((metric) => metric.metric === "calculated_actions_per_reach_pct") ? <p className="mt-2 text-xs text-ink-3">Interactions per reached account, calculated from reported likes, comments, saves, shares and reach. This does not count unique engaged people.</p> : null}</li>;
        })}</ul> : null}
        {socialFindings.length ? <ul className="mt-3 grid gap-2">{socialFindings.map((finding, i) => <li key={`${finding.sourceArtifactId}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.priority === "high" ? "amber" : "neutral"}>{label(finding.priority, "review")} priority</Badge><span className="text-sm font-medium text-ink">{label(finding.platform, "Social")} post</span></div>{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-link">Open reviewed post <ExternalLink aria-hidden className="size-3" /></a> : finding.sourceType === "climbos" && finding.sourceArtifactId ? <Link className="mt-2 inline-flex items-center gap-1 text-xs text-link" href={`/app/${slug}/content/${finding.sourceArtifactId}`}>Open reviewed post <ArrowRight aria-hidden className="size-3" /></Link> : null}</li>)}</ul> : null}
        {socialMixSuggestions.length ? <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Platform-specific ideas to test</p><ul className="mt-2 grid gap-2">{socialMixSuggestions.map((suggestion, i) => <li key={`${suggestion.platform}-${suggestion.format}-${i}`} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{label(suggestion.platform, "Social")}</Badge><span className="text-sm font-semibold text-ink">{label(suggestion.format, "Content format")}</span><Badge tone="amber">Hypothesis</Badge></div><p className="mt-2 text-sm text-ink">{label(suggestion.concept)}</p>{suggestion.fitHypothesis ? <p className="mt-1 text-sm text-ink-2">Why it may fit: {suggestion.fitHypothesis}</p> : null}{suggestion.testSignal ? <p className="mt-1 text-xs text-ink-3">Test signal: {suggestion.testSignal}</p> : null}{suggestion.sourceArtifactIds?.length ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{suggestion.sourceArtifactIds.map((id) => { const post = reviewedSocialPosts.get(id); return post?.sourceUrl ? <a key={id} href={post.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-link">Based on sampled {label(post.platform, "social")} post <ExternalLink aria-hidden className="size-3" /></a> : post?.sourceType === "climbos" ? <Link key={id} href={`/app/${slug}/content/${id}`} className="inline-flex items-center gap-1 text-xs text-link">Based on sampled {label(post.platform, "social")} post <ArrowRight aria-hidden className="size-3" /></Link> : null; })}</div> : <p className="mt-2 text-xs text-ink-3">Business-fit idea; not based on sampled post performance.</p>}</li>)}</ul></div> : null}
      </section>

      {limitations.length ? <section className="rounded-lg border border-line bg-surface-2/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Limits of this review</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-3">{limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></section> : null}
    </div>
  );
}

function DesignFindingReview({ slug, runId, findingIndex, current, canEdit }: { slug: string; runId: Id<"workflowRuns">; findingIndex: number; current?: FindingReview; canEdit: boolean }) {
  const save = useMutation(api.designCritic.setFeedback);
  const [status, setStatus] = useState<FindingStatus | "">(current?.status ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [busy, setBusy] = useState(false);
  if (current?.status) return <div className="mt-3 border-t border-line pt-3">
    <div className="flex flex-wrap items-center gap-2"><Badge tone={current.status === "resolved" ? "green" : current.status === "dismissed" ? "neutral" : "amber"}>Owner marked {current.status.replaceAll("_", " ")}</Badge><span className="text-xs text-ink-3">Saved to this audit</span></div>
    <p className="mt-1 break-all text-xs text-ink-3">Reference {current.evidenceRef ?? `${runId}:${findingIndex}`} · {current.viewport ? `${current.viewport} view` : "viewport not recorded"}{current.screenshotCapturedAt ? ` captured ${formatDateTime(current.screenshotCapturedAt)}` : ""}{current.sourceUrl ? ` · ${current.sourceUrl}` : ""}</p>
    {current.note ? <p className="mt-1 text-xs text-ink-2">{current.note}</p> : null}
    {canEdit ? <form className="mt-2 flex flex-col gap-2" onSubmit={async (event) => { event.preventDefault(); if (!status) return; setBusy(true); try { await save({ slug, runId, findingIndex, status, note }); toast({ tone: "success", title: "Finding review updated" }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>
      <Field label="Update review status"><Select value={status} onValueChange={(value) => setStatus(value as FindingStatus | "")} options={[{ value: "", label: "Keep current status" }, { value: "accepted", label: "Accepted" }, { value: "deferred", label: "Defer" }, { value: "corrected", label: "Corrected" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }, { value: "reopened", label: "Reopen" }, { value: "needs_information", label: "Needs more information" }]} /></Field>
      <Field label="Note or correction"><Textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} rows={2} autosize placeholder="What should the team know?" /></Field>
      <Button size="sm" variant="secondary" className="self-start" loading={busy} disabled={!status || (status === "corrected" && !note.trim())}>Save review</Button>
    </form> : null}
  </div>;
  if (!canEdit) return null;
  return <form className="mt-3 flex flex-col gap-2 border-t border-line pt-3" onSubmit={async (event) => { event.preventDefault(); if (!status) return; setBusy(true); try { await save({ slug, runId, findingIndex, status, note }); toast({ tone: "success", title: "Finding review saved" }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>
    <Field label="Your review of this finding"><Select value={status} onValueChange={(value) => setStatus(value as FindingStatus | "")} options={[{ value: "", label: "Choose a status" }, { value: "accepted", label: "Accept" }, { value: "deferred", label: "Defer" }, { value: "corrected", label: "I corrected the finding" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Not relevant" }, { value: "needs_information", label: "Needs more information" }]} /></Field>
    <Field label="Correction or context" hint={status === "corrected" ? "Required for corrections." : "Optional; helps improve the review."}><Textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} rows={2} autosize placeholder="Add context for your team" /></Field>
    <Button size="sm" variant="secondary" className="self-start" loading={busy} disabled={!status || (status === "corrected" && !note.trim())}>Save review</Button>
  </form>;
}

function designBrief(finding: DesignFinding, direction: DesignDirection, brand: { exists?: boolean; ownerConfirmed?: boolean; ownerConfirmedAt?: number | null; voice?: string; toneWords?: string[]; colors?: string[]; doNots?: string[]; approvedExamples?: string[] } | undefined, creativeRange: "safer" | "distinctive" | "unconventional", essentialElements: string) {
  const brandRules = brand?.ownerConfirmed
    ? `Workspace brand settings reviewed and confirmed by an owner/admin on ${brand.ownerConfirmedAt ? formatDateTime(brand.ownerConfirmedAt) : "an unknown date"}: voice ${brand.voice || "not set"}; tone ${brand.toneWords?.join(", ") || "not set"}; colors ${brand.colors?.join(", ") || "not set"}; avoid ${brand.doNots?.join("; ") || "not set"}; approved examples ${brand.approvedExamples?.join(" | ") || "none"}.`
    : "Brand-kit context is not owner/admin-confirmed; onboarding or edited values may be inferred. Do not treat them as requirements. Ask the owner to review the brand kit; only the owner-entered essential elements below are confirmed for this brief.";
  return [
    `Design brief (${direction.responseLevel?.replaceAll("_", " ") ?? "selected response"})`,
    `Business goal: ${finding.businessOrUserGoal ?? "Confirm with owner"}`,
    "Audience: Confirm with owner; do not infer beyond the audit evidence.",
    `Finding: ${finding.observation ?? "Review the linked finding"}`,
    `Why it may matter: ${finding.whyItMatters ?? "See audit evidence and validate with the owner."}`,
    `Evidence: ${finding.evidence ?? "No precise evidence text supplied."}`,
    `Page/region: ${finding.sourceUrl ?? "No stable page URL supplied"} · ${finding.region ?? "region unspecified"}`,
    `Evidence confidence: ${finding.confidence ?? "unknown"}; classification: ${finding.classification ?? "unclassified"}.`,
    `Selected direction: ${direction.name ?? "Direction"} — ${direction.change ?? "Specify a change."}`,
    `Requested creative range: ${creativeRange}. Preserve these owner-confirmed essentials: ${essentialElements.trim() || "none supplied; ask before assuming"}.`,
    `Tradeoff: ${direction.tradeoff ?? "Confirm with owner."}`,
    `Effort: ${direction.effort ?? "Unknown"}. Assumptions: ${direction.assumptions?.join("; ") ?? "Confirm with owner."}`,
    `Risks: ${direction.risks?.join("; ") ?? "Confirm with owner."}`,
    brandRules,
    "Constraints, dependencies, unknowns: confirm with owner before finalizing.",
    `Reviewer checks: compare desktop and mobile rendering, legibility, interaction, accessibility, customer-brand fit, and the intended metric before any approval. Measurement plan: ${direction.measurementPlan ?? "Define metric and source before launch."}`,
  ].join("\n").slice(0, 2400);
}
