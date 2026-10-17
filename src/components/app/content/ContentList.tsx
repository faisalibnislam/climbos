"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Flag, ImageIcon, Inbox } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime } from "../money";
import { ArtifactStatus, ChannelTag, RoleName, SectionBoundary, useNow } from "./shared";

export type ArtifactStatusValue =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "exported"
  | "failed"
  | "uncertain"
  | "archived";

type ListItem = FunctionReturnType<typeof api.content.list>["page"][number];

export const FILTERS: { key: string; label: string; statuses: ArtifactStatusValue[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "in_review", label: "Needs approval", statuses: ["in_review"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
  { key: "published", label: "Published", statuses: ["published"] },
  { key: "problems", label: "Uncertain / Failed", statuses: ["uncertain", "failed"] },
  { key: "draft", label: "Drafts", statuses: ["draft"] },
];

/** Map a ?status= value to a filter chip key. */
export function filterKeyFromParam(param: string | null): string {
  if (!param) return "all";
  if (param === "uncertain" || param === "failed") return "problems";
  return FILTERS.some((f) => f.key === param) ? param : "all";
}

export function FilterChips({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f.key)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.95rem] font-medium transition-colors",
              active ? "border-green-800 bg-green-800 text-white" : "border-line-strong bg-surface text-ink-2 hover:border-green-700 hover:text-ink",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function ContentList({ slug, filterKey }: { slug: string; filterKey: string }) {
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  return (
    <SectionBoundary label="your content" key={filter.key}>
      {filter.statuses && filter.statuses.length > 1 ? (
        <CombinedList slug={slug} statuses={filter.statuses} label={filter.label} />
      ) : (
        <SingleList slug={slug} status={filter.statuses?.[0]} label={filter.label} />
      )}
    </SectionBoundary>
  );
}

function SingleList({ slug, status, label }: { slug: string; status?: ArtifactStatusValue; label: string }) {
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.content.list, { slug, status }, { initialNumItems: 20 });
  return <ListBody slug={slug} items={results} pageStatus={pageStatus} onMore={() => loadMore(20)} label={label} />;
}

/** "Uncertain / Failed" needs two statuses; the API filters one at a time, so merge two pages. */
function CombinedList({ slug, statuses, label }: { slug: string; statuses: ArtifactStatusValue[]; label: string }) {
  const a = usePaginatedQuery(api.content.list, { slug, status: statuses[0] }, { initialNumItems: 20 });
  const b = usePaginatedQuery(api.content.list, { slug, status: statuses[1] }, { initialNumItems: 20 });
  const items = [...a.results, ...b.results].sort((x, y) => y.updatedAt - x.updatedAt);
  const pageStatus =
    a.status === "LoadingFirstPage" || b.status === "LoadingFirstPage"
      ? "LoadingFirstPage"
      : a.status === "LoadingMore" || b.status === "LoadingMore"
        ? "LoadingMore"
        : a.status === "CanLoadMore" || b.status === "CanLoadMore"
          ? "CanLoadMore"
          : "Exhausted";
  return (
    <ListBody
      slug={slug}
      items={items}
      pageStatus={pageStatus}
      onMore={() => {
        if (a.status === "CanLoadMore") a.loadMore(20);
        if (b.status === "CanLoadMore") b.loadMore(20);
      }}
      label={label}
    />
  );
}

function ListBody({
  slug,
  items,
  pageStatus,
  onMore,
  label,
}: {
  slug: string;
  items: ListItem[];
  pageStatus: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onMore: () => void;
  label: string;
}) {
  if (pageStatus === "LoadingFirstPage") {
    return (
      <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
        <span className="sr-only" role="status">
          Loading content…
        </span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title={label === "All" ? "No content yet" : `Nothing in “${label}”`}
        body={
          label === "All"
            ? "Use “Create content” and your AI team will write drafts for you to review. Nothing goes live until you approve it."
            : "Try another filter, or create new content."
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" role="status">
        Showing {items.length} item{items.length === 1 ? "" : "s"}.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <ContentCard slug={slug} item={item} />
          </li>
        ))}
      </ul>
      {pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onMore} loading={pageStatus === "LoadingMore"} loadingText="Loading more…">
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ContentCard({ slug, item }: { slug: string; item: ListItem }) {
  const now = useNow();
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-sm transition-colors focus-within:border-green-700 hover:border-line-strong">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChannelTag channel={item.channel} />
        {item.scheduledFor && item.status === "scheduled" ? (
          <span className="text-sm text-ink-3">For {now ? formatDateTime(item.scheduledFor) : "…"}</span>
        ) : null}
      </div>
      <h3 className="text-lg font-semibold leading-snug text-ink">
        <Link href={`/app/${slug}/content/${item.id}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-lg)] focus-visible:outline-none">
          {item.title}
        </Link>
      </h3>
      <ArtifactStatus status={item.status} showHelp />
      {item.preview ? <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-ink-2">{item.preview}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-ink-3">
        <span>
          Created by <RoleName role={item.createdByRole} className="text-ink-2" />
        </span>
        {item.hasImage ? (
          <span className="inline-flex items-center gap-1">
            <ImageIcon aria-hidden="true" className="size-4" /> Has image
          </span>
        ) : null}
        {item.flags > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-amber-800">
            <Flag aria-hidden="true" className="size-4" /> {item.flags} claim{item.flags === 1 ? "" : "s"} to check
          </span>
        ) : null}
        <span>Updated {now ? relativeTime(item.updatedAt, now) : "…"}</span>
      </div>
    </article>
  );
}
