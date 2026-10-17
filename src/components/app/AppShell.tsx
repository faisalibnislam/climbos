"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Compass,
  Home,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plug,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  Badge,
  Button,
  Callout,
  IconTile,
  type Tone,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Toaster,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";

const NAV: { key: string; label: string; icon: LucideIcon; tone: Tone; group: string }[] = [
  { key: "today", label: "Today", icon: Home, tone: "brand", group: "" },
  { key: "plan", label: "Growth plan", icon: Compass, tone: "violet", group: "Grow" },
  { key: "content", label: "Content", icon: CalendarDays, tone: "pink", group: "Grow" },
  { key: "results", label: "Results", icon: BarChart3, tone: "teal", group: "Measure" },
  { key: "connections", label: "Connections", icon: Plug, tone: "orange", group: "Setup" },
];
const NAV_GROUPS = ["", "Grow", "Measure", "Setup"];

/**
 * Authenticated app frame: five primary destinations, Settings, a workspace
 * switcher, a persistent "Demo data" indicator and a Pause all control that
 * works on mobile. Permission and existence checks happen in Convex; this
 * component only renders what the backend returns.
 */
export function AppShell({ slug, children }: { slug: string; children: ReactNode }) {
  const me = useQuery(api.orgs.me);
  const pause = useQuery(api.workspace.pauseStatus, { slug });
  const pathname = usePathname();
  const current = me?.orgs.find((o) => o.slug === slug);
  const isDemo = current?.kind === "demo";
  const section = pathname.split("/")[3] ?? "today";

  return (
    <div className="min-h-dvh bg-bg">
      <Toaster />
      {isDemo && <DemoBanner slug={slug} />}
      {pause?.paused && <PausedBanner slug={slug} canResume={current?.role === "owner" || current?.role === "admin"} />}
      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col border-r border-line bg-surface-2 px-4 py-5 lg:flex" aria-label="Main">
          <Link href={`/app/${slug}/today`} className="mb-5 px-2" aria-label="ClimbOS home">
            <Logo />
          </Link>
          <WorkspaceSwitcher slug={slug} />
          <nav className="mt-5 flex flex-col gap-4" aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <div key={group || "home"} className="flex flex-col gap-0.5">
                {group ? <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">{group}</p> : null}
                {NAV.filter((n) => n.group === group).map((item) => (
                  <NavLink key={item.key} href={`/app/${slug}/${item.key}`} active={section === item.key} icon={<IconTile icon={item.icon} tone={item.tone} size="sm" className="nav-tile" />}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-1 pt-6">
            <NavLink href={`/app/${slug}/settings/team`} active={section === "settings"} icon={<IconTile icon={Settings} tone="neutral" size="sm" className="nav-tile" />}>
              Settings
            </NavLink>
            <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="sidebar" />
            <AccountMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
            <Link href={`/app/${slug}/today`} aria-label="ClimbOS home">
              <Logo />
            </Link>
            <div className="flex items-center gap-2">
              <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="compact" />
              <Link href={`/app/${slug}/settings/team`} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Settings">
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
          </header>
          <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = section === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={`/app/${slug}/${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-brand-800" : "text-ink-3 hover:text-ink",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.key === "plan" ? "Plan" : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-lg px-2 text-[15px] font-medium transition-colors [&_.nav-tile]:bg-transparent [&_.nav-tile]:text-current",
        active ? "bg-brand-50 text-brand-900 font-semibold [&_.nav-tile]:bg-brand-800 [&_.nav-tile]:text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function WorkspaceSwitcher({ slug }: { slug: string }) {
  const me = useQuery(api.orgs.me);
  const router = useRouter();
  if (!me) return <Skeleton className="h-12 w-full" />;
  const current = me.orgs.find((o) => o.slug === slug);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex min-h-14 w-full items-center justify-between gap-2.5 rounded-xl border border-line bg-surface px-2.5 text-left hover:border-line-strong">
          <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-sm font-semibold text-white">
            {(current?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-3">Workspace</span>
            <span className="block truncate text-sm font-bold text-ink">{current?.name ?? "…"}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        {me.orgs.map((o) => (
          <DropdownMenuItem key={o.slug} onSelect={() => router.push(`/app/${o.slug}/today`)}>
            <span className="truncate">{o.name}</span>
            {o.kind === "demo" && <Badge tone="violet" className="ml-auto">Demo</Badge>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding?new=1")}>
          <Sparkles className="size-4" aria-hidden /> New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const me = useQuery(api.orgs.me);
  const { signOut } = useAuthActions();
  const router = useRouter();
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm text-ink-2 hover:bg-surface-2">
          <span className="truncate">{me.isAnonymous ? "Guest (demo)" : (me.email ?? me.name ?? "Account")}</span>
          <ChevronDown className="ml-auto size-4 text-ink-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {me.isOperator && <DropdownMenuItem onSelect={() => router.push("/ops")}>Operator console</DropdownMenuItem>}
        {me.isAnonymous && <DropdownMenuItem onSelect={() => router.push("/sign-in?switch=1&next=/onboarding")}>Create a free account</DropdownMenuItem>}
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.push("/");
          }}
        >
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DemoBanner({ slug }: { slug: string }) {
  const reset = useMutation(api.demo.resetDemo);
  const router = useRouter();
  return (
    <div className="bg-hero-gradient px-4 py-2 text-sm text-white" role="note">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1">
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[0.8125rem] font-bold">Demo data</span>
        <span>
          Formkit example with synthetic numbers. Nothing here posts, emails or spends real money.
        </span>
        <span className="ml-auto flex gap-3">
          <button
            className="font-semibold underline underline-offset-2"
            onClick={async () => {
              try {
                const res = await reset({ slug });
                router.push(`/app/${res.slug}/today`);
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
          >
            Reset demo
          </button>
          <Link href="/sign-in?switch=1&next=/onboarding" className="font-semibold underline underline-offset-2">
            Use my own business
          </Link>
        </span>
      </div>
    </div>
  );
}

function PausedBanner({ slug, canResume }: { slug: string; canResume: boolean }) {
  const resume = useMutation(api.workspace.resumeAll);
  return (
    <div className="border-b border-amber-800/20 bg-amber-100 px-4 py-2.5 text-sm text-amber-800" role="status">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
        <PauseCircle className="size-4" aria-hidden />
        <strong>All activity is paused.</strong>
        <span>No new posts, emails, ads or AI jobs will start. You can still read, edit and export.</span>
        {canResume && (
          <ConfirmDialog
            trigger={<Button size="sm" variant="secondary" className="ml-auto">Resume activity</Button>}
            title="Resume activity?"
            description="New work can start again. Posts that were unscheduled when you paused stay unscheduled; reschedule the ones you still want."
            confirmLabel="Resume activity"
            onConfirm={async () => {
              try {
                await resume({ slug });
                toast({ tone: "success", title: "Activity resumed." });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export function PauseAllButton({ slug, paused, variant }: { slug: string; paused: boolean; variant: "sidebar" | "compact" | "large" }) {
  const pauseAll = useMutation(api.workspace.pauseAll);
  const [receipt, setReceipt] = useState<string | null>(null);
  if (paused) {
    return variant === "compact" ? (
      <Badge tone="amber" icon={<PauseCircle />}>Paused</Badge>
    ) : (
      <div className="flex min-h-11 items-center gap-2 rounded-[10px] bg-amber-100 px-3 text-sm font-medium text-amber-800">
        <PlayCircle className="size-5" aria-hidden /> Activity paused
      </div>
    );
  }
  return (
    <>
      <ConfirmDialog
        trigger={
          variant === "compact" ? (
            <Button size="sm" variant="secondary" aria-label="Pause all activity">
              <PauseCircle className="size-4" aria-hidden /> Pause
            </Button>
          ) : (
            <Button variant="secondary" size={variant === "large" ? "lg" : "md"} className={cn(variant === "sidebar" && "justify-start")}>
              <PauseCircle className="size-5" aria-hidden /> Pause all activity
            </Button>
          )
        }
        title="Pause all activity?"
        description={
          <span className="block space-y-2">
            <span className="block">This immediately:</span>
            <span className="block">• cancels AI jobs that haven’t started,</span>
            <span className="block">• unschedules posts waiting to go out,</span>
            <span className="block">• blocks any new posts, emails and ad changes,</span>
            <span className="block">• asks Google and Meta to pause active ad campaigns.</span>
            <span className="block text-ink-3">Ad platforms can take a little while to stop delivery and may report some spend from before the pause. You’ll see which pauses were confirmed.</span>
          </span>
        }
        confirmLabel="Pause all activity"
        tone="danger"
        onConfirm={async () => {
          try {
            const r = await pauseAll({ slug });
            setReceipt(
              `Paused. ${r.canceledRuns} job${r.canceledRuns === 1 ? "" : "s"} canceled, ${r.unscheduled} post${r.unscheduled === 1 ? "" : "s"} unscheduled${r.campaignsPausing ? `, ${r.campaignsPausing} ad campaign pause${r.campaignsPausing === 1 ? "" : "s"} requested (see Activity for confirmations)` : ""}.`,
            );
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
      />
      {receipt && (
        <Callout tone="warning" live="status" className="mt-2 text-sm">
          {receipt}
        </Callout>
      )}
    </>
  );
}
