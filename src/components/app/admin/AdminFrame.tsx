"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ops", label: "Dashboard", power: "read" },
  { href: "/ops/accounts", label: "Accounts", power: "read" },
  { href: "/ops/plans", label: "Plans & locks", power: "read" },
  { href: "/ops/staff", label: "Staff", power: "read" },
  { href: "/ops/engine", label: "Engine lab", power: "read" },
  { href: "/ops/knowledge", label: "Knowledge sources", power: "read" },
  { href: "/ops/system", label: "System", power: "operate" },
] as const;

export type AdminMe = NonNullable<ReturnType<typeof useAdminMe>>;

export function useAdminMe() {
  return useQuery(api.admin.me, {});
}

/** Staff-only frame: tabs by power; everyone else sees "not found". */
export function AdminFrame({ children }: { children: (me: AdminMe) => ReactNode }) {
  const me = useAdminMe();
  const path = usePathname();
  if (me === undefined) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-ink-2">
        <Spinner /> Loading…
      </p>
    );
  }
  if (me === null) return <AdminNotFound />;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Admin" className="flex flex-wrap gap-1">
          {TABS.filter((t) => (me.powers as readonly string[]).includes(t.power)).map((t) => {
            const active = t.href === "/ops" ? path === "/ops" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("rounded-[var(--radius-control)] px-3 py-1.5 text-ui", active ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-surface")}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <span className="text-xs text-ink-3">
          {me.email} · {me.role === "owner" ? "Owner" : me.role === "admin" ? "Admin" : "Support"}
        </span>
      </div>
      {children(me)}
    </div>
  );
}

function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-overline">Page not found</p>
      <h1 className="heading-page mt-1">This path doesn&apos;t lead anywhere — yet.</h1>
      <div className="mt-6 flex justify-center">
        <Link href="/app" className={buttonClasses({ size: "lg" })}>
          Go to your workspace
        </Link>
      </div>
    </div>
  );
}
