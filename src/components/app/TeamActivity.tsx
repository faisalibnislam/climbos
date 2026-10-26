"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleCheck, Loader2 } from "@/components/icons"
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger, toast } from "@/components/ui";
import { relativeTime } from "@/components/app/money";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { cn } from "@/lib/utils";
import { RunProgressCompact } from "@/components/app/content/RunProgress";

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
        // Starts with the visible text so voice-control users can say what they see.
        aria-label={`${label}: show details`}
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
                <li key={r.id} className="rounded-md px-2 py-2">
                  <Link href={`/app/${slug}/work/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                    <RoleAvatar role={r.roles[0] ?? "coo"} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink">{r.title}</span>
                  </Link>
                  <RunProgressCompact slug={slug} runId={r.id as Id<"workflowRuns">} className="mt-2" />
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
                  <Link href={`/app/${slug}/work/${r.id}`} className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-2">
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

/** Runs that already got a "started" toast from the button that began them. */
const announced = new Set<string>();

/** Call when a button shows its own "started" toast, so the watcher doesn't repeat it. */
export function markRunAnnounced(runId: string) {
  announced.add(runId);
}

/**
 * Toasts for every job, on whatever page is open: when one starts ("Watch progress") and when it
 * finishes ("See result") or stops ("See what happened"). Jobs already running or finished when
 * the page loaded stay quiet.
 */
export function JobToasts({ slug }: { slug: string }) {
  const work = useQuery(api.workspace.activeWork, { slug });
  const seen = useRef<{ slug: string; active: Set<string>; ended: Set<string> } | null>(null);
  useEffect(() => {
    if (!work) return;
    const ended = [...work.justFinished.map((r) => r.id as string), ...work.justStopped.map((r) => r.id as string)];
    if (!seen.current || seen.current.slug !== slug) {
      seen.current = { slug, active: new Set(work.active.map((r) => r.id)), ended: new Set(ended) };
      return;
    }
    const prev = seen.current;
    for (const r of work.active) {
      if (prev.active.has(r.id)) continue;
      prev.active.add(r.id);
      if (announced.has(r.id)) continue;
      toast({ tone: "info", title: `Started: ${r.title}`, action: { label: "Watch progress", href: `/app/${slug}/work/${r.id}` } });
    }
    for (const r of work.justFinished) {
      if (prev.ended.has(r.id)) continue;
      prev.ended.add(r.id);
      toast({ tone: "success", title: `Done: ${r.title}`, action: { label: "See result", href: `/app/${slug}/work/${r.id}` } });
    }
    for (const r of work.justStopped) {
      if (prev.ended.has(r.id)) continue;
      prev.ended.add(r.id);
      toast({ tone: "danger", title: `Didn't finish: ${r.title}`, action: { label: "See what happened", href: `/app/${slug}/work/${r.id}` } });
    }
  }, [work, slug]);
  return null;
}
