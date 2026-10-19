"use client";

import { CircleCheck, CircleX, Loader2 } from "@/components/icons"
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDuration, formatEta } from "../../../shared/progress";

export interface Stage {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  startedAt?: number;
  finishedAt?: number;
  detail?: string;
}

/** Re-render every second while active (null during the server render). */
function useTick(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    if (!active) return () => clearTimeout(first);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

/**
 * Live progress for non-AI jobs (screenshots, product photos, exports): a bar
 * with % and time left, then each named stage with its timer and detail.
 * `expected` gives typical seconds per stage key for the estimate.
 */
export function StagedProgress({ title, stages, expected, className }: { title: string; stages: Stage[]; expected: Record<string, number>; className?: string }) {
  const active = stages.some((x) => x.status === "running" || x.status === "pending") && !stages.some((x) => x.status === "failed");
  const now = useTick(active);
  const t0 = Math.min(...stages.map((x) => x.startedAt ?? Number.POSITIVE_INFINITY));
  const end = active ? (now ?? t0) : Math.max(...stages.map((x) => x.finishedAt ?? 0), t0);
  let done = 0;
  let total = 0;
  let left = 0;
  for (const x of stages) {
    const exp = expected[x.key] ?? 15;
    total += exp;
    if (x.status === "done") done += exp;
    else if (x.status === "running") {
      const ran = x.startedAt && now ? (now - x.startedAt) / 1000 : 0;
      done += Math.min(ran, exp * 0.95);
      left += Math.max(exp - ran, exp * 0.1);
    } else left += exp;
  }
  const percent = active ? Math.max(3, Math.min(99, Math.round((done / Math.max(total, 1)) * 100))) : stages.some((x) => x.status === "failed") ? Math.round((done / Math.max(total, 1)) * 100) : 100;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Progress value={percent} label={`${title} progress`} />
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">{title}</span>
        <span className="tabular-nums text-ink-3">
          {active ? `${percent}% · ${formatEta(Math.ceil(left / 5) * 5)}` : "Done"}
          {Number.isFinite(t0) ? ` · ${formatDuration(Math.max(0, (end - t0) / 1000))}` : ""}
        </span>
      </p>
      <ol className="flex flex-col gap-1.5">
        {stages.map((x) => (
          <li key={x.key} className="text-xs">
            <span className="flex items-center gap-1.5">
              {x.status === "running" ? (
                <Loader2 aria-hidden className="size-3.5 animate-spin text-brand-800" />
              ) : x.status === "done" ? (
                <CircleCheck aria-hidden className="size-3.5 text-brand-800" />
              ) : x.status === "failed" ? (
                <CircleX aria-hidden className="size-3.5 text-red-800" />
              ) : (
                <span aria-hidden className="size-3.5 rounded-full border border-line-strong" />
              )}
              <span className={x.status === "pending" ? "text-ink-3" : x.status === "running" ? "font-medium text-ink" : "text-ink-2"}>{x.label}</span>
              <span className="sr-only">{x.status}</span>
              {x.startedAt && now ? <span className="ml-auto tabular-nums text-ink-3">{formatDuration(((x.finishedAt ?? now) - x.startedAt) / 1000)}</span> : null}
            </span>
            {x.detail ? <span className="ml-5 block text-ink-3">{x.detail}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
