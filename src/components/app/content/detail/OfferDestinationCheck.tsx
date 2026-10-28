"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { Button, Callout, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

type Check = { checkedAt: number; url: string; status: "found" | "not_found" | "unavailable"; found: number[] } | null;

/** Whether the post's link still shows an approved offer price. A warning aid only; it never blocks publishing. */
export function OfferDestinationNotice({ check, prices, currency }: { check: Check; prices: number[]; currency?: string }) {
  const money = (n: number) => (currency ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n) : String(n));
  if (!check) return <p className="text-xs text-ink-3">The link hasn&apos;t been checked for the approved price ({prices.map(money).join(", ")}) yet.</p>;
  const when = new Date(check.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (check.status === "found") return <p className="text-xs text-ink-2">The linked page shows the approved price {check.found.map(money).join(", ")} (checked {when}).</p>;
  return (
    <Callout tone="warning" title={check.status === "unavailable" ? "Couldn't read the linked page" : "Approved price not found on the linked page"}>
      {check.status === "unavailable"
        ? `Couldn't read ${check.url} (checked ${when}).`
        : `${check.url} didn't show ${prices.map(money).join(" or ")} (checked ${when}). The offer may have changed, or the price may load in a way ClimbOS can't read. Check the page.`}
    </Callout>
  );
}

export function OfferDestinationCheck({ slug, artifactId, check, prices, currency, canEdit }: { slug: string; artifactId: Id<"artifacts">; check: Check; prices: number[]; currency?: string; canEdit: boolean }) {
  const run = useAction(api.publish.checkDestinationOffer);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <OfferDestinationNotice check={check} prices={prices} currency={currency} />
      {canEdit ? <div><Button size="sm" variant="ghost" loading={busy} onClick={async () => { setBusy(true); try { await run({ slug, artifactId }); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } finally { setBusy(false); } }}>Check the link now</Button></div> : null}
    </div>
  );
}
