"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui";
import { MODEL_TEST_OUTCOME_LABEL } from "./BusinessModelCheckView";

const date = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function BusinessModelTestHistory({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(api.businessModel.testHistory, open ? { slug } : "skip", { initialNumItems: 12 });
  return <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="min-h-9 cursor-pointer font-medium text-ink">Test history</summary>
    {open ? <div className="mt-2 flex flex-col gap-3">
      <p className="text-sm text-ink-2">Reports from this and earlier model checks. Earlier updates remain visible; they are not additional independent tests. These are your reports, including any results you marked as measured, and have not been independently verified.</p>
      {status === "LoadingFirstPage" ? <p role="status" className="text-sm text-ink-3">Loading test history…</p> : null}
      {!results.length && status === "Exhausted" ? <p className="text-sm text-ink-3">No saved test reports yet.</p> : null}
      <ol className="flex flex-col gap-3">
        {results.map(report => <li key={report.id} className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
          <p className="font-medium text-ink">{report.subject?.name ?? "Original test unavailable"}</p>
          <p className="text-xs text-ink-3">{report.target} · check saved {date(report.checkCreatedAt)} · reported {date(report.createdAt)}{report.isFixture ? " · Demo" : ""}</p>
          <p className="mt-1 text-ink">{report.outcome ? MODEL_TEST_OUTCOME_LABEL[report.outcome] : "Outcome not recorded"} · {report.testState.replace(/_/g, " ")}</p>
          <p className="text-xs text-ink-3">Evidence selected: {report.outcomeEvidence.replace(/_/g, " ")} · Decision: {report.ownerDecision.replace(/_/g, " ")}</p>
          {report.outcomeNote ? <p className="mt-1 whitespace-pre-wrap break-words text-ink-2">{report.outcomeNote}</p> : null}
          {report.subject ? <details className="mt-2"><summary className="min-h-9 cursor-pointer text-link">Original test and criteria</summary><p>{report.subject.test}</p><p>Success: {report.subject.successSignal ?? "No separate success criterion was recorded."}</p><p>Stop if: {report.subject.stopCondition ?? "No separate stop condition was recorded."}</p></details> : null}
        </li>)}
      </ol>
      {status === "CanLoadMore" || status === "LoadingMore" ? <Button variant="secondary" disabled={status === "LoadingMore"} onClick={() => loadMore(12)}>{status === "LoadingMore" ? "Loading…" : "Load older reports"}</Button> : null}
    </div> : null}
  </details>;
}
