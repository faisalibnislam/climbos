"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Gift } from "@/components/icons"
import { useState } from "react";
import { Button } from "@/components/ui";

/** "Give 200, get 200": the account's share link and what it has earned. */
export function ReferralCard({ slug }: { slug: string }) {
  const data = useQuery(api.referrals.mine, { slug });
  const ensure = useMutation(api.referrals.ensureCode);
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  const link = data.code ? `${window.location.origin}/r/${data.code}` : null;
  return (
    <section aria-labelledby="referral-heading" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-brand" aria-hidden />
        <h2 id="referral-heading" className="heading-section">
          Give {data.credits}, get {data.credits}
        </h2>
      </div>
      <p className="mt-1 text-sm text-ink-3">When someone you invite buys a package, you both get {data.credits} credits (valid 12 months).</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {link ? (
          <>
            <code className="rounded-md border border-line bg-bg px-3 py-1.5 text-sm">{link}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                } catch {
                  return; // The link is shown above; copying is a convenience.
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => ensure({ slug })}>
            Get my link
          </Button>
        )}
      </div>
      <dl className="mt-4 flex gap-6 text-sm">
        <div><dt className="text-ink-3">Signed up</dt><dd className="font-medium">{data.signedUp}</dd></div>
        <div><dt className="text-ink-3">Bought</dt><dd className="font-medium">{data.rewarded}</dd></div>
        <div><dt className="text-ink-3">Credits earned</dt><dd className="font-medium">{data.earned}</dd></div>
      </dl>
    </section>
  );
}
