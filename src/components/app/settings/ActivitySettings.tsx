"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Bot, Cog, Headset, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { formatDateTime, relativeTime } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

const ACTOR: Record<string, { label: string; icon: ReactNode; tone: "neutral" | "blue" | "violet" | "green" }> = {
  user: { label: "Team member", icon: <UserRound />, tone: "green" },
  agent: { label: "AI team", icon: <Bot />, tone: "blue" },
  system: { label: "ClimbOS system", icon: <Cog />, tone: "neutral" },
  operator: { label: "ClimbOS support", icon: <Headset />, tone: "violet" },
};

export function ActivitySettings({ slug }: { slug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(api.settings.activity, { slug }, { initialNumItems: 30 });

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Activity"
        intro="A permanent record of what happened in this workspace and who did it — people, the AI team, ClimbOS itself and ClimbOS support."
      />
      {status === "LoadingFirstPage" ? (
        <LoadingBlock label="Loading activity…" />
      ) : results.length === 0 ? (
        <EmptyState title="No activity yet" body="Actions like approvals, connections and plan changes will appear here." headingLevel="h2" />
      ) : (
        <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
          <h2 id="activity-heading" className="sr-only">
            Activity log, newest first
          </h2>
          <ol className="flex flex-col divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
            {results.map((e) => {
              const a = ACTOR[e.actorType] ?? ACTOR.system;
              return (
                <li key={e.id} className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="leading-relaxed text-ink">{e.summary}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-3">{e.action}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <Badge tone={a.tone} icon={a.icon}>
                      {a.label}
                    </Badge>
                    <time dateTime={new Date(e.createdAt).toISOString()} title={formatDateTime(e.createdAt)} className="text-sm text-ink-3">
                      {relativeTime(e.createdAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
          <div aria-live="polite" className="flex justify-center">
            {status === "CanLoadMore" ? (
              <Button variant="secondary" onClick={() => loadMore(30)}>
                Show older activity
              </Button>
            ) : status === "LoadingMore" ? (
              <Button variant="secondary" loading loadingText="Loading older activity…">
                Show older activity
              </Button>
            ) : (
              <p className="text-sm text-ink-3">That&apos;s everything.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
