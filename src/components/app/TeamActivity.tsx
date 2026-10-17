"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { relativeTime } from "@/components/app/money";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { cn } from "@/lib/utils";

/**
 * Top-bar pulse of the AI team: how many jobs are running right now (with the
 * step each is on) and what just finished, one click from its result.
 */
export function TeamActivity({ slug }: { slug: string }) {
  const work = useQuery(api.workspace.activeWork, { slug });
  if (!work || (work.active.length === 0 && work.justFinished.length === 0)) return null;
  const busy = work.active.length > 0;
  const label = busy ? `${work.active.length} working` : `${work.justFinished.length} done`;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ui font-medium transition-colors",
          busy ? "bg-brand-50 text-brand-900 hover:bg-brand-100" : "bg-green-100 text-green-800 hover:brightness-95",
        )}
        aria-label={busy ? `${work.active.length} jobs in progress. Show details` : `${work.justFinished.length} jobs just finished. Show details`}
      >
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <CircleCheck aria-hidden className="size-4" />}
        <span className="hidden sm:inline">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {work.active.length > 0 ? (
          <div className="p-2">
            <p className="px-2 pb-1 pt-1 text-overline">Working now</p>
            <ul className="flex flex-col">
              {work.active.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/${slug}/work/${r.id}`} className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2">
                    <RoleAvatar role={r.roles[0] ?? "coo"} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui font-medium text-ink">{r.title}</span>
                      <span className="block truncate text-xs text-brand-800">{r.step}</span>
                    </span>
                    <Loader2 aria-hidden className="size-3.5 animate-spin text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {work.justFinished.length > 0 ? (
          <div className={cn("p-2", work.active.length > 0 && "border-t border-line")}>
            <p className="px-2 pb-1 pt-1 text-overline">Just finished</p>
            <ul className="flex flex-col">
              {work.justFinished.map((r) => (
                <li key={r.id}>
                  <Link href={r.kind === "strategy" ? `/app/${slug}/plan` : `/app/${slug}/work/${r.id}`} className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2">
                    <CircleCheck aria-hidden className="size-4 text-brand-800" />
                    <span className="min-w-0 flex-1 truncate text-ui text-ink">{r.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">{relativeTime(r.finishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
