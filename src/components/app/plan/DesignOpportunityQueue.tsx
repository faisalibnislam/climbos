"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge, Button } from "@/components/ui";
import { groupDesignOpportunities, type DesignOpportunity } from "../../../../shared/agents/designOpportunities";
import { DesignFindingReview } from "../ConversionAuditView";
import { formatDateTime } from "../money";

export function DesignOpportunityQueue({ slug }: { slug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(api.designCritic.opportunitiesPage, { slug }, { initialNumItems: 10 });
  const groups = useMemo(() => groupDesignOpportunities(results.flatMap(run => run.findings)), [results]);
  const access = new Map(results.map(run => [String(run.runId), run.canEdit]));
  const partial = status !== "Exhausted";
  return <section aria-labelledby="design-opportunities-heading" className="space-y-4">
    <div><h2 id="design-opportunities-heading" className="heading-section">Design opportunities</h2>
      <p className="mt-2 text-sm text-ink-2">Compare saved findings across pages. Related areas are grouped by design lens and region, newest first—not ranked by a hidden score. Repeated checks are not independent evidence.</p>
      <p className="mt-1 text-xs text-ink-3">{results.length} audit records loaded{partial ? "; more may remain" : ""}. These are saved observations, not a fresh website check. External page versions and current conditions may be unknown.</p>
      {results.some(run => run.isFixture) ? <p className="mt-1 text-xs text-ink-3">Demo audit records contain synthetic examples.</p> : null}
      {results.some(run => run.unavailable) ? <p className="mt-1 text-xs text-ink-3">Some loaded audits are unfinished, have no usable design output, or contain incomplete findings. Open AI activity to inspect them.</p> : null}
    </div>
    {status === "LoadingFirstPage" ? <p role="status">Loading design findings…</p> : !groups.length ? <p>{partial ? "No usable design findings in the records loaded so far. Load older audits below." : "No saved design findings yet. Ask Climb to review a website, then return here to compare its findings."}</p> : groups.map(group => <section key={group.key} className="rounded-xl border border-line p-4">
      <h3 className="font-semibold">{group.region || "Region unknown"} · {(group.lens || "Lens unknown").replaceAll("_", " ")}</h3>
      <p className="mt-1 text-xs text-ink-3">{group.items.length} finding groups in the loaded records. Matching labels suggest related work; they do not prove a shared cause or increase confidence.</p>
      <div className="mt-3 space-y-3">{group.items.map(({ latest, history }) => <article key={`${latest.runId}:${latest.findingIndex}`} className="rounded-lg border border-line bg-surface p-3">
        <OpportunityEvidence row={latest} slug={slug} />
        <details className="mt-3"><summary className="min-h-9 cursor-pointer text-sm font-medium">Review or correct this finding</summary>
          <DesignFindingReview key={`${latest.runId}:${latest.findingIndex}:${latest.review?.updatedAt ?? "open"}`} slug={slug} runId={latest.runId as Id<"workflowRuns">} findingIndex={latest.findingIndex} current={latest.review} canEdit={access.get(latest.runId) === true} />
          {access.get(latest.runId) !== true ? <p className="text-xs text-ink-3">Ask an editor or owner to change this finding’s review.</p> : null}
        </details>
        {history.length ? <details className="mt-2"><summary className="min-h-9 cursor-pointer text-sm font-medium">{history.length} earlier matching {history.length === 1 ? "observation" : "observations"} · not extra evidence</summary><div className="space-y-3 border-l border-line pl-3">{history.map(row => <OpportunityEvidence key={`${row.runId}:${row.findingIndex}`} row={row} slug={slug} />)}</div></details> : null}
      </article>)}</div>
    </section>)}
    {status === "CanLoadMore" || status === "LoadingMore" ? <Button variant="secondary" disabled={status === "LoadingMore"} onClick={() => loadMore(10)}>{status === "LoadingMore" ? "Loading older audits…" : "Load older design audits"}</Button> : null}
    <p className="text-xs text-ink-3">Reviews apply only to the referenced audit finding. They do not resolve another page automatically, generate a draft, publish, or spend.</p>
  </section>;
}

export function OpportunityEvidence({ row, slug }: { row: DesignOpportunity; slug: string }) {
  return <div className="space-y-2 text-sm">
    <p className="font-medium">{row.observation}</p>
    <div className="flex flex-wrap gap-2"><Badge>{(row.classification || "Unclassified judgment").replaceAll("_", " ")}</Badge><Badge>{row.confidence || "Unknown"} confidence</Badge>{row.review?.status ? <Badge>Owner marked {row.review.status.replaceAll("_", " ")}</Badge> : null}</div>
    <p className="break-words text-xs text-ink-3">{row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-link underline">{row.sourceUrl}</a> : "Page URL unavailable"} · {row.viewport ? `${row.viewport} view` : "Viewport unknown"} · audit record {formatDateTime(row.auditedAt)}{row.capturedAt !== null ? ` · captured ${formatDateTime(row.capturedAt)}` : " · capture time unknown"}</p>
    <dl className="space-y-2">
      <div><dt className="font-medium">Evidence</dt><dd className="text-ink-2">{row.evidence || "No supporting excerpt recorded; inspect the original audit."}{row.checks.length ? ` Checks: ${row.checks.join(", ")}.` : ""}</dd></div>
      <div><dt className="font-medium">Customer relevance</dt><dd className="text-ink-2">{row.relevance || "Not established in this audit."}{row.goal ? ` Goal: ${row.goal}` : " Customer goal unknown."}</dd></div>
      <div><dt className="font-medium">Suggested change</dt><dd className="text-ink-2">{row.proposedChange || "Review the original options before choosing a change."}</dd></div>
    </dl>
    <details><summary className="min-h-9 cursor-pointer font-medium">Options, effort and dependencies</summary>
      {row.directions.length ? <ul className="space-y-2">{row.directions.map((direction, i) => <li key={i} className="border-l border-line pl-3"><p>{direction.name || "Unnamed option"}{direction.responseLevel ? ` · ${direction.responseLevel.replaceAll("_", " ")}` : ""}</p><p className="text-xs text-ink-2">Effort: {direction.effort || "unknown"}. Assumptions to check: {direction.assumptions.join("; ") || "not recorded"}. Risks: {direction.risks.join("; ") || "not recorded"}.</p></li>)}</ul> : <p className="text-xs text-ink-3">Effort and options are unknown. Confirm them before committing work.</p>}
      <p className="mt-2 text-xs text-ink-3">Dependencies are not independently verified; confirm page access, required assets and delivery capacity before choosing an option.</p>
    </details>
    {row.review?.note ? <p className="text-ink-2">Owner note: {row.review.note}</p> : null}
    <Link href={`/app/${encodeURIComponent(slug)}/work/${row.runId}#design-finding-${row.findingIndex}`} className="inline-block min-h-9 text-link underline">Open exact audit finding</Link>
  </div>;
}
