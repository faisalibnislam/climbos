"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Copy, Send, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Card, CardContent, Checkbox, Field, Input, Textarea, toast } from "@/components/ui";

/** Reviews: ask happy customers, share your review page, and reply to reviews with Climb AI. */
export default function ReviewsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.reviews.overview, { slug });
  const setUrl = useMutation(api.reviews.setReviewUrl);
  const request = useMutation(api.reviews.request);
  const addReview = useMutation(api.reviews.addReview);
  const [url, setUrlText] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [review, setReview] = useState({ author: "", text: "" });
  const [busy, setBusy] = useState<string | null>(null);
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
      <PageHeader section="reviews" title="Reviews" intro={`${data.stats.sent} asked · ${data.stats.clicked} opened the review link · ${data.stats.feedback} sent a private note.`} />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="Your review link" hint="Google: open your Business Profile → “Ask for reviews” → copy the link. Any review site works.">
            <div className="flex gap-2">
              <Input value={url ?? data.reviewUrl ?? ""} placeholder="https://g.page/r/…/review" onChange={(e) => setUrlText(e.target.value)} />
              <Button variant="secondary" loading={busy === "url"} disabled={url === null} onClick={() => run("url", () => setUrl({ slug, url: url ?? "" }), "Saved")}>
                Save
              </Button>
            </div>
          </Field>
          {data.reviewUrl ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              Your review page: <code className="rounded bg-surface-2 px-2 py-0.5 text-xs">{data.pageUrl}</code>
              <Button size="sm" variant="ghost" aria-label="Copy review page link" onClick={() => navigator.clipboard.writeText(data.pageUrl).then(() => toast({ tone: "success", title: "Copied" }), () => undefined)}>
                <Copy aria-hidden />
              </Button>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="heading-card">Ask customers</p>
          <p className="text-sm text-ink-3">A short, personal email from your own mailbox. Everyone gets the same link; unhappy customers can also tell you privately.</p>
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
              Won deals in your <Link href={`/app/${slug}/pipeline`}>Pipeline</Link> show up here.
            </p>
          )}
          <Field label="Or add people" hint="One per line: Name <email@example.com>">
            <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} autosize />
          </Field>
          <Button className="self-start" loading={busy === "ask"} disabled={!data.reviewUrl || people().length === 0} onClick={() => run("ask", async () => { const r = await request({ slug, people: people() }); setPicked(new Set()); setExtra(""); toast({ tone: "success", title: `Asking ${r.queued} ${r.queued === 1 ? "person" : "people"}` }); })}>
            <Send aria-hidden /> Ask for reviews
          </Button>
          {data.recent.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-line text-sm">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate text-ink-2">{r.name}</span>
                  <span className="flex gap-1.5">
                    {r.feedback ? <Badge tone="violet">Private note</Badge> : null}
                    {r.clicked ? <Badge tone="green">Opened link</Badge> : null}
                    <Badge tone={r.status === "failed" ? "red" : r.status === "sent" ? "neutral" : "blue"}>{r.status === "sent" ? "Asked" : r.status === "failed" ? "Didn't send" : "Sending"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="heading-card">Reply to a review</p>
          <p className="text-sm text-ink-3">Paste a review from Google or anywhere else. It goes to your Inbox, where Climb AI drafts the reply.</p>
          <Input value={review.author} placeholder="Reviewer's name" aria-label="Reviewer's name" onChange={(e) => setReview({ ...review, author: e.target.value })} />
          <Textarea value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} rows={3} autosize aria-label="Review text" placeholder="Paste the review" />
          <Button className="self-start" variant="secondary" loading={busy === "review"} disabled={!review.text.trim()} onClick={() => run("review", async () => { await addReview({ slug, author: review.author, text: review.text, source: "google" }); setReview({ author: "", text: "" }); }, "Added to your Inbox")}>
            <Star aria-hidden /> Add to Inbox
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
