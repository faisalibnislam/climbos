"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { wordpressArticleHtml, wordpressPageTitle } from "@shared/integrations/wordpress";
import { Button, Field, Input, Select } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { ArtifactView } from "./model";

export function WordPressPageRehearsal({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const [open, setOpen] = useState(false);
  const data = useQuery(api.wordpressDrafts.pageRehearsal, open ? { slug, artifactId: artifact.id } : "skip");
  const start = useMutation(api.wordpressDrafts.startPageRehearsal);
  const review = useMutation(api.wordpressDrafts.reviewPageRehearsal);
  const [pageUrl, setPageUrl] = useState("");
  const [sourceRevision, setSourceRevision] = useState("");
  const [view, setView] = useState("active");
  const [width, setWidth] = useState("390");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = artifact.current;
  if (!current) return null;
  const proposed = { ...current, title: wordpressPageTitle(current.headline, artifact.title) };
  const active = data?.showing === "approved" ? data.approved : data?.baseline;
  const versions = { active, proposal: proposed, approved: data?.approved, original: data?.baseline };
  const copy = versions[view as keyof typeof versions];
  const decision = view === "original" ? "restore" : "approve";
  const canDecide = data && artifact.canApprove && (view === "original" ? data.showing === "approved" :
    view === "proposal" && proposed.id !== data.baseline.id && (data.showing !== "approved" || proposed.id !== data.approved?.id || proposed.title !== data.approved?.title));
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <details className="min-w-0 rounded-lg border border-line p-3" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Rehearse an existing WordPress page change</summary>
    <p className="my-2 text-xs text-ink-2">Compare page copy in a private layout. The site’s theme, plugins and live page are outside this preview.</p>
    {data === undefined ? <p className="text-sm">Loading comparison…</p> : data === null ? artifact.canEdit ? <div className="grid gap-2">
      <p className="text-sm">In Edit, enter the existing page title and page text. Save that version as your original, then edit the article to propose a change.</p>
      <Field label="Existing page address"><Input value={pageUrl} onChange={e => setPageUrl(e.target.value)} placeholder="https://example.com/services/" /></Field>
      <Field label="Original source revision or capture label"><Input value={sourceRevision} maxLength={120} onChange={e => setSourceRevision(e.target.value)} /></Field>
      <Button size="sm" variant="secondary" disabled={busy || !pageUrl.trim() || !sourceRevision.trim()} onClick={() => void act(() => start({ slug, artifactId: artifact.id, versionId: current.id, title: proposed.title, pageUrl, sourceRevision }))}>Save version {current.version} as original copy</Button>
    </div> : <p className="text-sm">An editor can save the original page copy here.</p> : <div className="grid min-w-0 gap-2">
      <p className="break-all text-sm">{data.pageUrl} · {data.sourceRevision}</p>
      <p role="status" className="text-sm">Rehearsal currently shows {data.showing === "approved" ? `approved version ${data.approved?.version}` : `original version ${data.baseline.version}`}.</p>
      <Field label="Copy to preview"><Select value={view} onValueChange={setView} options={[{ value: "active", label: "Current rehearsal" }, { value: "original", label: `Original · v${data.baseline.version}` }, { value: "proposal", label: `Proposed · v${current.version}` }, ...(data.approved ? [{ value: "approved", label: `Last approved · v${data.approved.version}` }] : [])]} /></Field>
      <Field label="Preview width"><Select value={width} onValueChange={setWidth} options={[{ value: "390", label: "Mobile · 390 pixels" }, { value: "1280", label: "Desktop · 1280 pixels" }]} /></Field>
      {copy && <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-line" tabIndex={0} aria-label="Scrollable page preview">
        <iframe title="Private WordPress copy preview" sandbox="" referrerPolicy="no-referrer" width={width} height="340" style={{ width: Number(width), maxWidth: "none" }} srcDoc={previewDocument(copy.title, copy.body)} />
      </div>}
      {canDecide && copy && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(async () => { await review({ slug, artifactId: artifact.id, revision: data.revision, pageUrl: data.pageUrl, versionId: copy.id, title: copy.title, decision }); setView("active"); })}>
        {decision === "restore" ? "Restore original in rehearsal" : "Approve this copy for rehearsal"}
      </Button>}
    </div>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </details>;
}

function previewDocument(title: string, body: string) {
  const escapedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // The frame is read-only. Show link text without enabling outbound navigation.
  const copy = wordpressArticleHtml(body).replace(/<a href="[^"]*">/g, "<u>").replace(/<\/a>/g, "</u>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;color:#18232c;background:white;font:16px/1.6 system-ui}main{max-width:68ch;margin:auto;padding:clamp(16px,4vw,48px);overflow-wrap:anywhere}pre{white-space:pre-wrap}h1,h2,h3{line-height:1.2}</style></head><body><main><h1>${escapedTitle}</h1>${copy}</main></body></html>`;
}
