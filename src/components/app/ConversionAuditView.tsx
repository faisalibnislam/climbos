"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Globe, Megaphone } from "@/components/icons";
import { Badge } from "@/components/ui";
import { Prose } from "@/components/ds/content";
import { formatDateTime } from "./money";

type Finding = { area?: string; observation?: string; recommendation?: string; impact?: string; sourceUrl?: string; evidenceQuote?: string; evidenceKind?: string };
type Fix = { fix?: string; pageUrl?: string; evidenceQuote?: string; why?: string; effort?: string; expectedEffect?: string; contentStructure?: string[]; sampleCopy?: string; uxChanges?: string[]; measurementPlan?: string };
type SocialFinding = { sourceArtifactId?: string; platform?: string; sourceType?: string; sourceUrl?: string; observation?: string; recommendation?: string; priority?: string };
type SocialSourceCoverage = { source?: string; state?: string; postsReviewed?: number };
type SeoReadinessFinding = { pageUrl?: string; level?: string; title?: string; evidence?: string; nextStep?: string };
type SeoReadinessPage = { url?: string; metadataState?: string; titleLength?: number | null; descriptionLength?: number | null; headingCounts?: { h1?: number; h2?: number; h3?: number } | null; canonicalUrl?: string | null; robotsDirectives?: string | null; structuredDataTypes?: string[] | null };
type Coverage = { requestedUrl?: string | null; discoveredCandidates?: number; pagesAttempted?: number; pagesRead?: number; pages?: { url?: string; status?: string }[] };

const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const label = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

export function ConversionAuditView({ value, slug }: { value: unknown; slug: string }) {
  const data = obj(value);
  const coverage = obj(data.auditCoverage);
  const website = obj(coverage.website) as Coverage;
  const performance = obj(coverage.performance);
  const seoReadiness = obj(coverage.seoReadiness);
  const seoFindings = list<SeoReadinessFinding>(seoReadiness.findings);
  const seoPages = list<SeoReadinessPage>(seoReadiness.pages);
  const fieldData = obj(performance.fieldData);
  const labData = obj(performance.labData);
  const fieldMetrics = list<{ id?: string; label?: string; value?: number; unit?: string; verdict?: string }>(fieldData.metrics);
  const labMetrics = list<{ id?: string; label?: string; displayValue?: string }>(labData.metrics);
  const labOpportunities = list<{ id?: string; title?: string; displayValue?: string | null; description?: string }>(labData.opportunities);
  const search = obj(coverage.searchConsole);
  const social = obj(coverage.social);
  const findings = list<Finding>(data.findings);
  const fixes = list<Fix>(data.prioritizedFixes);
  const socialReview = obj(data.socialReview);
  const socialFindings = list<SocialFinding>(socialReview.findings);
  const socialSources = list<SocialSourceCoverage>(socialReview.coverage);
  const pages = list<unknown>(website.pages);
  const limitations = list<string>(coverage.limitations);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-line bg-surface-2/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Globe aria-hidden className="size-4 text-brand-800" />What this review covered</div>
        <p className="mt-2 text-sm text-ink-2">Website: {Number(website.pagesRead ?? 0)} of {Number(website.pagesAttempted ?? 0)} sampled pages read{typeof website.discoveredCandidates === "number" ? `; ${website.discoveredCandidates} same-site page candidates found in the sitemap and homepage links` : ""}. This is a bounded sample, not a complete crawl. Social: {Number(social.postsReviewed ?? social.publishedPostsReviewed ?? 0)} posts sampled. Post-level performance analytics were not available in this audit.</p>
        {search.state === "matched_to_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console: {Number(search.observedRows ?? 0)} observations for pages read, {label(search.startDate)} to {label(search.endDate)}. These are search activity, not conversions.</p> : search.state === "not_used_property_mismatch" ? <p className="mt-2 text-xs text-ink-3">Search Console data was left out because its property did not match this business website.</p> : search.state === "property_matched_no_rows_for_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console property matched, but no stored observations matched the pages read in this audit.</p> : null}
        {website.requestedUrl ? <a href={String(website.requestedUrl)} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">{String(website.requestedUrl)} <ExternalLink aria-hidden className="size-3" /></a> : <p className="mt-2 text-xs text-ink-3">No website address was saved for this business.</p>}
        {pages.length > 0 ? <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-2">{pages.map((raw, i) => { const page = obj(raw); return <li key={`${String(page.url)}-${i}`} className="flex flex-wrap items-center gap-2"><Badge tone={page.status === "read" ? "green" : "amber"}>{label(page.status, "not read").replaceAll("_", " ")}</Badge><span className="break-all">{label(page.url)}</span></li>; })}</ul> : null}
      </section>

      {seoReadiness.state ? <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="heading-section">Search readiness checks</h3><p className="mt-1 text-xs text-ink-3">ClimbOS&apos;s existing checks applied to sampled static HTML. They do not prove indexing or ranking.</p></div><Badge tone={seoReadiness.state === "measured" ? "green" : "amber"}>{Number(seoReadiness.pagesWithStaticHtml ?? 0)} of {Number(seoReadiness.pagesSampled ?? 0)} pages inspected</Badge></div>
        {seoFindings.length ? <ul className="mt-3 grid gap-2">{seoFindings.map((finding, i) => <li key={`${finding.pageUrl}-${finding.title}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.level === "attention" ? "amber" : "neutral"}>{label(finding.level, "check").replaceAll("_", " ")}</Badge><span className="text-sm font-medium text-ink">{label(finding.title, "Search readiness check")}</span></div>{finding.evidence ? <p className="mt-2 text-sm text-ink-2">{finding.evidence}</p> : null}{finding.nextStep ? <p className="mt-1 text-sm text-ink">{finding.nextStep}</p> : null}{finding.pageUrl ? <a href={finding.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex break-all text-xs text-link">Open checked page <ExternalLink aria-hidden className="ml-1 size-3" /></a> : null}</li>)}</ul> : seoReadiness.state === "unavailable" ? <p className="mt-3 text-sm text-ink-2">Static HTML metadata was unavailable for the pages read in this audit.</p> : <p className="mt-3 text-sm text-ink-2">No issues were found in the search readiness checks run on these sampled pages.</p>}
        {seoPages.some((page) => page.metadataState === "unavailable") ? <p className="mt-2 text-xs text-ink-3">Some page metadata could not be read, so no finding was inferred for those pages.</p> : null}
        {seoPages.filter((page) => page.metadataState === "observed").length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-link">Show observed page signals</summary><ul className="mt-2 grid gap-2">{seoPages.filter((page) => page.metadataState === "observed").map((page, i) => <li key={`${page.url}-${i}`} className="rounded-md border border-line p-3 text-xs text-ink-2"><a href={page.url} target="_blank" rel="noreferrer noopener" className="break-all text-link">{label(page.url)}</a><p className="mt-1">Title: {page.titleLength ?? 0} characters · Description: {page.descriptionLength ?? 0} characters · H1/H2/H3: {Number(page.headingCounts?.h1 ?? 0)}/{Number(page.headingCounts?.h2 ?? 0)}/{Number(page.headingCounts?.h3 ?? 0)}</p><p className="mt-1">Canonical: {page.canonicalUrl ? <a href={page.canonicalUrl} target="_blank" rel="noreferrer noopener" className="text-link">declared</a> : "not observed"} · Robots: {label(page.robotsDirectives, "not observed")}</p>{page.structuredDataTypes?.length ? <p className="mt-1">Structured data types observed: {page.structuredDataTypes.join(", ")}</p> : null}</li>)}</ul></details> : null}
      </section> : null}

      {label(data.clarityVerdict) ? <div><p className="text-overline">Website clarity</p><Prose text={label(data.clarityVerdict)} tone="default" /></div> : null}
      {label(data.messageMatch) ? <div><p className="text-overline">Message match</p><Prose text={label(data.messageMatch)} tone="muted" /></div> : null}

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

      {fixes.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Start with these fixes</h3><ol className="grid gap-3">{fixes.map((fix, i) => <li key={i} className="rounded-lg border border-line p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={i === 0 ? "amber" : "neutral"}>{label(fix.effort, "effort not estimated")} effort</Badge><span className="text-sm font-medium text-ink">{label(fix.fix)}</span></div>{fix.pageUrl ? <a href={fix.pageUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">Open target page <ExternalLink aria-hidden className="size-3" /></a> : null}{fix.evidenceQuote ? <blockquote className="mt-2 rounded-md border-l-2 border-brand-300 bg-surface-2 p-3 text-sm text-ink-2">“{fix.evidenceQuote}”<span className="ml-2 text-xs text-ink-3">Page evidence</span></blockquote> : null}{fix.why ? <p className="mt-2 text-sm text-ink-2">{fix.why}</p> : null}{fix.expectedEffect ? <p className="mt-2 text-xs text-ink-3">What may improve: {fix.expectedEffect} This is a hypothesis, not a measured lift.</p> : null}{fix.contentStructure?.length ? <div className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Suggested page order</h4><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-2">{fix.contentStructure.map((item, j) => <li key={j}>{item}</li>)}</ol></div> : null}{fix.sampleCopy ? <div className="mt-3 rounded-lg bg-surface-2/70 p-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Sample draft copy</h4><p className="mt-1 whitespace-pre-wrap text-sm text-ink">{fix.sampleCopy}</p><p className="mt-1 text-xs text-ink-3">Review against confirmed business facts before publishing.</p></div> : null}{fix.uxChanges?.length ? <div className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Suggested experience changes</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{fix.uxChanges.map((item, j) => <li key={j}>{item}</li>)}</ul></div> : null}{fix.measurementPlan ? <p className="mt-3 rounded-lg border border-line p-3 text-sm text-ink-2"><span className="font-semibold text-ink">How to check it: </span>{fix.measurementPlan}</p> : null}</li>)}</ol></section> : null}

      {findings.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Website findings</h3><ul className="grid gap-2">{findings.map((finding, i) => <li key={i} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.impact === "high" ? "amber" : "neutral"}>{label(finding.impact, "priority not rated")} priority</Badge><span className="text-sm font-semibold text-ink">{label(finding.area, "Website")}</span><Badge tone={finding.evidenceKind === "observed" ? "blue" : "violet"}>{label(finding.evidenceKind, "evidence unlabelled")}</Badge></div>{finding.evidenceQuote ? <blockquote className="mt-2 rounded-md border-l-2 border-line bg-surface-2 p-3 text-sm text-ink-2">“{finding.evidenceQuote}”<span className="ml-2 text-xs text-ink-3">Page evidence</span></blockquote> : null}{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">View source page <ExternalLink aria-hidden className="size-3" /></a> : null}</li>)}</ul></section> : null}

      <section className="rounded-xl border border-line p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Megaphone aria-hidden className="size-4 text-brand-800" />Social content review</div>
        {label(socialReview.summary) ? <p className="mt-2 text-sm text-ink-2">{label(socialReview.summary)}</p> : null}
        {socialSources.length ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="Social account source coverage">{socialSources.map((source) => {
          const state = source.state ?? "unavailable";
          const stateLabel = state === "reviewed" ? `${Number(source.postsReviewed ?? 0)} posts sampled` : state === "no_posts" ? "No captioned posts found" : state === "not_connected" ? "Not connected" : state === "not_authorized" ? "Read permission unavailable" : "Could not read posts";
          return <li key={source.source} className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2"><span className="font-medium capitalize">{source.source ?? "Source"}:</span> {stateLabel}</li>;
        })}</ul> : null}
        {socialFindings.length ? <ul className="mt-3 grid gap-2">{socialFindings.map((finding, i) => <li key={`${finding.sourceArtifactId}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.priority === "high" ? "amber" : "neutral"}>{label(finding.priority, "review")} priority</Badge><span className="text-sm font-medium text-ink">{label(finding.platform, "Social")} post</span></div>{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-link">Open reviewed post <ExternalLink aria-hidden className="size-3" /></a> : finding.sourceType === "climbos" && finding.sourceArtifactId ? <Link className="mt-2 inline-flex items-center gap-1 text-xs text-link" href={`/app/${slug}/content/${finding.sourceArtifactId}`}>Open reviewed post <ArrowRight aria-hidden className="size-3" /></Link> : null}</li>)}</ul> : null}
        {list<string>(socialReview.contentMixSuggestions).length ? <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Formats to test</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{list<string>(socialReview.contentMixSuggestions).map((suggestion, i) => <li key={i}>{suggestion}</li>)}</ul></div> : null}
      </section>

      {limitations.length ? <section className="rounded-lg border border-line bg-surface-2/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Limits of this review</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-3">{limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></section> : null}
    </div>
  );
}
