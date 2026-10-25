"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Copy, Send, Star } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { StatBlocks } from "@/components/ds/content";
import { Badge, Button, Callout, Card, CardContent, Checkbox, ConfirmDialog, Field, IconTile, Input, Select, Textarea, toast } from "@/components/ui";

/** Reviews: invite customers neutrally, share your review page, and draft replies with Climb AI. */
export default function ReviewsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.reviews.overview, { slug });
  const voice = useQuery(api.reviews.voiceThemes, { slug });
  const setUrl = useMutation(api.reviews.setReviewUrl);
  const prepareBatch = useMutation(api.reviews.prepareBatch);
  const approveBatch = useMutation(api.reviews.approveBatch);
  const setVoiceThemeFeedback = useMutation(api.reviews.setVoiceThemeFeedback);
  const addReview = useMutation(api.reviews.addReview);
  const [url, setUrlText] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [review, setReview] = useState({ author: "", text: "", rating: "", sourceUrl: "" });
  const [themeLabels, setThemeLabels] = useState<Record<string, string>>({});
  const [themeNotes, setThemeNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof prepareBatch>> | null>(null);
  const [confirmEligibleRecipients, setConfirmEligibleRecipients] = useState(false);
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }
  if (data === undefined) return <LoadingBlock label="Loading reviews…" lines={4} />;
  const people = () => {
    const fromDeals = data.candidates.filter((c) => picked.has(c.dealId)).map((c) => ({ name: c.name, email: c.email, dealId: c.dealId as Id<"deals"> }));
    const typed = extra
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = /^(.*?)<?([^\s<>@]+@[^\s<>]+?)>?$/.exec(l);
        return m ? { name: m[1].trim() || m[2], email: m[2] } : null;
      })
      .filter((x): x is { name: string; email: string } => Boolean(x));
    return [...fromDeals, ...typed];
  };
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader section="reviews" title="Reviews" />
      <StatBlocks
        className="grid-cols-3 sm:grid-cols-3"
        stats={[
          { label: "Asked", value: data.stats.sent },
          { label: "Opened", value: data.stats.clicked, tone: data.stats.clicked ? "good" : "default" },
          { label: "Private notes", value: data.stats.feedback },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="Your review link" hint="Google: Business Profile → “Ask for reviews”">
            <div className="flex gap-2">
              <Input value={url ?? data.reviewUrl ?? ""} placeholder="https://g.page/r/…/review" onChange={(e) => setUrlText(e.target.value)} />
              <Button variant="secondary" loading={busy === "url"} disabled={url === null} onClick={() => run("url", () => setUrl({ slug, url: url ?? "" }), "Saved")}>
                Save
              </Button>
            </div>
          </Field>
          {data.reviewUrl ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              Review page: <code className="rounded bg-surface-2 px-2 py-0.5 text-xs">{data.pageUrl}</code>
              <Button size="sm" variant="ghost" aria-label="Copy review page link" onClick={() => navigator.clipboard.writeText(data.pageUrl).then(() => toast({ tone: "success", title: "Copied" }), () => undefined)}>
                <Copy aria-hidden />
              </Button>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <h2 className="heading-card">Possible customer themes</h2>
            <p className="text-sm text-ink-3">Phrase matching across recent reviews, supported inbox records, and owner-entered CRM notes from the latest {voice?.windowDays ?? 180} days. These are signals to review, not findings about every customer; examples retain source and date.</p>
          </div>
          {voice === undefined ? <p className="text-sm text-ink-3">Loading message themes…</p> : voice.themes.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {voice.themes.map((theme) => (
                <li key={theme.key} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{theme.label}</strong>
                    <Badge tone={theme.confidence === "medium" ? "blue" : "amber"}>{theme.confidence} heuristic confidence</Badge>
                    <Badge>{theme.evidenceBasis === "owner_reported" ? "Owner-entered notes" : theme.evidenceBasis === "mixed" ? "Messages + owner notes" : "Customer messages"}</Badge>
                    <Badge>{theme.count} matching messages</Badge>
                    {theme.status === "dismissed" ? <Badge>Dismissed</Badge> : null}
                  </div>
                  <p className="text-xs text-ink-3">{theme.channels.join(", ")} · {new Date(theme.firstSeenAt).toLocaleDateString()}–{new Date(theme.lastSeenAt).toLocaleDateString()}. Heuristic phrase grouping; the example count is not the total customer population.</p>
                  <ul className="flex flex-col gap-2">
                    {theme.examples.map((example) => <li key={example.id} className="rounded-md bg-surface-2 p-2 text-sm"><span className="text-xs text-ink-3">{example.source} · {new Date(example.date).toLocaleDateString()}{example.sourceUrl ? <> · <a href={example.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-800 underline">source</a></> : null}</span><p className="mt-1">“{example.excerpt}”</p></li>)}
                  </ul>
                  {theme.ownerNote ? <p className="text-xs text-ink-3">Owner note: {theme.ownerNote}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {theme.status === "dismissed" ? (
                      <Button size="sm" variant="ghost" onClick={() => run(`theme-${theme.key}`, () => setVoiceThemeFeedback({ slug, themeKey: theme.key, status: "clear" }), "Theme restored")}>Restore</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => run(`theme-${theme.key}`, () => setVoiceThemeFeedback({ slug, themeKey: theme.key, status: "dismissed", note: "Dismissed by workspace owner" }), "Theme dismissed")}>Dismiss</Button>
                        <Select aria-label={`Correct theme ${theme.label}`} value={themeLabels[theme.key] ?? theme.label} onValueChange={(value) => setThemeLabels({ ...themeLabels, [theme.key]: value })} options={Object.entries({ onboarding: "Getting started", reliability: "Reliability", response_time: "Response time", value: "Price and value", product_gap: "Product requests", service: "Service experience" }).map(([, label]) => ({ value: label, label }))} />
                        <Input aria-label={`Correction note for ${theme.label}`} placeholder="Why is this grouping wrong?" value={themeNotes[theme.key] ?? ""} onChange={(e) => setThemeNotes({ ...themeNotes, [theme.key]: e.target.value })} className="h-8 max-w-64 text-xs" />
                        <Button size="sm" variant="secondary" disabled={!themeNotes[theme.key]?.trim()} onClick={() => run(`theme-${theme.key}`, () => setVoiceThemeFeedback({ slug, themeKey: theme.key, status: "corrected", correctedLabel: themeLabels[theme.key] ?? theme.label, note: themeNotes[theme.key] }), "Correction saved")}>Correct</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No repeated phrase groups found in {voice.sourceCount} recent records. That does not mean customers have no concerns or questions.</p>
          )}
          {voice ? <p className="text-xs text-ink-3">Coverage: at most {voice.sampleLimit} inbox and owner-entered CRM records from {voice.windowDays} days; at least {voice.minimumRepeatedSources} matching sources are required. Private message text is only shown to workspace members with inbox access.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconTile icon={Send} tone="brand" size="sm" />
            <div>
              <h2 className="heading-card">Invite customers to review</h2>
              <p className="text-sm text-ink-3">Everyone receives the same public review destination, regardless of feedback or sentiment. Review the exact recipients and message before sending.</p>
            </div>
          </div>
          {data.candidates.length ? (
            <ul className="flex flex-col gap-1.5">
              {data.candidates.map((c) => (
                <li key={c.dealId}>
                  <Checkbox
                    label={`${c.name} · ${c.email}`}
                    checked={picked.has(c.dealId)}
                    onCheckedChange={(on) => {
                      const next = new Set(picked);
                      if (on) next.add(c.dealId);
                      else next.delete(c.dealId);
                      setPicked(next);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">
              Won <Link href={`/app/${slug}/pipeline`}>Pipeline</Link> deals appear here.
            </p>
          )}
          <Field label="Or add people" hint="One per line: Name <email@example.com>">
            <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} autosize />
          </Field>
          <Button className="self-start" loading={busy === "preview"} disabled={!data.reviewUrl || people().length === 0} onClick={() => run("preview", async () => { setConfirmEligibleRecipients(false); setPreview(await prepareBatch({ slug, people: people() })); })}>
            <Send aria-hidden /> Review invitation
          </Button>
          {data.recent.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-line text-sm">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate text-ink-2">{r.name}</span>
                  <span className="flex gap-1.5">
                    {r.feedback ? <Badge tone="violet">Note</Badge> : null}
                    {r.clicked ? <Badge tone="green">Opened</Badge> : null}
                    <Badge tone={r.status === "failed" ? "red" : r.status === "sent" ? "neutral" : "blue"}>{r.status === "sent" ? "Asked" : r.status === "failed" ? "Didn't send" : "Sending"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(preview)}
        onOpenChange={(open) => { if (!open) { setPreview(null); setConfirmEligibleRecipients(false); } }}
        title={`Send to ${preview?.count ?? 0} customers?`}
        description="This will send the reviewed invitation from your connected mailbox. The recipients, message version, mailbox and review destination are bound to this approval."
        confirmLabel={`Approve and send ${preview?.count ?? 0}`}
        confirmDisabled={!confirmEligibleRecipients}
        onConfirm={async () => {
          if (!preview) return;
          const result = await approveBatch({ slug, batchId: preview.batchId, contentHash: preview.contentHash, scopeHash: preview.scopeHash, confirmEligibleRecipients });
          setPreview(null);
          setConfirmEligibleRecipients(false);
          setPicked(new Set());
          setExtra("");
          toast({
            tone: "success",
            title: `Queued ${result.queued} ${result.queued === 1 ? "review invitation" : "review invitations"}`,
            description: result.activeOutreach ? `${result.activeOutreach} address${result.activeOutreach === 1 ? " already has" : "es already have"} an active email sequence and was left out.` : undefined,
          });
        }}
      >
        {preview ? (
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-lg bg-surface-2 p-3 text-sm">
            <p><span className="font-medium">Public review destination:</span> <span className="break-all">{preview.destination}</span></p>
            {preview.activeOutreach > 0 ? (
              <Callout tone="warning">{preview.activeOutreach} address{preview.activeOutreach === 1 ? " already has" : "es already have"} an active ClimbOS email sequence and {preview.activeOutreach === 1 ? "was" : "were"} left out of this invitation.</Callout>
            ) : null}
            <p><span className="font-medium">Message preview:</span></p>
            <pre className="whitespace-pre-wrap font-sans text-ink-2">{preview.preview}</pre>
            <p className="font-medium">Recipients ({preview.count})</p>
            <ul className="list-disc pl-5 text-ink-2">{preview.recipients.map((person, i) => <li key={`${person.email}-${i}`}>{person.name} · {person.email}</li>)}</ul>
            <Checkbox label="I confirm every recipient is an eligible customer who may receive this review invitation. I have not selected them based on expected satisfaction or review rating." checked={confirmEligibleRecipients} onCheckedChange={(checked) => setConfirmEligibleRecipients(checked === true)} />
          </div>
        ) : null}
      </ConfirmDialog>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconTile icon={Star} tone="amber" size="sm" />
            <div>
              <h2 className="heading-card">Reply to a review</h2>
              <p className="text-sm text-ink-3">AI drafts a reply in Inbox.</p>
            </div>
          </div>
          <Input value={review.author} placeholder="Reviewer's name" aria-label="Reviewer's name" onChange={(e) => setReview({ ...review, author: e.target.value })} />
          <Input type="url" value={review.sourceUrl} onChange={(e) => setReview({ ...review, sourceUrl: e.target.value })} aria-label="Public review URL" placeholder="Public review link (optional)" />
          <Input type="number" min={1} max={5} step={1} value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })} aria-label="Review rating from 1 to 5" placeholder="Rating (1–5), if shown" />
          <Textarea value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} rows={3} autosize aria-label="Review text" placeholder="Paste the review text. A rating alone is okay when it is 4 or 5 stars." />
          <Button className="self-start" variant="secondary" loading={busy === "review"} disabled={!review.text.trim() && !(Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5)} onClick={() => run("review", async () => { await addReview({ slug, author: review.author, text: review.text, rating: review.rating ? Number(review.rating) : undefined, source: "google", sourceUrl: review.sourceUrl || undefined }); setReview({ author: "", text: "", rating: "", sourceUrl: "" }); }, "Added to your Inbox")}>
            <Star aria-hidden /> Add to Inbox
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
