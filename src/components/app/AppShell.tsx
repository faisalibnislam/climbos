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
  Plane,
  Sparkles,
  Bell,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { TeamActivity } from "./TeamActivity";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  buttonClasses,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Skeleton,
  Toaster,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";

const NAV: { key: string; label: string; icon: LucideIcon; group: string; href?: string }[] = [
  { key: "today", label: "Today", icon: Home, group: "" },
  { key: "plan", label: "Growth plan", icon: Compass, group: "Grow" },
  { key: "content", label: "Content", icon: CalendarDays, group: "Grow" },
  { key: "autopilot", label: "Autopilot", icon: Plane, group: "Grow" },
  { key: "studio", label: "Design studio", icon: Palette, group: "Grow", href: "" },
  { key: "results", label: "Results", icon: BarChart3, group: "Measure" },
  { key: "connections", label: "Connections", icon: Plug, group: "Setup" },
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
      <CommandPalette slug={slug} />
      {isDemo && <DemoBanner slug={slug} />}
      {pause?.paused && <PausedBanner slug={slug} canResume={current?.role === "owner" || current?.role === "admin"} />}
      <div className="flex w-full">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-2 pb-3 pt-3 lg:flex" aria-label="Main">
          <Link href={`/app/${slug}/today`} className="mb-3 px-2" aria-label="ClimbOS home">
            <Logo markClassName="size-6" className="[&>span:last-child]:text-base" />
          </Link>
          <WorkspaceSwitcher slug={slug} />
          <nav className="mt-3 flex flex-col gap-2" aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <NavGroup key={group || "home"} label={group}>
                {NAV.filter((n) => n.group === group).map((item) => (
                  <NavLink key={item.key} href={item.key === "studio" ? `/studio/${slug}/new` : `/app/${slug}/${item.key}`} active={section === item.key} icon={<item.icon className="size-4" aria-hidden />}>
                    {item.label}
                  </NavLink>
                ))}
              </NavGroup>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-1 pt-4">
            <Link href={`/app/${slug}/settings/billing`} className={buttonClasses({ variant: "accent", size: "sm", className: "mb-1 w-full" })}>
              Plans and usage
            </Link>
            <NavLink href={`/app/${slug}/settings/team`} active={section === "settings"} icon={<Settings className="size-4" aria-hidden />}>
              Settings
            </NavLink>
            <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="sidebar" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: make a wish or search (⌘K), team activity, pause, account */}
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-4">
            <Link href={`/app/${slug}/today`} aria-label="ClimbOS home" className="lg:hidden">
              <Logo markClassName="size-6" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline [&>span:last-child]:text-base" />
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("climbos:command"))}
              className="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-left text-ui text-ink-3 transition-colors hover:border-ink-3"
            >
              <Sparkles className="size-4 shrink-0 text-sun-strong" aria-hidden="true" />
              <span className="flex-1 truncate">Tell your team what you want…</span>
              <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <TeamActivity slug={slug} />
              <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="compact" />
              <Link href={`/app/${slug}/settings/activity`} className={buttonClasses({ variant: "ghost", size: "sm", className: "w-8 px-0 text-ink-2" })} aria-label="Activity">
                <Bell className="size-4" aria-hidden />
              </Link>
              <AccountMenu />
            </div>
          </header>
          <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => !n.href && n.key !== "connections").map((item) => {
            const active = section === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={`/app/${slug}/${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-brand-800" : "text-ink-3 hover:text-ink")}
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

/** Collapsible nav group, like Apollo's sidebar sections. */
function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!label) return <div className="flex flex-col gap-px">{children}</div>;
  return (
    <div className="flex flex-col gap-px">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-overline flex h-7 items-center justify-between rounded-lg px-2 hover:bg-surface-2 hover:text-ink"
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
      </button>
      {open ? children : null}
    </div>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-ui transition-colors",
        active ? "bg-surface-3/70 font-medium text-ink [&_svg]:text-brand-800" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
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
  if (!me) return <Skeleton className="h-10 w-full" />;
  const current = me.orgs.find((o) => o.slug === slug);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left hover:bg-surface-2">
          <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-800 text-xs font-semibold text-white">
            {(current?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui font-medium text-ink">{current?.name ?? "…"}</span>
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
        <button type="button" className="grid size-8 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-ink-2 hover:ring-2 hover:ring-line-strong" aria-label={`Account: ${me.isAnonymous ? "Guest (demo)" : (me.email ?? me.name ?? "Account")}`}>
          {(me.isAnonymous ? "G" : (me.name ?? me.email ?? "A")).slice(0, 2).toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">{me.isAnonymous ? "Guest (demo)" : (me.email ?? me.name ?? "Account")}</DropdownMenuLabel>
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
        <span className="inline-flex h-5 items-center rounded-md bg-white/20 px-1.5 text-xs font-medium">Demo data</span>
        <span>
          Formkit example with synthetic numbers. Nothing here posts, emails or spends real money.
        </span>
        <span className="ml-auto flex gap-3">
          <button
            type="button"
            className={buttonClasses({ variant: "link", className: "text-white decoration-white/50 hover:decoration-white" })}
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
          <Link href="/sign-in?switch=1&next=/onboarding" className={buttonClasses({ variant: "link", className: "text-white decoration-white/50 hover:decoration-white" })}>
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
        <strong className="font-semibold">All activity is paused.</strong>
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
      <div className="flex h-8 items-center gap-2 rounded-lg bg-amber-100 px-2 text-ui font-medium text-amber-800">
        <PlayCircle className="size-4" aria-hidden /> Activity paused
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
            <Button variant={variant === "sidebar" ? "ghost" : "secondary"} size={variant === "large" ? "lg" : variant === "sidebar" ? "sm" : "md"} className={cn(variant === "sidebar" && "h-8 w-full justify-start px-2 font-normal text-ink-2")}>
              <PauseCircle className="size-4" aria-hidden /> Pause all activity
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
