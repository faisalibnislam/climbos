"use client";

import { Activity, BookOpenCheck, Bot, CreditCard, Gauge, LayoutGrid, Palette, ShieldCheck, SlidersHorizontal, Sparkles, Target, UserRound, Users, Webhook } from "@/components/icons"
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { can, type MemberRole } from "@shared/policy";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "../results/QueryBoundary";

/** Each section shows only to roles that can use it (the server checks again on every call). */
export const SETTINGS_SECTIONS = [
  { key: "business", label: "Business & goal", icon: Target, tone: "brand", permission: "view" },
  { key: "team", label: "Team", icon: Users, tone: "brand", permission: "view" },
  { key: "workspaces", label: "Workspaces", icon: LayoutGrid, tone: "teal", permission: "manage_team" },
  { key: "billing", label: "Billing", icon: CreditCard, tone: "violet", permission: "view" },
  { key: "ai", label: "Climb AI", icon: Sparkles, tone: "brand", permission: "view" },
  { key: "brand", label: "Brand kit", icon: Palette, tone: "pink", permission: "view" },
  { key: "facts", label: "Business facts", icon: BookOpenCheck, tone: "green", permission: "view" },
  { key: "policies", label: "Policies", icon: SlidersHorizontal, tone: "orange", permission: "view" },
  { key: "activity", label: "Activity", icon: Activity, tone: "teal", permission: "view" },
  { key: "usage", label: "Usage", icon: Gauge, tone: "pink", permission: "view" },
  { key: "agents", label: "Agents & MCP", icon: Bot, tone: "violet", permission: "edit" },
  { key: "webhooks", label: "Webhooks", icon: Webhook, tone: "teal", permission: "manage_connections" },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, tone: "green", permission: "export" },
  { key: "profile", label: "Profile", icon: UserRound, tone: "blue", permission: null },
] as const;

/** Settings sub-navigation: a scrollable row on mobile, a vertical list on desktop. */
export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const current = pathname.split("/")[4] ?? "team";
  const me = useQuery(api.orgs.me);
  const role = me?.orgs.find((o) => o.slug === slug)?.role as MemberRole | undefined;
  // Until the role is known (or for a staff read-only view) show what a viewer may see.
  const sections = SETTINGS_SECTIONS.filter((s) => s.permission === null || can(role ?? "viewer", s.permission));
  return (
    <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:overflow-visible lg:px-0">
      <p className="text-overline mb-1 hidden px-2 lg:block">Settings</p>
      <ul className="flex gap-1 lg:flex-col">
        {sections.map((s) => {
          const active = current === s.key;
          return (
            <li key={s.key} className="shrink-0">
              <Link
                href={`/app/${slug}/settings/${s.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[var(--h-sm)] items-center gap-2.5 rounded-[var(--radius-control)] px-2 text-ui text-ink-2 transition-colors hover:bg-surface/60 hover:text-ink",
                  active && "bg-surface font-medium text-ink shadow-[var(--card-shadow)]",
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
    <PageHeader eyebrow="Settings" title={title} intro={intro} actions={actions} section="settings" />
  );
}
