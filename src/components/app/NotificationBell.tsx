"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AtSign, Bell, CheckCircle2, ClipboardList, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { relativeTime } from "./money";

const ICON = { mention: AtSign, assigned: ClipboardList, approval: CheckCircle2, comment: MessageSquare, system: Bell } as const;

/** The bell: mentions, assignments, approval requests and team news. */
export function NotificationBell({ slug }: { slug: string }) {
  const data = useQuery(api.team.myNotices, {});
  const markRead = useMutation(api.team.markNoticesRead);
  const unread = data?.unread ?? 0;
  return (
    <Popover onOpenChange={(open) => (open && unread ? void markRead({}) : undefined)}>
      <PopoverTrigger aria-label={unread ? `Notifications, ${unread} new` : "Notifications"} className="relative hidden size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 sm:inline-flex">
        <Bell className="size-4" aria-hidden />
        {unread ? <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-xs font-semibold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-line px-4 py-2.5 text-ui font-medium text-ink">Notifications</p>
        {data?.items.length ? (
          <ul className="max-h-96 overflow-auto">
            {data.items.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <Link href={n.href} className={cn("flex gap-3 px-4 py-3 text-sm hover:bg-surface-2", !n.read && "bg-brand-50/50")}>
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-800" />
                    <span className="min-w-0">
                      <span className="block text-ink-2">{n.text}</span>
                      <span className="text-xs text-ink-3">{relativeTime(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-ink-3">Nothing new. Mentions, assignments and approval requests show up here.</p>
        )}
        <Link href={`/app/${slug}/settings/activity`} className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-brand-800 hover:underline">
          All activity
        </Link>
      </PopoverContent>
    </Popover>
  );
}
