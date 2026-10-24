"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Globe, Megaphone } from "@/components/icons";
import { Badge } from "@/components/ui";
import { Prose } from "@/components/ds/content";

type Finding = { area?: string; observation?: string; recommendation?: string; impact?: string; sourceUrl?: string };
type Fix = { fix?: string; why?: string; effort?: string; expectedEffect?: string };
type SocialFinding = { sourceArtifactId?: string; platform?: string; observation?: string; recommendation?: string; priority?: string };
type Coverage = { requestedUrl?: string | null; pagesAttempted?: number; pagesRead?: number; pages?: { url?: string; status?: string }[] };

const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const label = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

export function ConversionAuditView({ value, slug }: { value: unknown; slug: string }) {
  const data = obj(value);
  const coverage = obj(data.auditCoverage);
  const website = obj(coverage.website) as Coverage;
  const search = obj(coverage.searchConsole);
  const social = obj(coverage.social);
  const findings = list<Finding>(data.findings);
  const fixes = list<Fix>(data.prioritizedFixes);
  const socialReview = obj(data.socialReview);
  const socialFindings = list<SocialFinding>(socialReview.findings);
  const pages = list<unknown>(website.pages);
  const limitations = list<string>(coverage.limitations);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-line bg-surface-2/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Globe aria-hidden className="size-4 text-brand-800" />What this review covered</div>
        <p className="mt-2 text-sm text-ink-2">Website: {Number(website.pagesRead ?? 0)} of {Number(website.pagesAttempted ?? 0)} pages read. Social: {Number(social.publishedPostsReviewed ?? 0)} ClimbOS-published posts reviewed. Platform post analytics were not available in this audit.</p>
        {search.state === "matched_to_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console: {Number(search.observedRows ?? 0)} observations for pages read, {label(search.startDate)} to {label(search.endDate)}. These are search activity, not conversions.</p> : search.state === "not_used_property_mismatch" ? <p className="mt-2 text-xs text-ink-3">Search Console data was left out because its property did not match this business website.</p> : search.state === "property_matched_no_rows_for_read_pages" ? <p className="mt-2 text-xs text-ink-3">Search Console property matched, but no stored observations matched the pages read in this audit.</p> : null}
        {website.requestedUrl ? <a href={String(website.requestedUrl)} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">{String(website.requestedUrl)} <ExternalLink aria-hidden className="size-3" /></a> : <p className="mt-2 text-xs text-ink-3">No website address was saved for this business.</p>}
        {pages.length > 0 ? <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-2">{pages.map((raw, i) => { const page = obj(raw); return <li key={`${String(page.url)}-${i}`} className="flex flex-wrap items-center gap-2"><Badge tone={page.status === "read" ? "green" : "amber"}>{label(page.status, "not read").replaceAll("_", " ")}</Badge><span className="break-all">{label(page.url)}</span></li>; })}</ul> : null}
      </section>

      {label(data.clarityVerdict) ? <div><p className="text-overline">Website clarity</p><Prose text={label(data.clarityVerdict)} tone="default" /></div> : null}
      {label(data.messageMatch) ? <div><p className="text-overline">Message match</p><Prose text={label(data.messageMatch)} tone="muted" /></div> : null}

      {fixes.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Start with these fixes</h3><ol className="grid gap-2">{fixes.map((fix, i) => <li key={i} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={i === 0 ? "amber" : "neutral"}>{label(fix.effort, "effort not estimated")} effort</Badge><span className="text-sm font-medium text-ink">{label(fix.fix)}</span></div>{fix.why ? <p className="mt-2 text-sm text-ink-2">{fix.why}</p> : null}{fix.expectedEffect ? <p className="mt-2 text-xs text-ink-3">What to expect: {fix.expectedEffect}</p> : null}</li>)}</ol></section> : null}

      {findings.length > 0 ? <section className="flex flex-col gap-2"><h3 className="heading-section">Website findings</h3><ul className="grid gap-2">{findings.map((finding, i) => <li key={i} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.impact === "high" ? "amber" : "neutral"}>{label(finding.impact, "priority not rated")} priority</Badge><span className="text-sm font-semibold text-ink">{label(finding.area, "Website")}</span></div>{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-link">View source page <ExternalLink aria-hidden className="size-3" /></a> : null}</li>)}</ul></section> : null}

      <section className="rounded-xl border border-line p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Megaphone aria-hidden className="size-4 text-brand-800" />Social content review</div>
        {label(socialReview.summary) ? <p className="mt-2 text-sm text-ink-2">{label(socialReview.summary)}</p> : null}
        {socialFindings.length ? <ul className="mt-3 grid gap-2">{socialFindings.map((finding, i) => <li key={`${finding.sourceArtifactId}-${i}`} className="rounded-lg bg-surface-2/70 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={finding.priority === "high" ? "amber" : "neutral"}>{label(finding.priority, "review")} priority</Badge><span className="text-sm font-medium text-ink">{label(finding.platform, "Social")} post</span></div>{finding.observation ? <p className="mt-2 text-sm text-ink-2">{finding.observation}</p> : null}{finding.recommendation ? <p className="mt-2 text-sm text-ink">{finding.recommendation}</p> : null}{finding.sourceArtifactId ? <Link className="mt-2 inline-flex items-center gap-1 text-xs text-link" href={`/app/${slug}/content/${finding.sourceArtifactId}`}>Open reviewed post <ArrowRight aria-hidden className="size-3" /></Link> : null}</li>)}</ul> : null}
        {list<string>(socialReview.contentMixSuggestions).length ? <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Formats to test</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{list<string>(socialReview.contentMixSuggestions).map((suggestion, i) => <li key={i}>{suggestion}</li>)}</ul></div> : null}
      </section>

      {limitations.length ? <section className="rounded-lg border border-line bg-surface-2/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Limits of this review</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-3">{limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></section> : null}
    </div>
  );
}
