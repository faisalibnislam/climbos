"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Card, CardContent, DatePicker, Field, Input, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { POST_RESULT_FIELDS, type PostResultKey, type PostResultRecord, type PostResultValues } from "../../../../../shared/growth/postResults";

type Props = { slug: string; artifactId: Id<"artifacts"> };
export function PostResultsPanel(props: Props) {
  const data = useQuery(api.postResults.view, props);
  const [editing, setEditing] = useState(false);
  if (!data) return null;
  return <Card><CardContent className="space-y-4">
    <div><h2 className="heading-card">Post results</h2><p className="mt-1 text-sm text-ink-3">Record what you observed. Blank values stay unknown; attention is not customers or revenue.</p></div>
    {data.report ? <ResultSummary report={data.report} /> : <p className="text-sm text-ink-3">No results recorded for this post.</p>}
    {data.issue ? <p className="text-sm text-amber-900">Not used in new planning: {data.issue}</p> : null}
    {!data.publicationKnown ? <p className="text-sm text-ink-3">Confirm whether the post was published before recording results.</p> : null}
    {data.canReport && !editing ? <Button variant="secondary" onClick={() => setEditing(true)}>{data.report ? "Add or correct results" : "Record results"}</Button> : null}
    {editing && data.canReport && data.versionId && data.contentHash ? <ResultsForm key={data.versionId} {...props} versionId={data.versionId} contentHash={data.contentHash} latestId={data.report?._id ?? null} initial={data.issue ? null : data.report} timeZone={data.timeZone} onDone={() => setEditing(false)} /> : null}
    <details><summary className="cursor-pointer text-sm font-medium">Report history</summary><ReportHistory {...props} /></details>
    <p className="text-xs text-ink-3">{data.demo ? "Synthetic demo observations." : "Member-entered observations are not independently verified."} Reports describe one window and are not added together. Weekly planning considers recent calendar-linked posts. Saving does not publish, send, spend or change the plan.</p>
  </CardContent></Card>;
}

function ResultSummary({ report }: { report: PostResultRecord }) {
  return <div className="space-y-2 rounded-lg bg-surface-2 p-3">
    <p className="text-xs font-medium text-ink-2">{report.source === "fixture" ? "Synthetic demo report" : report.source === "owner" ? "Member-reported observations" : "Platform-reported observations"} · {report.fromDate && report.toDate ? `${report.fromDate} through ${report.toDate} (${report.timeZone ?? "timezone unknown"})` : "Measurement window unknown"}</p>
    <p className="text-xs text-ink-3">Content version {report.artifactVersionNumber ?? "unknown"} · Recorded {Number.isFinite(report.capturedAt) ? `${new Date(report.capturedAt).toLocaleString(undefined, { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" })} UTC` : "at an unknown time"}</p>
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">{POST_RESULT_FIELDS.slice(0, 7).map(([key, label]) => <div key={key}><dt className="text-xs text-ink-3">{label}</dt><dd>{report[key] === undefined ? "Unknown" : report[key].toLocaleString()}</dd></div>)}</dl>
    <details><summary className="cursor-pointer text-xs font-medium">Distribution and interactions</summary><dl className="mt-2 grid grid-cols-2 gap-2 text-xs">{POST_RESULT_FIELDS.slice(7).map(([key, label]) => <div key={key}><dt className="text-ink-3">{label}</dt><dd>{report[key] === undefined ? "Unknown" : report[key].toLocaleString()}</dd></div>)}</dl></details>
    <p className="whitespace-pre-wrap break-words text-xs text-ink-3">Measurement method and definitions: {report.measurementNote ?? "Unknown"}</p>
  </div>;
}

function ResultsForm({ slug, artifactId, versionId, contentHash, latestId, initial, timeZone, onDone }: Props & { versionId: Id<"artifactVersions">; contentHash: string; latestId: Id<"postMetrics"> | null; initial: PostResultRecord | null; timeZone: string; onDone: () => void }) {
  const record = useMutation(api.postResults.record);
  const [expectedLatestReportId] = useState(latestId);
  const [fromDate, setFromDate] = useState(initial?.fromDate ?? ""); const [toDate, setToDate] = useState(initial?.toDate ?? "");
  const [measurementNote, setNote] = useState(initial?.measurementNote ?? ""); const [values, setValues] = useState<Partial<Record<PostResultKey, string>>>(() => Object.fromEntries(POST_RESULT_FIELDS.filter(([key]) => initial?.[key] !== undefined).map(([key]) => [key, String(initial![key])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = ([key, label]: typeof POST_RESULT_FIELDS[number]) => <Field key={key} label={label} hint="Leave blank if unknown"><Input inputMode="numeric" value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} disabled={busy} /></Field>;
  async function save() {
    const numbers: PostResultValues = {};
    for (const [key] of POST_RESULT_FIELDS) {
      if (values[key]?.trim()) numbers[key] = Number(values[key]);
    }
    setBusy(true); setError(null);
    try {
      await record({ slug, artifactId, versionId, contentHash, expectedLatestReportId, fromDate, toDate, measurementNote, ...numbers });
      toast({ tone: "success", title: "Results recorded", description: "Earlier reports remain in history." }); onDone();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Record post results" className="space-y-3 rounded-lg border border-line p-3">
    <p className="text-sm text-ink-3">Choose completed dates in {timeZone}. Enter a complete replacement report for this window, not a change to add to earlier counts.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="From date"><DatePicker value={fromDate} onChange={setFromDate} disabled={busy} /></Field><Field label="Through date"><DatePicker value={toDate} onChange={setToDate} min={fromDate || undefined} disabled={busy} /></Field></div>
    <div className="grid gap-3 sm:grid-cols-2">{POST_RESULT_FIELDS.filter(([key]) => ["qualifiedVisits", "signups", "payingCustomers", "operatingMinutes"].includes(key)).map(field)}</div>
    <details><summary className="cursor-pointer text-sm font-medium">More observations (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{POST_RESULT_FIELDS.filter(([key]) => !["qualifiedVisits", "signups", "payingCustomers", "operatingMinutes"].includes(key)).map(field)}</div></details>
    <Field label="How did you measure this?" hint="Name the source, define qualified visits or customer outcomes, and explain missing data. If nothing was measured, say so."><Textarea rows={3} maxLength={1000} value={measurementNote} onChange={event => setNote(event.target.value)} disabled={busy} /></Field>
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    <div className="flex gap-2"><Button onClick={save} disabled={busy || !fromDate || !toDate || measurementNote.trim().length < 8}>{busy ? "Saving…" : "Save results"}</Button><Button variant="secondary" onClick={onDone} disabled={busy}>Cancel</Button></div>
  </section>;
}

function ReportHistory(props: Props) {
  const { results, status, loadMore } = usePaginatedQuery(api.postResults.history, props, { initialNumItems: 5 });
  return <div className="mt-3 space-y-3">{results.map(report => <ResultSummary key={report._id} report={report} />)}{status === "CanLoadMore" ? <Button variant="secondary" onClick={() => loadMore(5)}>Load earlier reports</Button> : null}{status === "LoadingFirstPage" || status === "LoadingMore" ? <p className="text-xs text-ink-3">Loading reports…</p> : null}{!results.length && status === "Exhausted" ? <p className="text-xs text-ink-3">No reports yet.</p> : null}</div>;
}
