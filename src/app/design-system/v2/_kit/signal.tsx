"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ChartLine,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  Flag,
  Globe,
  Info,
  LayoutGrid,
  Link2,
  LogOut,
  Megaphone,
  MessageCircle,
  MoreVertical,
  MousePointerClick,
  PanelLeft,
  Plug,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkle,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  TriangleAlert,
  Users,
  UsersRound,
  X,
  Zap,
} from "@/components/icons";
import {
  Button,
  Segmented,
  SocialIcon,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { LogoMark, Wordmark as BrandWordmark } from "@/components/brand/Logo";
import { SHARP_ICONS } from "@/components/icons";
import { ComparisonColumns, TrendBars } from "@/components/analytics";

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

export function Wordmark({
  tone = "ink",
  size = "md",
}: {
  tone?: "ink" | "lime" | "white" | "onLime";
  size?: "sm" | "md" | "lg";
}) {
  const s =
    size === "lg"
      ? { mark: "size-16", text: "text-5xl" }
      : size === "sm"
        ? { mark: "size-6", text: "text-base" }
        : { mark: "size-8", text: "text-xl" };
  const color =
    tone === "lime"
      ? "text-lime"
      : tone === "white"
        ? "text-white"
        : "text-ink";
  return (
    <span
      role="img"
      aria-label="ClimbOS"
      className={cn("inline-flex items-center gap-2", s.text, color)}
    >
      <LogoMark className={s.mark} mono={tone === "onLime"} />
      <BrandWordmark />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

/** Bordered icon tile on KPI cards. */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-9 place-items-center rounded-[3px] border border-line bg-surface text-ink-2 shadow-sm [&_svg]:size-4">
      {children}
    </span>
  );
}

/** Outline change pill (reference: ↑ 5.6% / ↓ 3.2%). */
export function Delta({ value, good }: { value: string; good: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-[var(--radius-badge)] border px-2 text-2xs font-medium tabular-nums",
        good
          ? "border-green-800/30 bg-green-100/50 text-green-800"
          : "border-red-800/30 bg-red-100/50 text-red-800",
      )}
    >
      {value}
    </span>
  );
}

/** Soft status pill (reference: Active / Disabled / Pause / Verified / Rejected). */
type Status = "active" | "paused" | "off" | "verified" | "rejected" | "pending";
export const STATUS: Record<Status, string> = {
  active: "bg-green-100 text-green-800",
  verified: "bg-green-100/70 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  off: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-orange-100/70 text-orange-800",
};
export function StatusPill({
  kind,
  children,
}: {
  kind: Status;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-[var(--radius-badge)] px-2.5 text-xs font-medium",
        STATUS[kind],
      )}
    >
      {children}
    </span>
  );
}

/** Grey tag chip (reference: Campaign A, WhatsApp · Direct). */
export function Tagchip({
  children,
  removable,
}: {
  children: ReactNode;
  removable?: boolean;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs text-ink-2">
      {children}
      {removable ? <X aria-hidden className="size-3.5 text-ink-3" /> : null}
    </span>
  );
}

/** Light dropdown button (reference: Sources ⌄, Last 6 months ⌄). */
export function DropButton({
  children,
  white,
}: {
  children: ReactNode;
  white?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-ui text-ink-2 transition-colors hover:text-ink",
        white ? "bg-surface shadow-[var(--btn-2-shadow)]" : "bg-surface-2",
      )}
    >
      {children}
      <ChevronDown aria-hidden className="size-4" />
    </button>
  );
}

export function Kpi({
  icon,
  value,
  label,
  delta,
  good,
  values,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  delta: string;
  good: boolean;
  values: number[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <IconTile>{icon}</IconTile>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[32px] font-semibold leading-10 tracking-[-0.02em] tabular-nums">
            {value}
          </p>
          <p className="whitespace-nowrap text-ui text-ink-2">{label}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Delta value={delta} good={good} />
          <TrendBars
            label={label}
            values={values}
            previous={values.map(
              (v, i) => v * (good ? 0.86 : 1.12) + (i % 3) * (values[0] * 0.03),
            )}
            good={good}
          />
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  sub,
  actions,
  children,
  className,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="heading-card">{title}</h4>
          {sub ? <p className="text-xs text-ink-3">{sub}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function NavItem({
  icon,
  label,
  active,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-[3px] px-3 text-sm",
        active
          ? "bg-surface font-medium text-ink shadow-[var(--card-shadow)]"
          : "text-ink-2 hover:text-ink",
      )}
    >
      <span aria-hidden className="inline-flex text-ink-2 [&_svg]:size-4">
        {icon}
      </span>
      {label}
    </span>
  );
}

export function NavGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line pt-3">
      <p className="flex items-center gap-1.5 px-3 pb-1 text-ui text-ink-3">
        <span aria-hidden className="text-[9px]">
          ▼
        </span>{" "}
        {label}
      </p>
      {children}
    </div>
  );
}

export function WorkspaceSwitcher() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <span className="grid size-10 place-items-center rounded-[3px] bg-lime text-ink">
        <Store className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          Tartine Bakery
        </span>
        <span className="block text-xs text-ink-3">Local business · Pro</span>
      </span>
      <ChevronsUpDown aria-hidden className="size-4 text-ink-3" />
    </div>
  );
}

export function UpsellCard() {
  return (
    <div className="flex flex-col gap-1 rounded-[5px] bg-sage-ink p-4 text-white">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4" aria-hidden /> More credits, more reach
      </p>
      <p className="text-xs text-white">
        Upgrade to unlock more workspaces and weekly autopilot.
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-10 items-center justify-center gap-1 rounded-[var(--radius-cta)] bg-lime text-sm font-medium text-ink hover:brightness-95"
      >
        Upgrade <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function UserCard() {
  return (
    <div className="flex items-center gap-3 rounded-[4px] bg-surface p-2.5 shadow-[var(--card-shadow)]">
      <span className="grid size-9 place-items-center rounded-[3px] bg-surface-2 text-xs font-semibold">
        MR
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">Maya Rahman</span>
        <span className="block text-xs text-ink-3">Owner</span>
      </span>
      <LogOut aria-hidden className="size-4 text-ink-3" />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col gap-3 p-4 lg:flex">
      <div className="flex items-center justify-between px-1 py-1">
        <Wordmark />
        <PanelLeft aria-hidden className="size-[18px] text-ink-3" />
      </div>
      <WorkspaceSwitcher />
      <NavGroup label="Grow">
        <NavItem icon={<LayoutGrid />} label="Today" active />
        <NavItem icon={<Target />} label="Growth plan" />
        <NavItem icon={<UsersRound />} label="Customers" />
        <NavItem icon={<Megaphone />} label="Campaigns" />
        <NavItem icon={<MessageCircle />} label="Inbox" />
      </NavGroup>
      <NavGroup label="Measure">
        <NavItem icon={<ChartLine />} label="Results" />
        <NavItem icon={<Search />} label="Attribution" />
      </NavGroup>
      <NavGroup label="Workspace settings">
        <NavItem icon={<SlidersHorizontal />} label="General" />
        <NavItem icon={<Zap />} label="Connections" />
        <NavItem icon={<Plug />} label="Integrations" />
        <NavItem icon={<Link2 />} label="Tracking" />
        <NavItem icon={<Sparkle />} label="Autopilot" />
        <NavItem icon={<Users />} label="Team & roles" />
      </NavGroup>
      <div className="mt-auto flex flex-col gap-3 pt-6">
        <UpsellCard />
        <UserCard />
      </div>
    </aside>
  );
}

export function IconRail() {
  const items = [LayoutGrid, Target, UsersRound, MessageCircle];
  const items2 = [ChartLine, Search];
  const items3 = [SlidersHorizontal, Zap, Plug, Link2, Sparkle, Users];
  const Btn = ({ I, active }: { I: typeof LayoutGrid; active?: boolean }) => (
    <span
      className={cn(
        "grid size-10 place-items-center rounded-[3px] text-ink-2",
        active && "bg-surface shadow-[var(--card-shadow)]",
      )}
    >
      <I className="size-[18px]" aria-hidden />
    </span>
  );
  return (
    <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-2 py-5 md:flex">
      <PanelLeft aria-hidden className="mb-3 size-[18px] text-ink-3" />
      <span className="grid size-11 place-items-center rounded-[3px] bg-lime text-ink">
        <Store className="size-[18px]" aria-hidden />
      </span>
      <span className="my-2 h-px w-8 bg-line-strong" />
      {items.map((I, i) => (
        <Btn key={i} I={I} />
      ))}
      <span className="my-2 h-px w-8 bg-line-strong" />
      {items2.map((I, i) => (
        <Btn key={i} I={I} active={i === 0} />
      ))}
      <span className="my-2 h-px w-8 bg-line-strong" />
      {items3.map((I, i) => (
        <Btn key={i} I={I} />
      ))}
      <span className="mt-auto grid size-11 place-items-center rounded-[3px] bg-surface text-xs font-semibold shadow-[var(--card-shadow)]">
        MR
      </span>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

export const RANGES = ["7d", "30d", "3m", "6m", "1y", "Custom"].map((v) => ({
  value: v,
  label: v,
}));

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub: string;
  actions?: ReactNode;
}) {
  const [range, setRange] = useState("30d");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="heading-page">{title}</h3>
        <p className="text-sm text-ink-3">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Time period"
          value={range}
          onChange={setRange}
          options={RANGES}
        />
        <DropButton white>All sources</DropButton>
        <Button variant="secondary" size="sm">
          <Download /> Export
        </Button>
        {actions}
      </div>
    </div>
  );
}

export const FUNNEL: {
  label: string;
  pct: number;
  n: string;
  note: string;
  tone: string;
  bar: string;
}[] = [
  {
    label: "Reached",
    pct: 100,
    n: "2,400",
    note: "",
    tone: "",
    bar: "hatched",
  },
  {
    label: "Replied",
    pct: 45,
    n: "320",
    note: "−86.7% didn't reply",
    tone: "text-red-800",
    bar: "bg-surface-3",
  },
  {
    label: "Qualified",
    pct: 20,
    n: "180",
    note: "−43.8% not a fit",
    tone: "text-amber-800",
    bar: "bg-[#d4d8cf]",
  },
  {
    label: "Call booked",
    pct: 15,
    n: "150",
    note: "−16.7% didn't book",
    tone: "text-sage-ink",
    bar: "bg-[#c4c9bf]",
  },
  {
    label: "Customer",
    pct: 6,
    n: "120",
    note: "−20.0% 30 still deciding",
    tone: "text-ink-3",
    bar: "bg-lime",
  },
];

export function FunnelPanel() {
  return (
    <Panel
      title="Conversion funnel"
      sub="From first contact to paying customer, across the plays you approved"
      actions={
        <>
          <DropButton>Sources</DropButton>
          <DropButton>Last 6 months</DropButton>
        </>
      }
    >
      <div className="mt-3 flex flex-wrap gap-2">
        <Tagchip removable>Cold email · Agencies</Tagchip>
        <Tagchip removable>Google Ads · Brand</Tagchip>
        <Tagchip removable>Instagram</Tagchip>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {FUNNEL.map((f) => (
          <li
            key={f.label}
            className="grid grid-cols-[18px_130px_44px_52px_1fr] items-center gap-3 text-sm"
          >
            <Info aria-hidden className="size-4 text-ink-3" />
            <span className="text-ink-2">{f.label}</span>
            <span className="tabular-nums text-ink-2">{f.pct}%</span>
            <span className="font-medium tabular-nums">{f.n}</span>
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "h-4 rounded-[1.5px]",
                  f.bar === "hatched" ? "flex-1" : cn("shrink-0", f.bar),
                )}
                style={
                  f.bar === "hatched"
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(115deg, var(--surface-3) 0 1.5px, transparent 1.5px 5px)",
                      }
                    : { width: `${Math.max(f.pct, 6) * 0.95}%` }
                }
              />
              {f.note ? (
                <span className={cn("text-annotation truncate", f.tone)}>
                  {f.note}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export const SOURCES: {
  icon: ReactNode;
  name: string;
  reached: string;
  replies: string;
  qualified: string;
  rate: string;
  cpl: string;
  status: Status;
  label: string;
  warn?: boolean;
}[] = [
  {
    icon: <SocialIcon network="google" size="sm" />,
    name: "Google Ads · Brand search",
    reached: "1,200",
    replies: "180",
    qualified: "110",
    rate: "61%",
    cpl: "$3.80",
    status: "active",
    label: "Active",
  },
  {
    icon: <SocialIcon network="facebook" size="sm" />,
    name: "Meta Ads · Lead form",
    reached: "800",
    replies: "90",
    qualified: "45",
    rate: "50%",
    cpl: "$3.80",
    status: "active",
    label: "Active",
  },
  {
    icon: <SocialIcon network="email" size="sm" />,
    name: "Cold email · Agencies",
    reached: "320",
    replies: "32",
    qualified: "12",
    rate: "37%",
    cpl: "$8.40",
    status: "off",
    label: "Stopped",
    warn: true,
  },
  {
    icon: <SocialIcon network="instagram" size="sm" />,
    name: "Instagram · Organic",
    reached: "400",
    replies: "50",
    qualified: "25",
    rate: "50%",
    cpl: "$4.10",
    status: "paused",
    label: "Paused",
  },
];

export function Th({
  children,
  right,
}: {
  children: ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "pb-3 text-ui font-normal text-ink-3",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Box() {
  return (
    <span
      aria-hidden
      className="inline-block size-[18px] rounded-[2px] border-[1.5px] border-control/70 bg-surface align-middle"
    />
  );
}

export function SourcesPanel() {
  return (
    <Panel
      title="Sources"
      sub="Performance by play and channel. Click a row to drill down"
      actions={
        <>
          <DropButton>By spend</DropButton>
          <DropButton>Channel</DropButton>
          <DropButton>By status</DropButton>
        </>
      }
    >
      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <Th>
                <Box />
              </Th>
              <Th>Source</Th>
              <Th right>Reached</Th>
              <Th right>Replies</Th>
              <Th right>Qualified</Th>
              <Th right>Q-rate</Th>
              <Th right>CPL</Th>
              <Th right>Status</Th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((r) => (
              <tr key={r.name} className="border-b border-line last:border-0">
                <td className="py-3.5 pr-3">
                  <Box />
                </td>
                <td className="py-3.5">
                  <span className="flex items-center gap-2.5">
                    {r.icon}
                    {r.name}
                    {r.warn ? (
                      <TriangleAlert
                        aria-label="Needs attention"
                        className="size-4 text-amber-800"
                      />
                    ) : null}
                  </span>
                </td>
                <td className="text-right tabular-nums">{r.reached}</td>
                <td className="text-right tabular-nums">{r.replies}</td>
                <td className="text-right tabular-nums">{r.qualified}</td>
                <td className="text-right tabular-nums">{r.rate}</td>
                <td className="text-right tabular-nums">{r.cpl}</td>
                <td className="text-right">
                  <StatusPill kind={r.status}>{r.label}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export const ACTIVITY: {
  name: string;
  sub: string;
  source: string;
  status: Status;
  label: string;
  time: string;
  ttc: string;
  cost: string;
}[] = [
  {
    name: "A. Tomland",
    sub: "Agency · Austin",
    source: "Cold email",
    status: "verified",
    label: "Call booked",
    time: "15 min ago",
    ttc: "9 min",
    cost: "$4.20",
  },
  {
    name: "No name yet",
    sub: "+1 (201) 523-6434",
    source: "Instagram · DM",
    status: "rejected",
    label: "Duplicate",
    time: "8 min ago",
    ttc: "9 min",
    cost: "$4.20",
  },
  {
    name: "M. Morgan",
    sub: "Studio Morgan",
    source: "Google Ads",
    status: "verified",
    label: "Qualified",
    time: "15 min ago",
    ttc: "9 min",
    cost: "$4.20",
  },
  {
    name: "D. Ruiz",
    sub: "Ruiz & Co",
    source: "Cold email",
    status: "verified",
    label: "Replied",
    time: "23 min ago",
    ttc: "9 min",
    cost: "$4.20",
  },
  {
    name: "No name yet",
    sub: "+1 (201) 321-9058",
    source: "Meta Ads",
    status: "pending",
    label: "Email unverified",
    time: "31 min ago",
    ttc: "9 min",
    cost: "$4.20",
  },
];

export function ActivityPanel() {
  return (
    <Panel
      title="Recent activity"
      sub="Live feed of new leads and replies"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            className="bg-surface-2 shadow-none"
          >
            View all leads <ArrowRight />
          </Button>
          <button
            type="button"
            aria-label="More"
            className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2"
          >
            <MoreVertical className="size-4" />
          </button>
        </>
      }
    >
      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <Th>Lead</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Time</Th>
              <Th>First reply</Th>
              <Th>Cost</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-3">
                  <span className="block font-medium">{r.name}</span>
                  <span className="block text-xs text-ink-3">{r.sub}</span>
                </td>
                <td>
                  <Tagchip>{r.source}</Tagchip>
                </td>
                <td>
                  <StatusPill kind={r.status}>{r.label}</StatusPill>
                </td>
                <td className="tabular-nums">{r.time}</td>
                <td className="tabular-nums">{r.ttc}</td>
                <td className="tabular-nums">{r.cost}</td>
                <td className="text-right">
                  <MoreVertical
                    aria-hidden
                    className="ml-auto size-4 text-ink-3"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function DashboardScreen() {
  return (
    <div className="app-surface flex overflow-hidden rounded-[8px] bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 lg:pl-0">
        <div className="px-1 pt-2">
          <PageHead
            title="Today"
            sub="Booked calls, cost per lead and what ClimbOS did this week"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Kpi
            icon={<UsersRound />}
            value="180"
            label="Qualified leads"
            delta="↑ 5.6%"
            good
            values={[40, 46, 47, 60, 64, 66, 82, 96]}
          />
          <Kpi
            icon={<CircleDollarSign />}
            value="$4.20"
            label="CPL (cost per lead)"
            delta="↓ 3.2%"
            good={false}
            values={[9, 8.4, 6.2, 6.4, 5.1, 4.4, 4.4, 4.3]}
          />
          <Kpi
            icon={<Star />}
            value="63.8%"
            label="Lead quality score"
            delta="↑ 12.6%"
            good
            values={[38, 44, 50, 52, 52, 53, 58, 66]}
          />
        </div>
        <FunnelPanel />
        <SourcesPanel />
        <ActivityPanel />
      </div>
    </div>
  );
}

/* Reports ----------------------------------------------------------- */

export const CUR = [
  2.5, 3.2, 2.2, 4, 3.3, 5, 4.2, 3.4, 5.6, 6.6, 4.5, 5.5, 6.5, 7.5, 5.8, 6.7,
  5.9, 7.8, 8.6, 6.8, 7.4, 8.4, 7.6, 9.6, 8.9, 7.8, 9.9, 10.9, 9.1, 9.8,
];
export const PREV = [
  1.2, 2, 2.6, 1.5, 2.5, 1.6, 3.3, 2.7, 2.1, 3.9, 2.3, 3.4, 2.8, 4.1, 3.6, 3.3,
  5.2, 3.5, 4.5, 3.7, 5, 4.2, 3.6, 5.3, 4.6, 3.8, 5.4, 4.9, 6.7, 5.9,
];

export const WEEKS: [string, number, number, number, number][] = [
  ["Cold email", 32, 38, 41, 45],
  ["Google Ads", 18, 22, 19, 24],
  ["Meta Ads", 8, 6, 7, 9],
  ["Instagram", 12, 14, 16, 15],
];

export function ReportsScreen() {
  const [metric, setMetric] = useState("Qualified");
  return (
    <div className="app-surface flex overflow-hidden rounded-[8px] bg-bg">
      <IconRail />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:pl-0">
        <div className="px-1 pt-2">
          <PageHead
            title="Results"
            sub="Trends across leads, sources and conversions"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <Tabs defaultValue="performance">
            <TabsList>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="funnel">Funnel</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="secondary" size="sm">
            <Plus /> New report
          </Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
          <div className="flex flex-col gap-3">
            <Kpi
              icon={<UsersRound />}
              value="258"
              label="Qualified leads"
              delta="↑ 18.6%"
              good
              values={[40, 50, 60, 72, 74, 75, 88, 100]}
            />
            <Kpi
              icon={<CircleDollarSign />}
              value="$4.20"
              label="CPL"
              delta="↓ 5.6%"
              good={false}
              values={[9, 8.4, 6.2, 6.4, 5.1, 4.4, 4.4, 4.3]}
            />
          </div>
          <Panel
            title="Performance over time"
            sub="Last 30 days vs previous 30 days"
            actions={
              <div className="flex gap-1">
                {["Qualified", "CPL", "Reply rate", "Spend"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={metric === m}
                    onClick={() => setMetric(m)}
                    className={cn(
                      "h-8 rounded-lg px-3 text-ui text-ink-2",
                      metric === m && "bg-surface-2 text-ink",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            }
          >
            <p className="mt-4 text-[32px] font-semibold leading-10 tracking-[-0.02em]">
              258
            </p>
            <p className="text-sm text-ink-2">qualified leads</p>
            <div className="mt-5">
              <ComparisonColumns
                values={CUR.map((v) => Math.round(v))}
                previous={PREV.map((v) => Math.round(v))}
                labels={Array.from({ length: 30 }, (_, i) => `Apr ${i + 1}`)}
                currentLabel="Last 30 days"
                previousLabel="Previous 30 days"
              />
            </div>
          </Panel>
        </div>
        <Panel
          title="Source breakdown by week"
          sub="Lead volume by source · Last 4 weeks"
          actions={<DropButton>Last 4 weeks</DropButton>}
        >
          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <Th>Source</Th>
                  <Th>W1</Th>
                  <Th>W2</Th>
                  <Th>W3</Th>
                  <Th>W4</Th>
                  <Th>Total</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {WEEKS.map(([name, ...w]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="py-3.5">
                      <Tagchip>{name}</Tagchip>
                    </td>
                    {w.map((n, i) => (
                      <td key={i} className="tabular-nums">
                        {n}
                      </td>
                    ))}
                    <td className="font-medium tabular-nums">
                      {w.reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="text-right">
                      <MoreVertical
                        aria-hidden
                        className="ml-auto size-4 text-ink-3"
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3.5 pl-1 text-ink-2">Total</td>
                  {[0, 1, 2, 3].map((i) => (
                    <td key={i} className="tabular-nums">
                      {WEEKS.reduce((s, r) => s + (r[i + 1] as number), 0)}
                    </td>
                  ))}
                  <td className="font-medium tabular-nums">
                    {WEEKS.reduce(
                      (s, r) =>
                        s + (r.slice(1) as number[]).reduce((a, b) => a + b, 0),
                      0,
                    )}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 shadow-[var(--card-shadow)]">
          <div>
            <h4 className="heading-card">Run this report on a schedule</h4>
            <p className="text-xs text-ink-3">
              Send a CSV to email or Slack every Monday
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="bg-surface-2 shadow-none"
          >
            Schedule report <ArrowRight />
          </Button>
        </section>
      </div>
    </div>
  );
}

/* Marketing ---------------------------------------------------------- */

export function Hero() {
  return (
    <div className="marketing bg-hero-grid relative overflow-hidden rounded-[8px] px-4 pt-4 sm:px-8">
      <nav className="flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <Wordmark />
        <div className="hidden items-center gap-8 whitespace-nowrap text-[15px] text-ink lg:flex">
          <span>How it works</span>
          <span>Use cases</span>
          <span>Integrations</span>
          <span>Pricing</span>
          <span>Contact</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="bg-ink/[0.06] hover:bg-ink/10"
          >
            Sign in
          </Button>
          <Button size="lg">Start my free plan</Button>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl pb-10 pt-14 text-center">
        <h1 className="font-display text-5xl font-medium leading-[1.08] tracking-[-0.02em] text-ink sm:text-[64px]">
          Know which plays bring
          <span className="block text-brand-800">real paying customers</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink-2">
          ClimbOS researches your business, plans the work, runs it with your
          approval and tracks every lead back to the play that brought it.
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-display text-[15px] text-ink-2">
          <li className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> Plan in 10 minutes
          </li>
          <li aria-hidden className="h-5 w-px bg-ink/15" />
          <li className="flex items-center gap-1.5">
            <CalendarCheck className="size-4" aria-hidden /> 50 free credits
          </li>
          <li aria-hidden className="h-5 w-px bg-ink/15" />
          <li className="flex items-center gap-1.5">
            <CreditCard className="size-4" aria-hidden /> No credit card needed
          </li>
        </ul>
        <Button variant="accent" size="lg" className="mt-7 px-6">
          Get my free plan
        </Button>
      </div>
      <div className="relative mx-auto max-w-5xl">
        <div
          aria-hidden
          className="absolute inset-x-24 -top-7 h-10 rounded-t-[6px] bg-white/25"
        />
        <div
          aria-hidden
          className="absolute inset-x-12 -top-3.5 h-10 rounded-t-[6px] bg-white/35"
        />
        <div className="relative max-h-[430px] overflow-hidden rounded-t-[7px] shadow-lg">
          <DashboardScreen />
        </div>
      </div>
    </div>
  );
}

/* Mobile -------------------------------------------------------------- */

export function Phone({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-[640px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[8px] px-5 pb-6 pt-4",
        className,
      )}
    >
      <div className="flex items-center justify-between px-2 text-sm font-semibold">
        <span>9:41</span>
        <span className="text-xs">●●● ▬</span>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="marketing">
          <Button variant="secondary" size="sm" className="px-4">
            Menu
          </Button>
        </span>
      </div>
      {children}
      <span
        aria-hidden
        className="absolute bottom-2.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-ink/30"
      />
    </div>
  );
}

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-3">{k}</span>
      <span className="truncate rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
        {v}
      </span>
    </div>
  );
}

export function MobileScreens() {
  return (
    <div className="relative flex gap-6 overflow-x-auto rounded-[8px] bg-sage p-8">
      <Phone className="bg-bg">
        <div className="mt-14 flex flex-col items-center text-center">
          <Flag className="size-9" strokeWidth={2.5} aria-hidden />
          <p className="mt-6 font-display text-[26px] leading-8 tracking-[-0.01em]">
            Every lead arrives with its source attached.
          </p>
          <p className="mt-3 text-sm text-ink-2">
            Play, channel, campaign and keyword land in your pipeline with each
            reply.
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-3 rounded-[5px] bg-surface p-3 shadow-[var(--card-shadow)]">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-xs font-semibold">
              LH
            </span>
            <span className="min-w-0 text-xs">
              <span className="flex justify-between">
                <b className="font-semibold">Layla Haddad</b>
                <span className="text-ink-3">10:53</span>
              </span>
              <span className="text-ink-2">
                Hi, I&apos;d love to book a tasting for 40 guests.
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-[5px] bg-surface p-3 shadow-[var(--card-shadow)]">
            <KV k="Play" v="Event planners outreach" />
            <KV k="Channel" v="Cold email" />
            <KV k="Campaign" v="Spring weddings" />
            <KV k="Link" v="tartine.co/l/sp-12" />
          </div>
        </div>
      </Phone>
      <Phone className="bg-surface">
        <div className="mt-14 text-center">
          <p className="font-display text-[26px] leading-8 tracking-[-0.01em]">
            Stop paying for clicks that never reply.
          </p>
          <p className="mt-3 text-sm text-ink-2">
            Counting clicks, not conversations, spends your budget on the wrong
            people.
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2.5 rounded-[6px] bg-bg p-4">
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="flex w-[84%] items-center justify-between rounded-[var(--radius-cta)] bg-sage-ink px-4 py-2 font-display text-xs text-white">
              <span className="flex items-center gap-2">
                <Globe className="size-3.5" aria-hidden /> Channel
              </span>
              <span className="text-white/75">Google</span>
            </span>
            <span className="flex w-full items-center justify-between rounded-[var(--radius-cta)] bg-cream px-4 py-2 font-display text-xs">
              <span className="flex items-center gap-2">
                <MousePointerClick className="size-3.5" aria-hidden /> Click ID
              </span>
              <span className="text-ink-3">CjwKCAjws…</span>
            </span>
            <span className="flex w-full items-center justify-between rounded-[var(--radius-cta)] bg-sage-ink px-4 py-2 font-display text-xs text-white">
              <span className="flex items-center gap-2">
                <Tag className="size-3.5" aria-hidden /> Keyword
              </span>
              <span className="text-white/75">wedding cake…</span>
            </span>
            <span className="flex w-[84%] items-center justify-between rounded-[var(--radius-cta)] bg-sage-ink px-4 py-2 font-display text-xs text-white">
              <span className="flex items-center gap-2">
                <Link2 className="size-3.5" aria-hidden /> Page
              </span>
              <span className="text-white/75">tartine.co/…</span>
            </span>
          </div>
          <p className="font-display text-lg leading-6">
            Track every ad click to a real conversation
          </p>
          <p className="text-xs text-ink-2">
            Click IDs and UTM tags are kept when a chat or email starts.
          </p>
        </div>
      </Phone>
      <Phone className="bg-hero-gradient">
        <div className="mt-12">
          <p className="font-display text-[26px] leading-8 tracking-[-0.01em]">
            Track the four numbers that matter, live.
          </p>
          <p className="mt-3 text-sm text-ink-2">
            Clicks alone optimise for the wrong people. ClimbOS tracks the
            numbers that move revenue.
          </p>
        </div>
        <div className="mt-auto">
          <p className="font-display text-lg">Qualified leads</p>
          <p className="mt-1 text-sm text-ink-2">
            Real conversations that became sales-ready leads.
          </p>
          <div className="mt-4 rounded-[6px] bg-surface/85 p-4 backdrop-blur">
            <IconTile>
              <UsersRound />
            </IconTile>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-[32px] font-semibold leading-10">180</p>
                <p className="text-xs text-ink-2">Qualified leads</p>
              </div>
              <div className="flex flex-col items-end">
                <Delta value="↑ 5.6%" good />
                <TrendBars
                  label="Qualified leads"
                  values={[40, 46, 47, 60, 64, 66, 82, 96]}
                  previous={[34, 40, 42, 50, 55, 58, 66, 74]}
                />
              </div>
            </div>
          </div>
        </div>
      </Phone>
    </div>
  );
}

/* Reference sections ------------------------------------------------ */

export const PALETTE: {
  group: string;
  colors: {
    name: string;
    hex: string;
    token: string;
    role: string;
    dark?: boolean;
  }[];
}[] = [
  {
    group: "Ground and ink",
    colors: [
      {
        name: "Ground",
        hex: "#E8ECE5",
        token: "bg",
        role: "App and page background",
      },
      {
        name: "Panel",
        hex: "#FFFFFF",
        token: "surface",
        role: "Cards, tables, active nav",
      },
      {
        name: "Fill",
        hex: "#F2F4F0",
        token: "surface-2",
        role: "Chips, quiet buttons",
      },
      {
        name: "Ink",
        hex: "#161815",
        token: "ink",
        role: "Text, primary buttons",
        dark: true,
      },
      {
        name: "Ink 3",
        hex: "#575C53",
        token: "ink-3",
        role: "Meta, placeholders (5.7:1)",
        dark: true,
      },
    ],
  },
  {
    group: "Brand",
    colors: [
      {
        name: "Cream",
        hex: "#EAE3CE",
        token: "cream",
        role: "Hero and feature surfaces, pills",
      },
      {
        name: "Sage",
        hex: "#7C8F6E",
        token: "sage",
        role: "Brand panels, decorative (no small text)",
        dark: true,
      },
      {
        name: "Sage ink",
        hex: "#5B6E50",
        token: "sage-ink",
        role: "White-text pills, upsell (5.5:1)",
        dark: true,
      },
      {
        name: "Sage 800",
        hex: "#4D6043",
        token: "brand-800",
        role: "Links, focus, sage text (5.7:1)",
        dark: true,
      },
      {
        name: "Lime",
        hex: "#C3EF88",
        token: "lime",
        role: "Logo, Upgrade, CTA, outcome bar",
      },
      {
        name: "Lime deep",
        hex: "#94C256",
        token: "lime-deep",
        role: "Logo shading, decorative only",
      },
    ],
  },
  {
    group: "Status",
    colors: [
      {
        name: "Good",
        hex: "#E2F1D6",
        token: "green-100 / 800",
        role: "Active, Verified, ↑",
      },
      {
        name: "Warn",
        hex: "#FBF0C4",
        token: "amber-100 / 800",
        role: "Paused, not a fit",
      },
      {
        name: "Alert",
        hex: "#FBE1E6",
        token: "red-100 / 800",
        role: "Stopped, Rejected, ↓",
      },
      {
        name: "Pending",
        hex: "#FCEBDD",
        token: "orange-100 / 800",
        role: "Unverified",
      },
    ],
  },
  {
    group: "Charts",
    colors: [
      {
        name: "Series 1",
        hex: "#627656",
        token: "chart-1 · sage",
        role: "Primary series (5.0:1)",
        dark: true,
      },
      {
        name: "Series 2",
        hex: "#161815",
        token: "chart-2 · ink",
        role: "Second series (17.9:1)",
        dark: true,
      },
      {
        name: "Series 3",
        hex: "#3E6478",
        token: "chart-3 · slate",
        role: "Third series (6.4:1)",
        dark: true,
      },
      {
        name: "Series 4",
        hex: "#B0592B",
        token: "chart-4 · clay",
        role: "Fourth series (4.9:1)",
        dark: true,
      },
      {
        name: "Series 5",
        hex: "#93700F",
        token: "chart-5 · ochre",
        role: "Fifth series (4.6:1)",
        dark: true,
      },
      {
        name: "Previous",
        hex: "#8A9084",
        token: "chart-6",
        role: "Comparison line (3.3:1)",
        dark: true,
      },
    ],
  },
];

export const STANDARD: [string, string, string, string][] = [
  [
    "Normal text (under 24px)",
    "4.5:1",
    "7:1",
    "Body 7.8–17.9 (AAA); meta 5.4+",
  ],
  ["Large text (24px+, or 18.7px bold)", "3:1", "4.5:1", "Headings 5.3+"],
  ["Button labels", "4.5:1", "7:1", "13.6–17.9"],
  ["Input text and placeholders", "4.5:1", "7:1", "Text 17.9; placeholder 6.9"],
  ["Icons that carry meaning", "3:1", "4.5:1", "Ink icons 9.3+; status 5.5+"],
  ["Input borders and component edges", "3:1", "4.5:1", "Control border 3.4"],
  ["Focus indicator", "3:1", "—", "Sage 800 ring, 5.3+"],
  ["Charts and meaningful graphics", "3:1", "—", "Lines 3.3–5.0"],
  [
    "Decorative and disabled",
    "None",
    "—",
    "Sage, cream, lime fills (no small light text)",
  ],
];

export const CONTRAST: [string, string, string, string][] = [
  ["Ink on white / ground", "Titles, body", "17.9 / 14.9", "AAA"],
  ["Ink 2 on white / ground", "Body copy, table text", "9.3 / 7.8", "AAA"],
  [
    "Ink 3 on white / ground / cream",
    "Meta, placeholders, inactive tabs",
    "6.9 / 5.7 / 5.4",
    "AA",
  ],
  [
    "Sage 800 on white / ground / cream",
    "Links, sage headline, focus ring",
    "6.8 / 5.7 / 5.3",
    "AA",
  ],
  ["White on sage ink", "Pills, upsell card", "5.5", "AA"],
  ["Ink on lime", "CTA, Upgrade", "13.6", "AAA"],
  ["White on ink", "Primary buttons, active segment", "17.9", "AAA"],
  [
    "Status inks on their fills",
    "Active, Paused, Stopped, Unverified",
    "5.6–6.1",
    "AA",
  ],
  ["Control border on white", "Inputs, checkboxes", "3.4", "AA (UI 3:1)"],
  [
    "Chart series / previous line on white",
    "Charts",
    "4.6–17.9 / 3.3",
    "AA (graphics 3:1)",
  ],
];

export function PaletteGrid({ only, exclude }: { only?: string[]; exclude?: string[] } = {}) {
  return (
    <div className="flex flex-col gap-6">
      {PALETTE.filter((g) => (!only || only.includes(g.group)) && !exclude?.includes(g.group)).map((g) => (
        <div key={g.group} className="flex flex-col gap-3">
          <p className="text-overline">{g.group}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {g.colors.map((c) => (
              <div
                key={c.name}
                className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]"
              >
                <div
                  className={cn(
                    "flex h-20 items-end p-3 text-xs font-medium",
                    c.dark ? "text-white" : "text-ink",
                  )}
                  style={{ background: c.hex }}
                >
                  {c.hex}
                </div>
                <div className="p-3">
                  <p className="heading-card">
                    {c.name}{" "}
                    <span className="font-normal text-ink-3">· {c.token}</span>
                  </p>
                  <p className="text-xs text-ink-3">{c.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColourStandard() {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]">
      <p className="text-xs text-ink-3">
        WCAG 2.2 AA is the minimum across ClimbOS; body text aims for AAA. Every
        pair below is checked against this.
      </p>
      <table className="mt-3 w-full min-w-[560px] text-ui">
        <thead className="border-b border-line text-left text-ink-3">
          <tr>
            <th className="py-2 font-normal">Element</th>
            <th className="font-normal">Minimum</th>
            <th className="font-normal">Recommended</th>
            <th className="font-normal">Signal</th>
          </tr>
        </thead>
        <tbody>
          {STANDARD.map(([el, min, rec, ours]) => (
            <tr key={el} className="border-b border-line last:border-0">
              <td className="py-2 font-medium">{el}</td>
              <td className="tabular-nums">{min}</td>
              <td className="tabular-nums text-ink-2">{rec}</td>
              <td className="text-ink-2">{ours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContrastTable() {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]">
      <p className="text-xs text-ink-3">
        AA everywhere; AAA (7:1) for body text. Lime, sage and cream never carry
        small text in a light colour.
      </p>
      <table className="mt-3 w-full min-w-[560px] text-ui">
        <thead className="border-b border-line text-left text-ink-3">
          <tr>
            <th className="py-2 font-normal">Pair</th>
            <th className="font-normal">Use</th>
            <th className="font-normal">Ratio</th>
            <th className="font-normal">Level</th>
          </tr>
        </thead>
        <tbody>
          {CONTRAST.map(([pair, use, ratio, level]) => (
            <tr key={pair} className="border-b border-line last:border-0">
              <td className="py-2 font-medium">{pair}</td>
              <td className="text-ink-2">{use}</td>
              <td className="tabular-nums">{ratio}</td>
              <td>
                <StatusPill
                  kind={level.startsWith("AAA") ? "active" : "verified"}
                >
                  {level}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogoPairs() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid h-64 place-items-center overflow-hidden rounded-[var(--radius-card)] bg-ink">
        <span className="scale-75 sm:scale-100"><Wordmark tone="lime" size="lg" /></span>
      </div>
      <div className="grid h-64 place-items-center overflow-hidden rounded-[var(--radius-card)] bg-lime">
        <span className="scale-75 sm:scale-100"><Wordmark size="lg" tone="onLime" /></span>
      </div>
    </div>
  );
}

export function ButtonContexts() {
  const [seg, setSeg] = useState("30d");
  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-bg p-6">
          <p className="text-overline">In the app</p>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Example period"
              value={seg}
              onChange={setSeg}
              options={RANGES}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Approve</Button>
            <Button variant="secondary" size="sm">
              <Download /> Export
            </Button>
            <Button variant="secondary" size="sm">
              <Plus /> New report
            </Button>
            <DropButton white>All sources</DropButton>
            <DropButton>Last 6 months</DropButton>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">Performance</TabsTrigger>
              <TabsTrigger value="b">Funnel</TabsTrigger>
              <TabsTrigger value="c">Sources</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Tagchip removable>Google Ads · Brand</Tagchip>
            <Tagchip>Cold email</Tagchip>
            <Delta value="↑ 5.6%" good />
            <Delta value="↓ 3.2%" good={false} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill kind="active">Active</StatusPill>
            <StatusPill kind="verified">Verified</StatusPill>
            <StatusPill kind="paused">Paused</StatusPill>
            <StatusPill kind="off">Stopped</StatusPill>
            <StatusPill kind="rejected">Rejected · duplicate</StatusPill>
            <StatusPill kind="pending">Email unverified</StatusPill>
          </div>
        </div>
        <div className="marketing bg-hero-gradient flex flex-col gap-4 rounded-[var(--radius-card)] p-6">
          <p className="text-overline text-ink-2">Marketing and upsell</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg">Start my free plan</Button>
            <Button
              variant="ghost"
              size="lg"
              className="bg-ink/[0.06] hover:bg-ink/10"
            >
              Sign in
            </Button>
            <Button variant="accent" size="lg" className="px-6">
              Get my free plan
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary">Menu</Button>
            <span className="rounded-[var(--radius-cta)] bg-sage-ink px-4 py-2 font-display text-xs text-white">
              Channel · Google
            </span>
            <span className="rounded-[var(--radius-cta)] bg-cream px-4 py-2 font-display text-xs">
              Click ID · CjwK…
            </span>
          </div>
          <div className="mt-auto w-60">
            <UpsellCard />
          </div>
        </div>
      </div>
    </section>
  );
}

export const SHARP_ENTRIES = Object.entries(SHARP_ICONS).filter(
  ([name], i, all) =>
    all.findIndex(
      ([, c]) => c === SHARP_ICONS[name as keyof typeof SHARP_ICONS],
    ) === i,
);

export function IconSet() {
  const entries = SHARP_ENTRIES;
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-5 md:grid-cols-7 xl:grid-cols-9">
      {entries.map(([name, I]) => (
        <div
          key={name}
          className="flex flex-col items-center gap-2 bg-surface px-2 py-4"
        >
          <I className="size-6 text-ink" />
          <span className="max-w-full truncate text-2xs text-ink-3">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IconSizes() {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]">
      {[16, 20, 24].map((px) => (
        <div key={px} className="flex items-center gap-3 text-ink">
          <span className="w-10 text-xs text-ink-3">{px}px</span>
          {[
            SHARP_ICONS.Users,
            SHARP_ICONS.ChartLine,
            SHARP_ICONS.Settings,
            SHARP_ICONS.Bell,
            SHARP_ICONS.Search,
          ].map((I, i) => (
            <I key={i} style={{ width: px, height: px }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function IconGridSpec() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)] sm:flex-row sm:items-center sm:gap-8">
      <svg viewBox="0 0 24 24" className="size-40 text-ink" aria-hidden>
        {Array.from({ length: 25 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i}
            x2={i}
            y1="0"
            y2="24"
            stroke="var(--line-strong)"
            strokeWidth="0.04"
          />
        ))}
        {Array.from({ length: 25 }, (_, i) => (
          <line
            key={`h${i}`}
            y1={i}
            y2={i}
            x1="0"
            x2="24"
            stroke="var(--line-strong)"
            strokeWidth="0.04"
          />
        ))}
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          fill="none"
          stroke="var(--brand-600)"
          strokeWidth="0.08"
          strokeDasharray="0.4 0.3"
        />
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          <circle cx="9" cy="8" r="3.25" />
          <path d="M3 20.5v-2l2.5-2.5h7l2.5 2.5v2M15.5 4.9a3.25 3.25 0 0 1 0 6.2M17.5 16h1l2.5 2.5v2" />
        </g>
      </svg>
      <p className="text-xs text-ink-3">
        Live area 3–21. Stroke 1.5. Curves only for heads, clocks, lenses, coins
        and globes.
      </p>
    </div>
  );
}

export const HIERARCHY: {
  role: string;
  cls: string;
  spec: string;
  sample: string;
  serif: boolean;
}[] = [
  {
    role: "Display",
    cls: "text-display",
    spec: "Reckless 500 · 44–72 / 1.05",
    sample: "Know which plays bring customers",
    serif: true,
  },
  {
    role: "Page title (h1)",
    cls: "heading-page",
    spec: "Reckless 500 · 36 / 40",
    sample: "Results",
    serif: true,
  },
  {
    role: "Section title (h2)",
    cls: "heading-section",
    spec: "Reckless 500 · 24 / 30",
    sample: "Recent activity",
    serif: true,
  },
  {
    role: "Card title (h3)",
    cls: "heading-card",
    spec: "Reckless 500 · 17 / 22",
    sample: "Conversion funnel",
    serif: true,
  },
  {
    role: "Dialog title",
    cls: "heading-dialog",
    spec: "Reckless 500 · 22 / 28",
    sample: "Approve this post?",
    serif: true,
  },
  {
    role: "Empty state",
    cls: "heading-empty",
    spec: "Reckless 500 · 22 / 28",
    sample: "Nothing waiting on you",
    serif: true,
  },
  {
    role: "Body",
    cls: "text-sm",
    spec: "Hanken 400 · 14 / 20",
    sample: "Approve it and it goes out at the planned time.",
    serif: false,
  },
  {
    role: "Long-form",
    cls: "text-base",
    spec: "Hanken 400 · 15 / 24",
    sample:
      "ClimbOS researches your business, plans the week and drafts every post for your approval.",
    serif: false,
  },
  {
    role: "UI",
    cls: "text-ui",
    spec: "Hanken 400–500 · 13 / 18",
    sample: "Scheduled for Tue, Oct 21 at 9:00",
    serif: false,
  },
  {
    role: "Caption",
    cls: "text-xs text-ink-3",
    spec: "Hanken 400 · 12 / 16",
    sample: "Updated 2 minutes ago",
    serif: false,
  },
  {
    role: "Overline",
    cls: "text-overline",
    spec: "Hanken 600 · 11 / 16 caps",
    sample: "Grow",
    serif: false,
  },
  {
    role: "KPI number",
    cls: "text-[32px] font-semibold leading-10 tracking-[-0.02em] tabular-nums",
    spec: "Hanken 600 · 32 / 40 tabular",
    sample: "180 · $4.20 · 63.8%",
    serif: false,
  },
];

export const VOICE: {
  role: string;
  cls: string;
  spec: string;
  use: string;
  sample: string;
}[] = [
  {
    role: "AI voice",
    cls: "text-voice",
    spec: "Reckless 400 · 16 / 24",
    use: "Diagnosis, insights, why this play",
    sample:
      "Your bottleneck isn't traffic, it's the follow-up: 68% of replies wait more than a day for an answer.",
  },
  {
    role: "Annotation",
    cls: "text-annotation text-ink-2",
    spec: "Reckless italic · 13 / 18",
    use: "Short notes on charts",
    sample: "+16% growth projected · −86.7% didn't reply",
  },
  {
    role: "Quote",
    cls: "text-quote",
    spec: "Reckless italic · 18 / 27",
    use: "Customer words, testimonials",
    sample:
      "“Booked three tastings the first week. I just approved the emails.”",
  },
  {
    role: "Trust line",
    cls: "text-trust",
    spec: "Reckless 400 · 15 / 22",
    use: "Reassurance near actions",
    sample: "No card needed · You approve everything that goes out",
  },
  {
    role: "Hero number",
    cls: "metric-hero",
    spec: "Reckless 400 · 60 / 60",
    use: "One or two per screen",
    sample: "62%",
  },
];

export function TypeHierarchy() {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-line text-left text-xs text-ink-3">
          <tr>
            <th className="px-5 py-3 font-normal">Level</th>
            <th className="font-normal">Sample</th>
            <th className="pr-5 text-right font-normal">Spec</th>
          </tr>
        </thead>
        <tbody>
          {HIERARCHY.map((h) => (
            <tr key={h.role} className="border-b border-line last:border-0">
              <td className="w-44 px-5 py-4 align-middle">
                <p className="text-ui font-medium">{h.role}</p>
                <p className="text-2xs text-ink-3">
                  {h.serif ? "Reckless Neue" : "Hanken Grotesk"}
                </p>
              </td>
              <td className="py-4 pr-4 align-middle">
                <p className={h.cls}>{h.sample}</p>
              </td>
              <td className="w-52 py-4 pr-5 text-right align-middle text-xs tabular-nums text-ink-3">
                {h.spec}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VoiceGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {VOICE.map((v) => (
        <div
          key={v.role}
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-ui font-medium">{v.role}</p>
            <p className="text-2xs tabular-nums text-ink-3">{v.spec}</p>
          </div>
          <p className={v.cls}>{v.sample}</p>
          <p className="mt-auto text-xs text-ink-3">{v.use}</p>
        </div>
      ))}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-cream p-5">
        <p className="text-ui font-medium">Rules</p>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
          <li>
            Reckless for titles and voice, never for buttons, labels, inputs or
            table cells.
          </li>
          <li>At most one Reckless italic line per card.</li>
          <li>One hero number per screen; compare numbers in Hanken.</li>
          <li>Titles in sentence case; no all-caps Reckless.</li>
        </ul>
      </div>
    </div>
  );
}

export function TypeInContext() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--card-shadow)]">
        <p className="text-overline">In a card</p>
        <h3 className="heading-card">Diagnosis</h3>
        <p className="text-voice">
          Your bottleneck isn&apos;t traffic, it&apos;s the follow-up: 68% of
          replies wait more than a day for an answer.
        </p>
        <div className="flex items-end justify-between border-t border-line pt-3">
          <div>
            <p className="text-[32px] font-semibold leading-10 tabular-nums">
              68%
            </p>
            <p className="text-ui text-ink-2">Replies answered after 24h</p>
          </div>
          <p className="text-annotation text-red-800">
            −12 pts since September
          </p>
        </div>
        <Button size="sm" className="self-start">
          Turn on reply alerts
        </Button>
        <p className="text-trust text-sm">
          You approve every reply before it goes out.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-ink p-6 text-white">
        <p className="text-overline !text-white/60">Hero</p>
        <p className="heading-card !text-white">Route to your goal</p>
        <p className="metric-hero">62%</p>
        <p className="text-voice !text-white/80">
          Of the route covered. At this pace you reach the summit on Dec 18.
        </p>
        <p className="text-quote !text-white/90 mt-2">
          “Booked three tastings the first week.”
        </p>
        <p className="text-xs text-white/60">Layla, Tartine Bakery</p>
      </div>
    </div>
  );
}
