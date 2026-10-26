"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Coins } from "@/components/icons"
import Link from "next/link";
import { Progress, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useCostDisplay } from "./useCostDisplay";

/**
 * Sidebar credits: what's left this month and in top-ups, as bars. Credits
 * are shared by every workspace on the account. Shows dollars (1 credit = 1¢)
 * only for users an operator enabled to see real API cost.
 */
export function CreditMeter({ slug, rail }: { slug: string; rail?: boolean }) {
  const c = useQuery(api.workspace.credits, { slug });
  const fmt = useCostDisplay();
  if (c === undefined) return rail ? null : <Skeleton className="mb-1 h-16 w-full" />;
  const low = c.available < 20;
  if (rail) {
    return (
      <Link href={`/app/${slug}/settings/billing`} aria-label={`${fmt.left(c.available)}${fmt.usd ? "" : " credits"} left`} title={`${fmt.left(c.available)}${fmt.usd ? "" : " credits"} left`} className={cn("mb-1 grid size-9 place-items-center rounded-lg text-xs font-semibold tabular-nums", low ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-800")}>
        {fmt.usd ? `$${Math.floor(c.available / 100)}` : c.available > 999 ? `${Math.floor(c.available / 1000)}k` : c.available}
      </Link>
    );
  }
  const monthlyPct = c.monthly.total > 0 ? (c.monthly.left / c.monthly.total) * 100 : 0;
  return (
    <Link href={`/app/${slug}/settings/billing`} className="mb-1 flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand-700">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Coins aria-hidden className="size-3.5 text-brand-800" /> {fmt.usd ? "Credit left" : "Credits"}
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", low ? "text-red-800" : "text-ink")}>{fmt.left(c.available)}</span>
      </span>
      <Progress value={monthlyPct} label={c.paid ? "Monthly credits left" : "Free credits left"} />
      <span className="flex justify-between text-xs text-ink-3">
        <span>
          {c.paid ? "This month" : "Free"} {fmt.left(c.monthly.left)}
        </span>
        {c.topup.left > 0 ? <span>Top-ups {fmt.left(c.topup.left)}</span> : null}
      </span>
      {!c.paid && !c.isDemo ? <span className="text-xs font-medium text-brand-800">Get credits →</span> : low ? <span className="text-xs font-medium text-red-800">Low · add credits →</span> : null}
    </Link>
  );
}
