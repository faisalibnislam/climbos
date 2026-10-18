"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Coins } from "lucide-react";
import Link from "next/link";
import { Progress, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Sidebar credits: what's left this month and in top-ups, as bars. Credits
 * are shared by every workspace on the account. Never shows dollars.
 */
export function CreditMeter({ slug, rail }: { slug: string; rail?: boolean }) {
  const c = useQuery(api.workspace.credits, { slug });
  if (c === undefined) return rail ? null : <Skeleton className="mb-1 h-16 w-full" />;
  const low = c.available < 20;
  if (rail) {
    return (
      <Link href={`/app/${slug}/settings/billing`} aria-label={`${c.available} credits left`} title={`${c.available} credits left`} className={cn("mb-1 grid size-9 place-items-center rounded-lg text-xs font-semibold tabular-nums", low ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-800")}>
        {c.available > 999 ? `${Math.floor(c.available / 1000)}k` : c.available}
      </Link>
    );
  }
  const monthlyPct = c.monthly.total > 0 ? (c.monthly.left / c.monthly.total) * 100 : 0;
  return (
    <Link href={`/app/${slug}/settings/billing`} className="mb-1 flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand-700">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Coins aria-hidden className="size-3.5 text-brand-800" /> Credits
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", low ? "text-red-800" : "text-ink")}>{c.available.toLocaleString("en-US")}</span>
      </span>
      <Progress value={monthlyPct} label={c.paid ? "Monthly credits left" : "Free credits left"} />
      <span className="flex justify-between text-xs text-ink-3">
        <span>
          {c.paid ? "This month" : "Free"} {c.monthly.left.toLocaleString("en-US")}
        </span>
        {c.topup.left > 0 ? <span>Top-ups {c.topup.left.toLocaleString("en-US")}</span> : null}
      </span>
      {!c.paid && !c.isDemo ? <span className="text-xs font-medium text-brand-800">Get more credits →</span> : low ? <span className="text-xs font-medium text-red-800">Running low · add credits →</span> : null}
    </Link>
  );
}
