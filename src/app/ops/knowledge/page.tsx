"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, RefreshCw } from "@/components/icons";
import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { errorMessage } from "@/components/app/errors";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, toast } from "@/components/ui";

const CADENCES = [0, 7, 14, 30, 60, 90, 180, 365].map((days) => ({ value: String(days), label: days === 0 ? "Manual only" : `Every ${days} days` }));
const STATE_LABEL: Record<string, string> = {
  not_checked: "Not monitored", manual_only: "Manual checks only", scheduled: "Scheduled",
  recheck_due: "Recheck due", queued: "Queued", checking: "Checking", update_pending: "Review needed",
  blocked_by_robots: "Blocked by robots.txt", failed: "Check failed", baseline_set: "Baseline recorded", unchanged: "No detected change",
};
const STATE_TONE: Record<string, "neutral" | "blue" | "green" | "orange" | "red"> = {
  not_checked: "neutral", manual_only: "neutral", scheduled: "blue", recheck_due: "orange", queued: "blue",
  checking: "blue", update_pending: "orange", blocked_by_robots: "red", failed: "red", baseline_set: "green", unchanged: "green",
};

export default function OpsKnowledgePage() {
  return <AdminFrame>{(me) => <KnowledgeSources canManage={me.powers.includes("features")} />}</AdminFrame>;
}

function KnowledgeSources({ canManage }: { canManage: boolean }) {
  const sources = useQuery(api.knowledge.catalog, {});
  const proposals = useQuery(api.knowledge.listProposals, {});
  const requestRefresh = useMutation(api.knowledge.requestRefresh);
  const setCadence = useMutation(api.knowledge.setCadence);
  const dismiss = useMutation(api.knowledge.dismissProposal);
  if (sources === undefined || proposals === undefined) return <p role="status" className="py-16 text-center text-sm text-ink-2">Loading knowledge sources…</p>;

  const run = async (action: () => Promise<unknown>, title: string) => {
    try { await action(); toast({ tone: "success", title }); }
    catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-overline">Governed knowledge</p>
        <h1 className="heading-page">Knowledge sources</h1>
        <p className="max-w-3xl text-sm text-ink-2">Review the curated source catalog, set bounded check intervals, and inspect changes before they can influence product guidance.</p>
      </header>
      <Callout tone="warning" title="A check interval is not a freshness guarantee">
        Dates describe ClimbOS retrieval and page-check events. A detected change creates a review proposal; source text never updates production guidance automatically. Access and license terms have not been reviewed for this catalog, so do not treat a successful fetch as permission to reuse content.
      </Callout>

      <section className="flex flex-col gap-3" aria-labelledby="source-proposals-heading">
        <div className="flex items-baseline justify-between gap-3"><h2 id="source-proposals-heading" className="heading-section">Changes awaiting review</h2><Badge tone={proposals.length ? "orange" : "neutral"}>{proposals.length} pending</Badge></div>
        {!proposals.length ? <p className="text-sm text-ink-3">No source changes are awaiting review.</p> : proposals.map((proposal) => (
          <Card key={proposal._id}>
            <CardHeader><CardTitle as="h3">{proposal.title}</CardTitle><CardDescription>{proposal.registryId} · version {proposal.version} · detected {new Date(proposal.createdAt).toLocaleString()}</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <a href={proposal.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-link underline">Open source <ExternalLink aria-hidden className="size-3.5" /></a>
              <div className="grid gap-3 md:grid-cols-2">
                <Passages title="New passages" passages={proposal.addedPassages} />
                <Passages title="Removed passages" passages={proposal.removedPassages} />
              </div>
              <p className="text-xs text-ink-3">Applicability: {proposal.applicability} · affected rules: {proposal.affectedRules} · evaluation: {proposal.evaluationImpact}. These passages are untrusted source data, not instructions.</p>
              {canManage ? <Button size="sm" variant="secondary" onClick={() => void run(() => dismiss({ proposalId: proposal._id }), "Proposal dismissed")}>Dismiss proposal</Button> : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="source-catalog-heading">
        <div className="flex items-baseline justify-between gap-3"><h2 id="source-catalog-heading" className="heading-section">Curated catalog</h2><span className="text-xs text-ink-3">{sources.length} registered sources</span></div>
        <div className="grid gap-3">
          {sources.map((source) => {
            const busy = source.status === "queued" || source.status === "checking" || source.status === "update_pending";
            return (
              <Card key={source.registryId}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><CardTitle as="h3">{source.title}</CardTitle><CardDescription>{source.registryId} · {source.verificationStatuses.join(", ")}</CardDescription></div>
                    <Badge tone={STATE_TONE[source.freshnessState] ?? "neutral"}>{STATE_LABEL[source.freshnessState] ?? source.freshnessState}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-sm text-link underline">{source.url} <ExternalLink aria-hidden className="size-3.5 shrink-0" /></a>
                  <p className="text-xs text-ink-2">Claim scope: {source.claimScopes.join(" · ")}</p>
                  <div className="grid gap-2 text-xs text-ink-3 sm:grid-cols-2 lg:grid-cols-4">
                    <p>Library books: {source.books.join(", ") || "Not tagged"}</p>
                    <p>Source publication/effective date: {source.publicationDate ?? "Not recorded"}</p>
                    <p>Library retrieval date: {source.registryRetrievedAt}</p>
                    <p>ClimbOS page check: {source.checkedAt ? new Date(source.checkedAt).toLocaleString() : "Not checked yet"}</p>
                    <p>Next scheduled check: {source.nextCheckAt ? new Date(source.nextCheckAt).toLocaleString() : "None scheduled"}</p>
                    <p>Access/license review: {source.accessReview.replaceAll("_", " ")}</p>
                    <p>Per-source check cost: Not measured</p>
                    <p>Content version: {source.version}{source.contentHash ? ` · ${source.contentHash.slice(0, 12)}…` : " · no baseline"}</p>
                    <p>Update tracking: {source.cadenceUpdatedAt ? `Changed ${new Date(source.cadenceUpdatedAt).toLocaleString()}` : "Default interval"}</p>
                  </div>
                  {source.lastError ? <p className="text-xs text-danger">Last check issue: {source.lastError}</p> : null}
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <label className="flex items-center gap-2 text-xs text-ink-2">Review interval
                      <Select value={String(source.reviewCadenceDays)} onValueChange={(days) => void run(() => setCadence({ registryId: source.registryId, days: Number(days) }), "Review interval saved")} options={CADENCES} disabled={!canManage} aria-label={`Review interval for ${source.title}`} />
                    </label>
                    {canManage ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => requestRefresh({ registryId: source.registryId }), "Source check queued")}><RefreshCw aria-hidden />{busy ? "Please wait" : "Check source"}</Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Passages({ title, passages }: { title: string; passages: string[] }) {
  return <div className="rounded-lg border border-line p-3"><h4 className="text-xs font-medium text-ink">{title}</h4>{passages.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-2">{passages.map((passage, index) => <li key={`${index}-${passage.slice(0, 24)}`}>{passage}</li>)}</ul> : <p className="mt-2 text-xs text-ink-3">No text captured.</p>}</div>;
}
