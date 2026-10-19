"use client";

/*
 * Notification center: bell with unread count, popover with All / Unread,
 * grouped by day, mark one or all as read, per-item action.
 */
import { useState, type ReactNode } from "react";
import { Bell, BellRing, CheckCircle2, Settings } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger, Segmented, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  /** Display time, e.g. "5m", "Yesterday". */
  time: string;
  /** Grouping label, e.g. "Today". */
  group: string;
  read: boolean;
  icon?: ReactNode;
  actionLabel?: string;
}

export function NotificationCenter({
  items,
  onRead,
  onReadAll,
  onAction,
  onSettings,
}: {
  items: NotificationItem[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onAction?: (id: string) => void;
  onSettings?: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = items.filter((i) => !i.read).length;
  const list = filter === "unread" ? items.filter((i) => !i.read) : items;
  const groups = [...new Set(list.map((i) => i.group))];
  return (
    <Popover>
      <Tooltip content="Notifications">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative grid size-[var(--h-md)] place-items-center rounded-[var(--radius-control)] text-ink-2 outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-surface"
          >
            {unread ? <BellRing aria-hidden className="size-[18px]" /> : <Bell aria-hidden className="size-[18px]" />}
            {unread ? (
              <span aria-hidden className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-[var(--radius-badge)] bg-ink px-1 text-[10px] font-semibold tabular-nums text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="flex max-h-[min(32rem,80dvh)] w-[min(24rem,calc(100vw-2rem))] flex-col p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="heading-card">Notifications</p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!unread} onClick={onReadAll} className="rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium text-ink-2 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50">
              Mark all read
            </button>
            {onSettings ? (
              <button type="button" aria-label="Notification settings" onClick={onSettings} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <Settings aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="px-4 py-2">
          <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread (${unread})` }]} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {list.length ? (
            groups.map((g) => (
              <section key={g} aria-label={g}>
                <p className="text-overline px-4 pb-1 pt-2">{g}</p>
                <ul>
                  {list
                    .filter((i) => i.group === g)
                    .map((n) => (
                      <li key={n.id} className={cn("relative flex gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60", !n.read && "bg-brand-50/60")}>
                        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface text-ink-2 [&_svg]:size-4">
                          {n.icon ?? <Bell />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => onRead(n.id)} className="w-full text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--focus-ring)]">
                            <span className={cn("block text-ui", n.read ? "text-ink-2" : "font-semibold text-ink")}>{n.title}</span>
                            {n.body ? <span className="mt-0.5 block text-xs text-ink-3">{n.body}</span> : null}
                            {!n.read ? <span className="sr-only">, unread. Mark as read.</span> : null}
                          </button>
                          <div className="mt-1.5 flex items-center gap-3 text-2xs text-ink-3">
                            <span>{n.time}</span>
                            {n.actionLabel && onAction ? (
                              <button type="button" onClick={() => onAction(n.id)} className="relative z-10 rounded-[var(--radius-control)] font-semibold text-brand-800 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                                {n.actionLabel}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {!n.read ? <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-ink" /> : null}
                      </li>
                    ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CheckCircle2 aria-hidden className="size-6 text-brand-700" />
              <p className="heading-card">You&apos;re all caught up</p>
              <p className="text-ui text-ink-3">New approvals and replies will land here.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
