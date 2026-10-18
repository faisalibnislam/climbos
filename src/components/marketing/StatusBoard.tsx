"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const TONE = { ok: "bg-brand-700", degraded: "bg-amber-400", down: "bg-red-600" } as const;
const WORD = { ok: "Operational", degraded: "Slower than usual", down: "Having problems" } as const;

/** Live component status and 30 days of history, from ClimbOS's own records. */
export function StatusBoard() {
  const s = useQuery(api.status.overview, {});
  if (s === undefined) return <Skeleton className="h-80 w-full" />;
  const worst = s.components.some((c) => c.status === "down") ? "down" : s.components.some((c) => c.status === "degraded") ? "degraded" : "ok";
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="heading-page">Status</h1>
        <p className={cn("mt-4 rounded-xl px-4 py-3 font-medium text-white", TONE[worst])}>{worst === "ok" ? "All systems operational" : worst === "degraded" ? "Some things are slower than usual" : "We're fixing a problem"}</p>
        {s.updatedAt ? <p className="mt-2 text-xs text-ink-3">Checked {new Date(s.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Updates every 5 minutes.</p> : null}
      </div>
      <ul className="flex flex-col gap-5">
        {s.components.map((c) => (
          <li key={c.key} className="flex flex-col gap-2">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink">{c.label}</span>
              <span className={cn("text-sm", c.status === "ok" ? "text-brand-800" : c.status === "degraded" ? "text-amber-800" : "text-red-800")}>
                {WORD[c.status]}
                {c.note ? ` · ${c.note}` : ""}
              </span>
            </p>
            <div className="flex gap-0.5" aria-label={`${c.label}: ${c.uptime}% of the last 30 days without issues`}>
              {c.history.map((h, i) => (
                <span key={i} title={`${s.days[i]}: ${h ? WORD[h] : "No data"}`} className={cn("h-7 flex-1 rounded-sm", h ? TONE[h] : "bg-surface-3")} />
              ))}
            </div>
            <p className="flex justify-between text-xs text-ink-3">
              <span>30 days ago</span>
              <span>{c.uptime}% without issues</span>
              <span>Today</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
