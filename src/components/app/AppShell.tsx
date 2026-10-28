"use client";

import { NotificationBell } from "./NotificationBell";
import { Presence } from "./Presence";
import { LowCreditBanner } from "./LowCreditBanner";
import { CreditMeter } from "./CreditMeter";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BarChart3, CalendarDays, ChevronDown, Compass, Home, Inbox, LogOut, Magic, Megaphone, Menu, PanelLeftClose, PanelLeftOpen, PanelsTopLeft, PauseCircle, PlayCircle, Plug, Search, Settings, Users, type LucideIcon } from "@/components/icons";
import { CommandPalette } from "./CommandPalette";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { JobToasts, TeamActivity } from "./TeamActivity";
import { ClimbProvider, useClimb } from "@/components/climb/context";
import { ClimbPanel } from "@/components/climb/ClimbPanel";
import { PointOverlay } from "@/components/climb/PointOverlay";
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
  DropdownMenuTrigger,
  Kbd,
  Tooltip,
  Sheet,
  SheetClose,
  Toaster,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";
import { PRIMARY_NAV, appArea, appHref } from "./navigation";
import { SkipLink } from "@shared/a11y/SkipLink";

const NAV_ICONS: Record<string, LucideIcon> = { today: Home, plan: Compass, channels: Megaphone, work: CalendarDays, customers: Users, results: BarChart3, tools: PanelsTopLeft };
const NAV: { key: string; label: string; icon: LucideIcon; group: string }[] = PRIMARY_NAV.map((item) => ({ ...item, icon: NAV_ICONS[item.key], group: "" }));
const NAV_GROUPS = [""];
const MOBILE_PRIMARY = ["today", "work", "customers", "results"];

/**
 * Authenticated app frame: six primary destinations, Settings, a workspace
 * switcher, a persistent "Demo data" indicator and a Pause all control that
 * works on mobile. Permission and existence checks happen in Convex; this
 * component only renders what the backend returns.
 */
export function AppShell({ slug, children, workspace = false }: { slug: string; children: ReactNode; workspace?: boolean }) {
  const identity = useQuery(api.orgs.me);
  return (
    <ClimbProvider key={`${slug}:${identity?.userId ?? "loading"}`}>
      <Shell slug={slug} workspace={workspace}>
        {children}
      </Shell>
    </ClimbProvider>
  );
}

/**
 * `workspace` is for full-canvas tools (the design studio): the sidebar starts
 * as an icon rail, the page fills the space under the top bar, and the phone
 * bottom bar steps aside.
 */
function Shell({ slug, children, workspace }: { slug: string; children: ReactNode; workspace: boolean }) {
  const climb = useClimb();
  const me = useQuery(api.orgs.me);
  const inboxUnread = useQuery(api.inbox.unread, { slug });
  const pause = useQuery(api.workspace.pauseStatus, { slug });
  const pathname = usePathname();
  const current = me?.orgs.find((o) => o.slug === slug);
  const isDemo = current?.kind === "demo";
  const section = appArea(pathname.startsWith("/studio/") ? "studio" : (pathname.split("/")[3] ?? "today"));
  const [rail, setRail] = useState(workspace);

  return (
    <div className={cn("bg-bg", workspace ? "flex h-dvh flex-col" : "min-h-dvh")}>
      <SkipLink />
      <Toaster />
      <CommandPalette slug={slug} />
      <ClimbPanel slug={slug} />
      <PointOverlay />
      {isDemo && <DemoBanner slug={slug} />}
      {pause?.paused && <PausedBanner slug={slug} canResume={current?.role === "owner" || current?.role === "admin"} />}
      <div className={cn("flex w-full", workspace && "min-h-0 flex-1")}>
        {/* Desktop sidebar (an icon rail when collapsed) */}
        <aside
          className={cn(
            "sticky top-0 hidden shrink-0 flex-col overflow-y-auto border-r border-line bg-surface pb-3 pt-3 lg:flex",
            workspace ? "h-full" : "h-dvh",
            rail ? "w-14 items-center px-1.5" : "w-60 px-2",
          )}
          aria-label="Main"
        >
          <div className={cn("mb-3 flex items-center", rail ? "flex-col gap-2" : "justify-between px-2")}>
            <Link href={`/app/${slug}/today`} aria-label="ClimbOS home">
              <Logo markClassName="size-6" className={cn("[&>span:last-child]:text-base", rail && "[&>span:last-child]:hidden")} />
            </Link>
            {workspace ? (
              <Tooltip content={rail ? "Expand sidebar" : "Collapse sidebar"}>
                <button type="button" onClick={() => setRail((r) => !r)} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!rail} className={buttonClasses({ variant: "ghost", size: "sm", className: "w-8 px-0 text-ink-3" })}>
                  {rail ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
                </button>
              </Tooltip>
            ) : null}
          </div>
          {rail ? null : <WorkspaceSwitcher slug={slug} />}
          <nav className={cn("mt-3 flex flex-col gap-2", rail && "items-center")} aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <NavGroup key={group || "home"} label={rail ? "" : group}>
                {NAV.filter((n) => n.group === group).map((item) => (
                  <NavLink key={item.key} compact={rail} href={appHref(slug, item.key)} active={section === item.key} icon={<item.icon className="size-4" aria-hidden />} badge={item.key === "customers" ? inboxUnread : undefined}>
                    {item.label}
                  </NavLink>
                ))}
              </NavGroup>
            ))}
          </nav>
          <div className={cn("mt-auto flex flex-col gap-1 pt-4", rail && "items-center")}>
            <NavLink compact={rail} href={`/app/${slug}/today#review`} active={false} icon={<Inbox className="size-4" aria-hidden />}>Review work</NavLink>
            <NavLink compact={rail} href={`/app/${slug}/connections`} active={pathname.endsWith("/connections")} icon={<Plug className="size-4" aria-hidden />}>Connected accounts</NavLink>
            <CreditMeter slug={slug} rail={rail} />
            <NavLink compact={rail} href={`/app/${slug}/settings/team`} active={section === "settings" && !pathname.endsWith("/connections")} icon={<Settings className="size-4" aria-hidden />}>
              Settings
            </NavLink>
            {rail ? null : <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="sidebar" />}
          </div>
        </aside>

        <div className={cn("flex min-w-0 flex-1 flex-col transition-[margin] duration-200", climb.open && "sm:mr-[400px]", workspace && "min-h-0")}>
          {/* Top bar: make a wish or search (⌘K), team activity, pause, account */}
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-4">
            <Link href={`/app/${slug}/today`} aria-label="ClimbOS home" className="lg:hidden">
              <Logo markClassName="size-6" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline [&>span:last-child]:text-base" />
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("climbos:command"))}
              className="mx-auto flex h-8 w-full min-w-0 max-w-md items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-left text-ui text-ink-3 transition-colors hover:border-ink-3"
            >
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="flex-1 truncate">Search</span>
              <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            </button>
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <TeamActivity slug={slug} />
              <JobToasts slug={slug} />
              <Button
                size="sm"
                variant="secondary"
                aria-pressed={climb.open}
                aria-label="Ask Climb about this page"
                onClick={() => climb.setOpen((o) => !o)}
                className="gap-1.5"
              >
                <Magic aria-hidden /> <span className="hidden md:inline">Ask Climb</span>
              </Button>
              <PauseAllButton slug={slug} paused={Boolean(pause?.paused)} variant="compact" />
              <Presence slug={slug} />
              <NotificationBell slug={slug} />
              <AccountMenu />
            </div>
          </header>
          <LowCreditBanner slug={slug} />
          <main id="main" tabIndex={-1} className={workspace ? "min-h-0 flex-1 overflow-auto" : "flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12"}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation: four destinations and More */}
      <nav hidden={workspace} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.key)).map((item) => {
            const active = section === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={`/app/${slug}/${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-ink" : "text-ink-3 hover:text-ink")}
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.key === "plan" ? "Plan" : item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet
              side="bottom"
              title="More"
              trigger={
                <button
                  type="button"
                  className={cn(
                    "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-2xs font-medium",
                    NAV.some((n) => !MOBILE_PRIMARY.includes(n.key) && n.key === section) || section === "settings" ? "text-brand-800" : "text-ink-3 hover:text-ink",
                  )}
                >
                  <Menu className="size-5" aria-hidden />
                  More
                </button>
              }
            >
              <ul className="grid grid-cols-3 gap-2 pb-[env(safe-area-inset-bottom)]">
                {[...NAV.filter((n) => !MOBILE_PRIMARY.includes(n.key)), { key: "review", label: "Review work", icon: Inbox, group: "" }, { key: "connections", label: "Connected accounts", icon: Plug, group: "" }, { key: "settings", label: "Settings", icon: Settings, group: "" }].map((item) => (
                  <li key={item.key}>
                    <SheetClose asChild>
                      <Link
                        href={item.key === "settings" ? `/app/${slug}/settings/team` : appHref(slug, item.key)}
                        aria-current={section === item.key ? "page" : undefined}
                        className={cn(
                          "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border px-2 text-center text-ui font-medium",
                          section === item.key ? "border-ink bg-surface text-ink shadow-[var(--card-shadow)]" : "border-line bg-surface text-ink hover:bg-surface-2",
                        )}
                      >
                        <item.icon className="size-5" aria-hidden />
                        {item.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
            </Sheet>
          </li>
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

function NavLink({ href, active, icon, children, compact = false, badge }: { href: string; active: boolean; icon: ReactNode; children: ReactNode; compact?: boolean; badge?: number }) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={compact && typeof children === "string" ? children : undefined}
      className={cn(
        "relative flex h-[var(--h-sm)] items-center gap-2.5 rounded-[var(--radius-control)] text-ui transition-colors",
        compact ? "w-9 justify-center px-0" : "px-2",
        active ? "bg-surface font-medium text-ink shadow-[var(--card-shadow)]" : "text-ink-2 hover:bg-surface/60 hover:text-ink",
      )}
    >
      {icon}
      {compact ? null : children}
      {badge ? (
        <span className={cn("rounded-[var(--radius-badge)] bg-ink px-1.5 text-2xs font-semibold leading-4 text-white tabular-nums", compact ? "absolute -right-1 -top-1" : "ml-auto")} aria-label={`${badge} unread`}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
  return compact ? (
    <Tooltip content={children} side="right">
      {link}
    </Tooltip>
  ) : (
    link
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
    <div className="bg-ink px-4 py-2 text-sm text-white" role="note">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex h-5 items-center rounded-md bg-white/20 px-1.5 text-xs font-medium">Demo data</span>
        <span>
          Synthetic numbers. Nothing real is sent or spent.
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
        <span>No new posts, emails, ads or AI jobs.</span>
        {canResume && (
          <ConfirmDialog
            trigger={<Button size="sm" variant="secondary" className="ml-auto">Resume activity</Button>}
            title="Resume activity?"
            description="New work can start. Unscheduled posts stay unscheduled."
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
  const [receipt, setReceipt] = useState<{ n: number; text: string }[] | null>(null);
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
        description="This immediately:"
        confirmLabel="Pause all activity"
        tone="danger"
        onConfirm={async () => {
          try {
            const r = await pauseAll({ slug });
            setReceipt([
              { n: r.canceledRuns, text: `job${r.canceledRuns === 1 ? "" : "s"} canceled` },
              { n: r.unscheduled, text: `post${r.unscheduled === 1 ? "" : "s"} unscheduled` },
              ...(r.campaignsPausing ? [{ n: r.campaignsPausing, text: `ad campaign pause${r.campaignsPausing === 1 ? "" : "s"} requested (see Activity)` }] : []),
            ]);
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
      >
        <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
          {["Cancels unstarted AI jobs", "Unschedules waiting posts", "Blocks new posts, emails and ad changes", "Asks Google and Meta to pause ads"].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <PauseCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" /> {t}
            </li>
          ))}
        </ul>
        <Callout tone="info" className="mt-3">
          Ads may take a while to stop; some earlier spend may still report.
        </Callout>
      </ConfirmDialog>
      {receipt && (
        <Callout tone="warning" live="status" className="mt-2 text-sm" title="Paused">
          <ul className="flex flex-col gap-0.5">
            {receipt.map((t) => (
              <li key={t.text}>
                <strong className="font-semibold tabular-nums text-ink">{t.n}</strong> {t.text}
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </>
  );
}
