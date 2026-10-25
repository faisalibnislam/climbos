"use client";

import { useMemo, useState } from "react";
import { Button, Callout, Card, CardContent, Input } from "@/components/ui";
import { createOrganizationWebsiteDraft } from "@shared/seo/structuredData";

export function StructuredDataGenerator({ businessName, website }: { businessName: string; website: string }) {
  const [name, setName] = useState(businessName);
  const [url, setUrl] = useState(website);
  const [visibleNameConfirmed, setVisibleNameConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const draft = useMemo(() => createOrganizationWebsiteDraft({ name, website: url, visibleNameConfirmed }), [name, url, visibleNameConfirmed]);

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.scriptTag);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="heading-card">Create a basic structured-data draft</h2>
          <p className="mt-1 text-sm text-ink-3">Prepare Organization and WebSite JSON-LD from the workspace name and website. Review it, then add it to your own site if appropriate.</p>
        </div>
        <Callout tone="info">This draft is not installed on your website. Google may ignore valid markup, and structured data does not guarantee rich results, rankings, or AI citations. Keep every marked-up fact visible and accurate on the page.</Callout>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Public organization name<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Website URL<Input value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" /></label>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink-2"><input type="checkbox" checked={visibleNameConfirmed} onChange={(event) => setVisibleNameConfirmed(event.target.checked)} className="mt-1" /><span>I checked the public page and this exact organization name is visible to visitors.</span></label>
        {draft ? <>
          <ul className="grid gap-1 text-xs text-ink-3 sm:grid-cols-3">{draft.checks.map((check) => <li key={check.id}>✓ {check.message}</li>)}</ul>
          <pre className="max-h-80 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-ink"><code>{draft.scriptTag}</code></pre>
          <div className="flex flex-wrap items-center gap-3"><Button onClick={copy}>{copied ? "Copied JSON-LD" : "Copy JSON-LD"}</Button><span className="text-xs text-ink-3">Validate with Google’s Rich Results Test and Schema Markup Validator, then check the rendered page and Search Console after installation.</span></div>
        </> : <p className="text-sm text-ink-3">Enter a public HTTP(S) URL and confirm that the exact name appears visibly on that page to generate the draft.</p>}
        <p className="text-xs text-ink-3">Sources: <a className="underline" href="https://developers.google.com/search/docs/appearance/structured-data/sd-policies" target="_blank" rel="noreferrer">Google structured-data policies</a> · <a className="underline" href="https://developers.google.com/search/docs/appearance/structured-data" target="_blank" rel="noreferrer">Google validation tools</a></p>
      </CardContent>
    </Card>
  );
}
