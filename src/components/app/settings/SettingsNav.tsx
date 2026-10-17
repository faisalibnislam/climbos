"use client";

import { Activity, CreditCard, Gauge, ShieldCheck, SlidersHorizontal, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { key: "team", label: "Team", icon: Users, tone: "brand" },
  { key: "billing", label: "Billing", icon: CreditCard, tone: "violet" },
  { key: "policies", label: "Policies", icon: SlidersHorizontal, tone: "orange" },
  { key: "activity", label: "Activity", icon: Activity, tone: "teal" },
  { key: "usage", label: "Usage", icon: Gauge, tone: "pink" },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, tone: "green" },
  { key: "profile", label: "Profile", icon: UserRound, tone: "blue" },
] as const;

/** Settings sub-navigation: a scrollable row on mobile, a vertical list on desktop. */
export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const current = pathname.split("/")[4] ?? "team";
  return (
    <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:overflow-visible lg:px-0">
      <p className="mb-1 hidden px-2 text-xs font-medium text-ink-3 lg:block">Settings</p>
      <ul className="flex gap-1 lg:flex-col">
        {SETTINGS_SECTIONS.map((s) => {
          const active = current === s.key;
          return (
            <li key={s.key} className="shrink-0">
              <Link
                href={`/app/${slug}/settings/${s.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                  active && "bg-[rgb(16_24_40/0.07)] font-medium text-ink",
                )}
              >
                <s.icon aria-hidden="true" className="size-4 shrink-0" />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Title block used by each settings page (one h1 per page). */
export function SettingsHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-3">Settings</p>
        <h1 className="text-[28px] leading-9 text-ink">{title}</h1>
        {intro ? <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-3">{intro}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
