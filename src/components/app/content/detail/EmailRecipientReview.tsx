"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Button, Callout, Dialog, DialogContent } from "@/components/ui";

type Review = Omit<FunctionArgs<typeof api.marketing.emailRecipientReview>, "offset">;

export function EmailRecipientReview({ review }: { review: Review }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Review | null>(null);
  const changed = snapshot !== null && (snapshot.previewHash !== review.previewHash || snapshot.slug !== review.slug);
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button type="button" variant="secondary" className="self-start" onClick={() => { setSnapshot(review); setOpen(true); }}>Review recipients</Button>
    <DialogContent title="Review recipients" description="Private to owners and admins. Matches the selected audience rules; contact limits, send checks and approval still apply.">
      {open && snapshot ? changed ? <Callout tone="warning" className="mt-4">The audience changed. Close this review and open the updated list.</Callout> : <RecipientPage key={snapshot.previewHash} review={snapshot} /> : null}
    </DialogContent>
  </Dialog>;
}

function RecipientPage({ review }: { review: Review }) {
  const [offset, setOffset] = useState(0);
  const data = useQuery(api.marketing.emailRecipientReview, { ...review, offset });
  if (!data) return <p role="status" className="mt-4">Checking the reviewed recipients…</p>;
  if (!data.ready) return <Callout tone="warning" className="mt-4">{data.message}</Callout>;
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-ink-2">{data.total ? `${data.start + 1}–${data.start + data.items.length} of ${data.total}` : "No recipients qualify"}. Match the provider list to this exact group. Unsubscribed or ineligible contacts are excluded; ClimbOS does not remove extra provider contacts automatically.</p>
    <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Selected email recipients">{data.items.map(item => <li key={item.email} className="break-words px-3 py-2 text-sm"><span className="block font-medium">{item.email}</span>{item.name ? <span className="text-ink-2">{item.name}</span> : null}</li>)}</ul>
    <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous recipients</Button><Button type="button" variant="secondary" disabled={data.nextOffset === null} onClick={() => { if (data.nextOffset !== null) setOffset(data.nextOffset); }}>Next recipients</Button></div>
    <p className="text-xs text-ink-3">Opening this list sends nothing and does not approve this or later follow-up steps. The full group is rechecked again before any approved send.</p>
  </div>;
}
