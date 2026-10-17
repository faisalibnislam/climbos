"use client";

import { SectionIcon } from "../SectionIcon";
import { Activity, CreditCard, Gauge, ShieldCheck, SlidersHorizontal, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconTile } from "@/components/ui";
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
      <p className="mb-2 hidden px-3 text-sm font-semibold uppercase tracking-[0.08em] text-ink-3 lg:block">Settings</p>
      <ul className="flex gap-1 lg:flex-col">
        {SETTINGS_SECTIONS.map((s) => {
          const active = current === s.key;
          return (
            <li key={s.key} className="shrink-0">
              <Link
                href={`/app/${slug}/settings/${s.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-[0.95rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                  active && "bg-brand-50 text-brand-900 ring-1 ring-brand-200",
                )}
              >
                <IconTile icon={s.icon} tone={s.tone} size="sm" />
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
      <div className="flex min-w-0 items-start gap-4">
        <SectionIcon section="settings" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-3">Settings</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          {intro ? <p className="mt-1 max-w-2xl leading-relaxed text-ink-2">{intro}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
