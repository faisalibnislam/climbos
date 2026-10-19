"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarCheck, ChartColumn, Clock, CreditCard, Download, FolderOpen, Inbox, LayoutGrid, Megaphone, MessageCircle, Mountain, Search, Settings, Sparkles, Star, Target, Users, X } from "lucide-react";
import { Badge, Button, Segmented, Sparkline, StatTrend } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DesignSystemReference } from "../DesignSystemReference";

/** Applies the proposed theme to the whole document (so dialogs and menus preview it too) while this page is open. */
function useSignalTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = "wact";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
    };
  }, []);
}

const PALETTE: { name: string; hex: string; role: string; dark?: boolean }[] = [
  { name: "Cream", hex: "#EAE3CE", role: "Top of the hero gradient" },
  { name: "Sage", hex: "#7C8F6E", role: "Bottom of the gradient, brand", dark: true },
  { name: "Sage 800", hex: "#4B6140", role: "Links, focus, sage text", dark: true },
  { name: "Lime", hex: "#C5F08A", role: "The one CTA, highlights" },
  { name: "Ink", hex: "#151515", role: "Text and primary actions", dark: true },
  { name: "Stone", hex: "#F2F2EF", role: "App ground" },
  { name: "White", hex: "#FFFFFF", role: "Panels" },
];

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[22px] font-semibold tracking-[-0.03em]", light ? "text-[var(--sun)]" : "text-ink")}>
      <span className={cn("grid size-8 place-items-center rounded-full border-[3px]", light ? "border-[var(--sun)]" : "border-ink")}>
        <Mountain className="size-4" strokeWidth={2.6} aria-hidden />
      </span>
      ClimbOS
    </span>
  );
}

function SectionTitle({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-5xl font-medium tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-3 text-lg text-ink-3">{intro}</p>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span className={cn("flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-ui", active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2")}>
      <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">{icon}</span>
      {label}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs text-ink-2">
      {children}
      <X aria-hidden className="size-3.5 text-ink-3" />
    </span>
  );
}

const FUNNEL = [
  { label: "Visitors", pct: 100, n: "2,400" },
  { label: "Leads", pct: 45, n: "320" },
  { label: "Qualified", pct: 20, n: "180" },
  { label: "Calls booked", pct: 15, n: "150" },
  { label: "Customers", pct: 6, n: "120", lime: true },
];

function DashboardSample() {
  const [range, setRange] = useState("30d");
  return (
    <div className="grid overflow-hidden rounded-[18px] border border-line bg-[#fafaf8] shadow-lg md:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 border-r border-line bg-[#f5f5f2] p-4 md:flex">
        <Wordmark />
        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2">
          <span className="grid size-9 place-items-center rounded-lg bg-[var(--sun)] text-ink"><FolderOpen className="size-4" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block truncate text-ui font-medium">Tartine Bakery</span>
            <span className="block text-2xs text-ink-3">Local · Pro plan</span>
          </span>
        </div>
        <p className="mt-4 px-2.5 text-2xs font-medium text-ink-3">▾ Grow</p>
        <NavItem icon={<LayoutGrid />} label="Today" active />
        <NavItem icon={<Target />} label="Growth plan" />
        <NavItem icon={<Users />} label="Customers" />
        <NavItem icon={<Megaphone />} label="Campaigns" />
        <NavItem icon={<MessageCircle />} label="Inbox" />
        <p className="mt-3 px-2.5 text-2xs font-medium text-ink-3">▾ Measure</p>
        <NavItem icon={<ChartColumn />} label="Results" />
        <NavItem icon={<Search />} label="Attribution" />
        <NavItem icon={<Settings />} label="Settings" />
      </aside>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-medium tracking-[-0.02em]">Today</h3>
            <p className="text-ui text-ink-3">Booked calls, cost per lead and what ClimbOS did this week.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Time period" value={range} onChange={setRange} options={["7d", "30d", "3m", "6m", "1y"].map((v) => ({ value: v, label: v }))} />
            <Button variant="secondary" size="sm"><Download /> Export</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTrend label="Qualified leads" icon={<Users />} value="180" delta={5.6} trend={[60, 72, 70, 95, 110, 124, 150, 180]} />
          <StatTrend label="Cost per lead" icon={<CreditCard />} value="$4.20" delta={-3.2} upIsGood={false} trend={[6.1, 5.8, 5.9, 5.1, 4.9, 4.6, 4.4, 4.2]} />
          <StatTrend label="Lead quality" icon={<Star />} value="63.8%" delta={12.6} trend={[41, 44, 48, 51, 55, 58, 61, 63.8]} />
        </div>
        <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="heading-card">Conversion funnel</p>
              <p className="text-xs text-ink-3">From first visit to paying customer, by source.</p>
            </div>
            <Button variant="secondary" size="sm">Last 6 months</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>Google Ads · Search</Chip>
            <Chip>Instagram</Chip>
            <Chip>Cold email</Chip>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {FUNNEL.map((f) => (
              <li key={f.label} className="grid grid-cols-[110px_44px_56px_1fr] items-center gap-3 text-ui">
                <span className="text-ink-2">{f.label}</span>
                <span className="tabular-nums text-ink-3">{f.pct}%</span>
                <span className="font-medium tabular-nums">{f.n}</span>
                <span className="h-5 overflow-hidden rounded-md bg-surface-2">
                  <span
                    className={cn("block h-full rounded-md", f.lime ? "bg-[var(--sun)]" : "bg-surface-3")}
                    style={{ width: `${Math.max(f.pct, 4)}%`, ...(f.pct === 100 ? { backgroundImage: "repeating-linear-gradient(135deg, var(--surface-3) 0 2px, transparent 2px 6px)" } : {}) }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="bg-hero-grid relative overflow-hidden rounded-[24px] px-4 pb-0 pt-4 sm:px-8">
      <nav className="flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <Wordmark />
        <div className="hidden items-center gap-7 text-ui text-ink md:flex">
          <span>How it works</span>
          <span>Pricing</span>
          <span>Results</span>
          <span>Security</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="bg-ink/5 hover:bg-ink/10">Sign in</Button>
          <Button>Start free</Button>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl pb-10 pt-14 text-center">
        <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
          Your AI growth team.
          <span className="block text-brand-700">Booked calls, not busywork.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink-2">
          ClimbOS researches your business, builds the plan, makes the work and measures what happens. You approve anything that goes live.
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-display text-sm text-ink-2">
          <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> Plan in 10 minutes</li>
          <li aria-hidden className="h-4 w-px bg-ink/15" />
          <li className="flex items-center gap-1.5"><CalendarCheck className="size-4" aria-hidden /> 50 free credits</li>
          <li aria-hidden className="h-4 w-px bg-ink/15" />
          <li className="flex items-center gap-1.5"><CreditCard className="size-4" aria-hidden /> No card needed</li>
        </ul>
        <Button variant="accent" size="lg" className="mt-7">Get my free plan</Button>
      </div>
      <div className="relative mx-auto max-w-5xl">
        <div aria-hidden className="absolute inset-x-16 -top-6 h-10 rounded-t-[18px] bg-white/25" />
        <div aria-hidden className="absolute inset-x-8 -top-3 h-10 rounded-t-[18px] bg-white/35" />
        <div className="relative max-h-[420px] overflow-hidden rounded-t-[18px]">
          <DashboardSample />
        </div>
      </div>
    </div>
  );
}

export function SignalPreview() {
  useSignalTheme();
  return (
    <div className="min-h-dvh bg-surface">
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4">
          <Badge tone="brand" icon={<Sparkles />} className="self-start">Proposal · not live yet</Badge>
          <SectionTitle
            title="Signal"
            intro="One visual language from the first ad to the daily workflow: a cream-to-sage ground, white panels on stone, black pill actions, one lime call to action, and Reckless Neue for headlines."
          />
        </header>

        <Hero />

        <section className="flex flex-col gap-6">
          <SectionTitle title="Colour" intro="Few colours, each with one job. Lime is for the single most important action or the number that matters, never for small text on white." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PALETTE.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                <div className={cn("flex h-24 items-end p-3 text-xs font-medium", c.dark ? "text-white" : "text-ink")} style={{ background: c.hex }}>
                  {c.hex}
                </div>
                <div className="p-3">
                  <p className="heading-card">{c.name}</p>
                  <p className="text-xs text-ink-3">{c.role}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-hero-grid grid h-56 place-items-center rounded-[var(--radius-card)]">
              <Wordmark light />
            </div>
            <div className="grid h-56 place-items-center rounded-[var(--radius-card)] bg-[var(--sun)]">
              <Wordmark />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <SectionTitle title="Type" intro="Reckless Neue for headlines, page titles and short trust lines; Inter for everything you read and click. Numbers are Inter semibold so tables and cards line up." />
          <div className="grid gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="font-display text-6xl font-medium tracking-[-0.02em]">Aa Reckless</p>
              <p className="font-display text-3xl font-medium tracking-[-0.02em]">Understand which plays bring customers</p>
              <p className="font-display text-xl italic text-brand-700">Booked calls, not busywork.</p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-6xl font-semibold tracking-[-0.03em]">Aa Inter</p>
              <p className="metric">180 · $4.20 · 63.8%</p>
              <p className="text-sm text-ink-2">Body 14/20. Controls and tables 13/18. Captions 12/16.</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <SectionTitle title="Controls" intro="Pill buttons: black for the main action, white with a hairline for the rest, lime once per screen. Small pill toggles with a black active state." />
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <Button>Start free</Button>
            <Button variant="secondary">Sign in</Button>
            <Button variant="accent">Get my free plan</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="link">See how it works</Button>
            <Segmented label="Example period" value="30d" onChange={() => {}} options={["7d", "30d", "3m"].map((v) => ({ value: v, label: v }))} />
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-green-800/25 bg-green-100 px-2 text-xs font-medium text-green-800">↑ 5.6%</span>
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-red-800/25 bg-red-100 px-2 text-xs font-medium text-red-800">↓ 3.2%</span>
            <span className="inline-flex items-center"><Sparkline values={[3, 4, 4, 6, 7, 9]} className="w-24" height={28} color="var(--chart-1)" /></span>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <SectionTitle title="Product" intro="White panels on a stone ground, a quiet sidebar with grouped sections, sans numbers and one lime mark for the outcome." />
          <DashboardSample />
        </section>

        <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface-2 p-5">
          <p className="heading-card flex items-center gap-2"><Inbox className="size-4" aria-hidden /> Every component in this theme</p>
          <p className="text-ui text-ink-3">Below is the full component reference rendered in Signal, including dialogs, menus and toasts.</p>
        </section>
      </main>
      <div className="bg-bg">
        <DesignSystemReference theme="signal" />
      </div>
    </div>
  );
}
