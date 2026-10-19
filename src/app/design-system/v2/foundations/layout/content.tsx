"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, ChartLine, Home, Inbox, Megaphone, Search, Settings, Users } from "@/components/icons";
import { Badge, Button, Field, Input, Select, StatusPill, Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Reads a CSS custom property where it renders, and re-reads when theme or density changes. */
function LiveVar({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [v, setV] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setV(getComputedStyle(el).getPropertyValue(name).trim());
    const id = requestAnimationFrame(read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-density", "data-theme"] });
    return () => {
      cancelAnimationFrame(id);
      mo.disconnect();
    };
  }, [name]);
  return (
    <code ref={ref} className={cn("font-mono text-2xs text-ink-2", className)}>
      {v || "…"}
    </code>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-2xs text-ink-2">{children}</code>;
}

/* ------------------------------------------------------------------ */
/* Spacing                                                             */
/* ------------------------------------------------------------------ */

const SPACE: [string, number, string][] = [
  ["0.5", 2, "Icon to label nudge, chip padding"],
  ["1", 4, "Tight inline gaps"],
  ["1.5", 6, "Label to field, icon to text"],
  ["2", 8, "Between controls in a toolbar"],
  ["3", 12, "Inside cards, list rows"],
  ["4", 16, "Card groups, form fields"],
  ["5", 20, "Card padding (comfortable)"],
  ["6", 24, "Between panels on a page"],
  ["8", 32, "Page sections"],
  ["10", 40, "Page header to content"],
  ["14", 56, "Between doc specimens"],
];

function SpacingScale() {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full text-ui">
        <caption className="sr-only">Spacing scale</caption>
        <thead className="bg-surface-2 text-left text-xs text-ink-3">
          <tr>
            <th scope="col" className="h-9 px-4 font-medium">Token</th>
            <th scope="col" className="px-4 font-medium">px</th>
            <th scope="col" className="px-4 font-medium">Size</th>
            <th scope="col" className="hidden px-4 font-medium sm:table-cell">Use</th>
          </tr>
        </thead>
        <tbody>
          {SPACE.map(([k, px, use]) => (
            <tr key={k} className="h-[var(--cell-h)] border-t border-line">
              <td className="px-4">
                <Mono>gap-{k}</Mono>
              </td>
              <td className="px-4 tabular-nums text-ink-2">{px}</td>
              <td className="px-4">
                <span className="block h-3 rounded-[1px] bg-chart-1" style={{ width: px * 2 }} />
              </td>
              <td className="hidden px-4 text-ink-3 sm:table-cell">{use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpacingInContext() {
  return (
    <div className="relative max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[var(--card-p)] bg-chart-4/15" />
      <span aria-hidden className="absolute inset-y-0 left-0 w-[var(--card-p)] bg-chart-4/15" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="heading-card">Plays this week</h4>
          <Badge tone="green">3 live</Badge>
        </div>
        <div className="relative flex gap-2">
          <Button size="sm">Approve all</Button>
          <Button size="sm" variant="secondary">
            Review
          </Button>
        </div>
      </div>
      <p className="relative mt-3 text-2xs text-ink-3">Shaded = card padding (--card-p). Title to actions: gap-3. Between buttons: gap-2.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grids                                                               */
/* ------------------------------------------------------------------ */

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid min-h-10 place-items-center rounded-[var(--radius-control)] bg-surface text-2xs font-medium text-ink-2 ring-1 ring-line", className)}>{children}</div>;
}

function GridLayouts() {
  return (
    <div className="flex flex-col gap-4">
      <Stage label="12 columns · gap-4 (16px) · collapses to 1 column under md">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-12 gap-1" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-6 rounded-[1px] bg-chart-1/15 text-center text-2xs leading-6 text-ink-3">
                {i + 1}
              </div>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-12">
            <Cell className="md:col-span-3">3</Cell>
            <Cell className="md:col-span-3">3</Cell>
            <Cell className="md:col-span-3">3</Cell>
            <Cell className="md:col-span-3">3</Cell>
            <Cell className="md:col-span-8">8 · main chart</Cell>
            <Cell className="md:col-span-4">4 · side panel</Cell>
            <Cell className="md:col-span-6">6</Cell>
            <Cell className="md:col-span-6">6</Cell>
          </div>
        </div>
      </Stage>
      <Stage label="Sidebar + content · 240px + 1fr (sidebar becomes a drawer under lg)">
        <div className="grid gap-2 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Cell className="min-h-24">Sidebar 240</Cell>
          <div className="flex flex-col gap-2">
            <Cell>Top bar 56</Cell>
            <Cell className="min-h-16">Content · max-w 1280</Cell>
          </div>
        </div>
      </Stage>
      <Stage label="Bento · 4 columns, tiles span 1–2 · 2 columns under md">
        <div className="grid auto-rows-[56px] grid-cols-2 gap-2 md:grid-cols-4">
          <Cell className="col-span-2 row-span-2 bg-ink text-white ring-0">Hero metric 2×2</Cell>
          <Cell>1×1</Cell>
          <Cell>1×1</Cell>
          <Cell className="col-span-2">2×1 trend</Cell>
          <Cell className="row-span-2">1×2</Cell>
          <Cell className="col-span-1 md:col-span-3">3×1 table</Cell>
        </div>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Breakpoints                                                         */
/* ------------------------------------------------------------------ */

const BPS: [string, number, string][] = [
  ["base", 0, "One column. Bottom nav. Tables scroll sideways."],
  ["sm", 640, "Two-up cards, inline form rows."],
  ["md", 768, "12-column grid turns on. KPI row goes 2×2."],
  ["lg", 1024, "Sidebar docks. Side rails appear."],
  ["xl", 1280, "KPI row 4 across. On-page contents."],
  ["2xl", 1536, "Content caps at 1280; extra width is margin."],
];

function Breakpoints() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-ui">
        <span className="text-ink-3">You are at:</span>
        <span className="font-semibold">
          <span className="sm:hidden">base (&lt;640)</span>
          <span className="hidden sm:inline md:hidden">sm</span>
          <span className="hidden md:inline lg:hidden">md</span>
          <span className="hidden lg:inline xl:hidden">lg</span>
          <span className="hidden xl:inline 2xl:hidden">xl</span>
          <span className="hidden 2xl:inline">2xl</span>
        </span>
      </div>
      <div className="relative h-8 rounded-[var(--radius-control)] bg-surface ring-1 ring-line" aria-hidden>
        {BPS.slice(1).map(([k, px]) => (
          <span key={k} className="absolute inset-y-0 border-l border-ink/40 pl-1 text-2xs leading-8 text-ink-2" style={{ left: `${(px / 1600) * 100}%` }}>
            {k}
          </span>
        ))}
      </div>
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-ui">
          <caption className="sr-only">Breakpoints</caption>
          <thead className="bg-surface-2 text-left text-xs text-ink-3">
            <tr>
              <th scope="col" className="h-9 px-4 font-medium">Prefix</th>
              <th scope="col" className="px-4 font-medium">Min width</th>
              <th scope="col" className="px-4 font-medium">What changes</th>
            </tr>
          </thead>
          <tbody>
            {BPS.map(([k, px, what]) => (
              <tr key={k} className="h-[var(--cell-h)] border-t border-line">
                <td className="px-4">
                  <Mono>{k === "base" ? "—" : `${k}:`}</Mono>
                </td>
                <td className="px-4 tabular-nums text-ink-2">{px ? `${px}px` : "0"}</td>
                <td className="px-4 text-ink-2">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Density                                                             */
/* ------------------------------------------------------------------ */

const COMFORTABLE = { "--h-sm": "32px", "--h-md": "36px", "--h-lg": "40px", "--cell-h": "44px", "--card-p": "20px" } as CSSProperties;

const ROWS = [
  { name: "Class reel", status: "ready" as const, reach: "1,240" },
  { name: "Win-back email", status: "draft" as const, reach: "318" },
  { name: "Lead list", status: "ready" as const, reach: "20" },
];

function DensitySample() {
  return (
    <div className="flex flex-col gap-[var(--card-p)] rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <TableFrame>
        <Table>
          <THead>
            <tr>
              <Th>Play</Th>
              <Th>Status</Th>
              <Th numeric>Reach</Th>
            </tr>
          </THead>
          <TBody>
            {ROWS.map((r) => (
              <Tr key={r.name} interactive>
                <Td className="whitespace-nowrap font-medium">{r.name}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td numeric>{r.reach}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableFrame>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name">
          <Input defaultValue="Tartine Bakery" />
        </Field>
        <Field label="Goal">
          <Select
            defaultValue="bookings"
            options={[
              { value: "bookings", label: "Class bookings" },
              { value: "orders", label: "Catering orders" },
            ]}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Save</Button>
        <Button size="sm" variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  );
}

const DENSITY_TOKENS: [string, string, string, string][] = [
  ["--h-sm", "32px", "28px", "Small buttons, toolbar inputs"],
  ["--h-md", "36px", "32px", "Default buttons, inputs, selects"],
  ["--h-lg", "40px", "36px", "Large buttons, hero inputs"],
  ["--cell-h", "44px", "34px", "Table row min height"],
  ["--card-p", "20px", "14px", "Card and panel padding"],
];

function Density() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div style={COMFORTABLE} className="flex min-w-0 flex-col gap-2">
          <p className="text-overline">Comfortable (default)</p>
          <DensitySample />
        </div>
        <div data-density="compact" className="flex min-w-0 flex-col gap-2">
          <p className="text-overline">Compact · data-density=&quot;compact&quot;</p>
          <DensitySample />
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-ui">
          <caption className="sr-only">Density tokens</caption>
          <thead className="bg-surface-2 text-left text-xs text-ink-3">
            <tr>
              <th scope="col" className="h-9 px-4 font-medium">Token</th>
              <th scope="col" className="px-4 font-medium">Comfortable</th>
              <th scope="col" className="px-4 font-medium">Compact</th>
              <th scope="col" className="px-4 font-medium">Live on this page</th>
              <th scope="col" className="hidden px-4 font-medium md:table-cell">Used for</th>
            </tr>
          </thead>
          <tbody>
            {DENSITY_TOKENS.map(([t, c, k, use]) => (
              <tr key={t} className="h-[var(--cell-h)] border-t border-line">
                <td className="px-4">
                  <Mono>{t}</Mono>
                </td>
                <td className="px-4 tabular-nums">{c}</td>
                <td className="px-4 tabular-nums">{k}</td>
                <td className="px-4">
                  <LiveVar name={t} />
                </td>
                <td className="hidden px-4 text-ink-3 md:table-cell">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard structure                                                 */
/* ------------------------------------------------------------------ */

function Region({ n, label, className, children }: { n: number; label: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative rounded-[var(--radius-control)] border border-dashed border-ink/30 p-2", className)}>
      <span className="absolute -left-2 -top-2 z-10 grid size-5 place-items-center rounded-full bg-ink text-2xs font-semibold text-white">{n}</span>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const ANATOMY: [string, string][] = [
  ["Sidebar", "240px, ground colour, groups of nav. Drawer under lg."],
  ["Top bar", "56px, sticky, search ⌘K, alerts, account. Only blurred surface."],
  ["Page head", "Reckless title (heading-page), one line of context, primary action right."],
  ["KPI row", "4 across at xl, 2×2 at md, stacked on phones. gap-4."],
  ["Main grid", "12 columns: 8 for the main chart or table, 4 beside it."],
  ["Side rail", "320px at lg+: approvals, AI assistant, activity. Moves under content on small screens."],
];

function DashboardStructure() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-bg p-3 ring-1 ring-line" aria-label="Dashboard skeleton" role="img">
        <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
          <Region n={1} label="Sidebar" className="hidden flex-col gap-1.5 md:flex">
            <span className="mb-2 h-5 w-16 rounded-[2px] bg-lime" />
            {[Home, Inbox, Megaphone, Users, ChartLine, Settings].map((I, i) => (
              <span key={i} className={cn("flex h-6 items-center gap-1.5 rounded-[2px] px-1.5", i === 0 && "bg-surface")}>
                <I aria-hidden className="size-3 text-ink-3" />
                <span className="h-1.5 w-12 rounded-full bg-ink/15" />
              </span>
            ))}
          </Region>
          <div className="flex min-w-0 flex-col gap-3">
            <Region n={2} label="Top bar" className="flex items-center gap-2">
              <span className="flex h-6 flex-1 items-center gap-1.5 rounded-[2px] bg-surface px-2">
                <Search aria-hidden className="size-3 text-ink-3" />
                <span className="h-1.5 w-20 rounded-full bg-ink/15" />
              </span>
              <Bell aria-hidden className="size-3.5 text-ink-3" />
              <span className="size-5 rounded-full bg-brand-200" />
            </Region>
            <Region n={3} label="Page head" className="flex items-end justify-between">
              <span className="flex flex-col gap-1">
                <span className="h-3.5 w-28 rounded-[2px] bg-ink/70" />
                <span className="h-1.5 w-40 rounded-full bg-ink/15" />
              </span>
              <span className="h-6 w-16 rounded-[2px] bg-ink" />
            </Region>
            <Region n={4} label="KPI row" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="flex h-12 flex-col justify-end gap-1 rounded-[3px] bg-surface p-2 ring-1 ring-line">
                  <span className="h-2.5 w-10 rounded-[2px] bg-ink/60" />
                  <span className="h-1.5 w-14 rounded-full bg-ink/15" />
                </span>
              ))}
            </Region>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px]">
              <Region n={5} label="Main grid" className="grid grid-cols-12 gap-2">
                <span className="col-span-12 h-24 rounded-[3px] bg-surface ring-1 ring-line sm:col-span-8">
                  <svg viewBox="0 0 100 40" className="h-full w-full p-2" preserveAspectRatio="none" aria-hidden>
                    <polyline points="0,32 15,28 30,30 45,20 60,22 75,12 100,8" fill="none" stroke="var(--chart-1)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  </svg>
                </span>
                <span className="col-span-12 h-24 rounded-[3px] bg-surface ring-1 ring-line sm:col-span-4" />
                <span className="col-span-12 h-14 rounded-[3px] bg-surface ring-1 ring-line" />
              </Region>
              <Region n={6} label="Side rail" className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-11 rounded-[3px] bg-surface ring-1 ring-line" />
                ))}
              </Region>
            </div>
          </div>
        </div>
      </div>
      <ol className="flex flex-col gap-2.5">
        {ANATOMY.map(([t, d], i) => (
          <li key={t} className="flex gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-2xs font-semibold text-white">{i + 1}</span>
            <span>
              <span className="block text-ui font-medium text-ink">{t}</span>
              <span className="block text-xs text-ink-3">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LayoutContent() {
  return (
    <DocPage eyebrow="Foundations" title="Layout & density" intro="A 4px grid, a 12-column page and two densities. The top bar switches density; everything sized with the tokens below follows.">
      <Specimen title="Spacing system" description="4px base. Use the Tailwind steps below; nothing in between.">
        <SpacingScale />
        <Stage>
          <SpacingInContext />
        </Stage>
        <Spec items={[["Base", "4px (Tailwind 1 = 4px)"], ["Rule", "Gaps grow with the size of what they separate: controls 8, card content 12, cards 16, panels 24, sections 32+"]]} />
      </Specimen>

      <Specimen title="Grid layouts">
        <GridLayouts />
        <Spec items={[["Page max width", "1280px content, 24px side gutter (16px on phones)"], ["Gutter", "gap-4 (16px) in grids, gap-6 (24px) between page sections"]]} />
      </Specimen>

      <Specimen title="Responsive breakpoints" description="Tailwind defaults. Design mobile first, then add at sm, md, lg, xl, 2xl.">
        <Breakpoints />
        <Spec items={[["Phones", "Test at 375px: no sideways page scroll; wide tables scroll inside their frame"], ["Touch", "Targets ≥ 24px (WCAG 2.2); primary actions use --h-md or larger"]]} />
      </Specimen>

      <Specimen title="Density" description="Same table and form, comfortable vs compact. Only the tokens change.">
        <Density />
      </Specimen>

      <Specimen title="Dashboard structure" description="Every dashboard uses the same six regions.">
        <DashboardStructure />
      </Specimen>
    </DocPage>
  );
}
