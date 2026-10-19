"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "@/components/icons";
import { Avatar, Badge, Button, Input, Separator } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

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
    <code ref={ref} className={cn("break-all font-mono text-2xs text-ink-2", className)}>
      {v || "…"}
    </code>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-2xs text-ink-2">{children}</code>;
}

/* ------------------------------------------------------------------ */
/* Corner radius                                                       */
/* ------------------------------------------------------------------ */

const RADII: { token: string; use: string; demo: ReactNode }[] = [
  { token: "--radius-control", use: "Buttons, menus items, segmented", demo: <Button size="sm">Approve</Button> },
  { token: "--radius-field", use: "Inputs, selects, textareas", demo: <Input size="sm" defaultValue="Tartine" aria-label="Sample input" className="w-28" /> },
  { token: "--radius-badge", use: "Badges, status pills, chips", demo: <Badge tone="green">Live</Badge> },
  { token: "--radius-card", use: "Cards, panels, tables, popovers", demo: <span className="block h-12 w-20 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]" /> },
  { token: "--radius-cta", use: "Marketing CTAs (.marketing)", demo: <span className="inline-flex h-9 items-center rounded-[var(--radius-cta)] bg-ink px-4 text-ui font-medium text-white">Start free</span> },
  { token: "--radius-lg", use: "Page frames, app shell (largest; max 8px)", demo: <span className="block h-12 w-20 rounded-[var(--radius-lg)] bg-surface ring-1 ring-line" /> },
];

function CornerRadius() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RADII.map((r) => (
          <div key={r.token} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="flex h-14 items-center">{r.demo}</div>
            <div className="flex items-baseline justify-between gap-2">
              <Mono>{r.token}</Mono>
              <LiveVar name={r.token} className="font-semibold text-ink" />
            </div>
            <p className="text-xs text-ink-3">{r.use}</p>
          </div>
        ))}
      </div>
      <Stage label="Tailwind rounded-* scale (themed)">
        <div className="flex flex-wrap items-end gap-4">
          {[
            ["rounded-sm", "--r-sm", "rounded-sm"],
            ["rounded-md", "--r-md", "rounded-md"],
            ["rounded-lg", "--r-lg", "rounded-lg"],
            ["rounded-xl", "--r-xl", "rounded-xl"],
            ["rounded-2xl", "--r-2xl", "rounded-2xl"],
            ["rounded-3xl", "--r-3xl", "rounded-3xl"],
            ["rounded-full", "", "rounded-full"],
          ].map(([label, token, cls]) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className={cn("block size-14 border border-ink/40 bg-surface", cls)} />
              <Mono>{label}</Mono>
              {token ? <LiveVar name={token} /> : <span className="text-2xs text-ink-3">avatars, dots</span>}
            </div>
          ))}
        </div>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Borders & dividers                                                  */
/* ------------------------------------------------------------------ */

const BORDERS: { name: string; token: string; cls: string; use: string }[] = [
  { name: "Hairline", token: "--line", cls: "border border-line", use: "Panels, tables, cards" },
  { name: "Strong hairline", token: "--line-strong", cls: "border border-line-strong", use: "Hover on cards, dividers that must show" },
  { name: "Control", token: "--control-border", cls: "border border-control", use: "Inputs, checkboxes (3:1)" },
  { name: "Control hover", token: "--control-border-hover", cls: "border border-control-hover", use: "Input hover" },
  { name: "Selected", token: "--ink", cls: "border border-ink ring-1 ring-ink", use: "Selected card, focused prompt" },
  { name: "Error", token: "--red-800", cls: "border border-red-800", use: "Invalid fields" },
  { name: "Dashed", token: "--line-strong", cls: "border border-dashed border-line-strong", use: "Drop zones, empty slots" },
];

function Borders() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BORDERS.map((b) => (
        <div key={b.name} className="flex flex-col gap-2">
          <span className={cn("block h-16 rounded-[var(--radius-card)] bg-surface", b.cls)} />
          <span className="text-ui font-medium">{b.name}</span>
          <span className="flex flex-col gap-0.5">
            <Mono>{b.token}</Mono>
            <LiveVar name={b.token} />
          </span>
          <span className="text-xs text-ink-3">{b.use}</span>
        </div>
      ))}
    </div>
  );
}

function Dividers() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Horizontal hairline">
        <p className="text-ui">Plays this week</p>
        <Separator className="my-3" />
        <p className="text-ui text-ink-2">3 live, 2 drafts</p>
      </Stage>
      <Stage tone="white" label="Vertical, in a toolbar">
        <div className="flex h-9 items-center gap-2">
          <Button size="sm" variant="ghost">
            Bold
          </Button>
          <Button size="sm" variant="ghost">
            Italic
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button size="sm" variant="ghost">
            Link
          </Button>
        </div>
      </Stage>
      <Stage tone="white" label="List dividers (divide-y), inset to text">
        <ul className="divide-y divide-line">
          {["Saturday class reel", "Win-back email", "Lead list"].map((t) => (
            <li key={t} className="flex h-[var(--cell-h)] items-center text-ui">
              {t}
            </li>
          ))}
        </ul>
      </Stage>
      <Stage tone="white" label="Labelled divider">
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" />
          or continue with email
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="text-overline">Section</span>
          <span className="h-px flex-1 bg-line-strong" />
        </div>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

const SURFACES: { name: string; token: string; cls: string; ink?: boolean; use: string }[] = [
  { name: "Ground", token: "--bg", cls: "bg-bg", use: "Page background, sidebar" },
  { name: "Surface", token: "--surface", cls: "bg-surface", use: "Panels, cards, inputs" },
  { name: "Surface 2", token: "--surface-2", cls: "bg-surface-2", use: "Table headers, hover, quiet fills" },
  { name: "Surface 3", token: "--surface-3", cls: "bg-surface-3", use: "Tracks, pressed, skeletons" },
  { name: "Ink", token: "--ink", cls: "bg-ink", ink: true, use: "Primary actions, hero panels, logs" },
  { name: "Cream", token: "--cream", cls: "bg-cream", use: "Feature and marketing panels" },
  { name: "Cream soft", token: "--cream-soft", cls: "bg-cream-soft", use: "Quiet feature fills" },
  { name: "Lime", token: "--lime", cls: "bg-lime", use: "The one thing that matters. Never small text on white." },
  { name: "Sage ink", token: "--sage-ink", cls: "bg-sage-ink", ink: true, use: "AI mark, upsell card (white text 5.5:1)" },
];

function Surfaces() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SURFACES.map((s) => (
        <div key={s.name} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <span className={cn("flex h-20 items-end p-2 text-xs font-medium", s.cls, s.ink ? "text-white" : "text-ink")}>{s.name}</span>
          <span className="flex flex-col gap-0.5 p-2.5">
            <span className="flex flex-wrap items-baseline justify-between gap-1">
              <Mono>{s.token}</Mono>
              <LiveVar name={s.token} />
            </span>
            <span className="text-2xs text-ink-3">{s.use}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Elevation & shadows                                                 */
/* ------------------------------------------------------------------ */

const LEVELS: { n: number; name: string; rule: string; cls: string }[] = [
  { n: 0, name: "Ground", rule: "bg-bg, no border", cls: "bg-bg ring-1 ring-line" },
  { n: 1, name: "Panel", rule: "surface + border-line + card-shadow", cls: "bg-surface border border-line shadow-[var(--card-shadow)]" },
  { n: 2, name: "Raised control", rule: "btn-2-bg + btn-2-border + btn-2-shadow", cls: "bg-[var(--btn-2-bg)] border border-[var(--btn-2-border)] shadow-[var(--btn-2-shadow)]" },
  { n: 3, name: "Floating", rule: "surface + border-line + shadow-lg (menus, popovers, toasts)", cls: "bg-surface border border-line shadow-lg" },
  { n: 4, name: "Modal", rule: "shadow-lg over a 42% ink scrim; focus trapped", cls: "bg-surface border border-line shadow-lg" },
];

function Elevation() {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-bg p-6 ring-1 ring-line">
        <div className="relative max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
          <p className="text-overline mb-2">1 · Panel</p>
          <p className="heading-card">Plays this week</p>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-[var(--btn-2-bg)] px-3 text-ui shadow-[var(--btn-2-shadow)]">
              2 · Filter <ChevronDown aria-hidden className="size-3.5" />
            </span>
          </div>
          <div className="absolute left-24 top-28 z-10 w-48 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg sm:left-32">
            <p className="text-overline px-2 pb-1 pt-1.5">3 · Floating</p>
            {["Live", "Draft", "Paused"].map((t, i) => (
              <span key={t} className={cn("flex h-8 items-center justify-between rounded-[var(--radius-control)] px-2 text-ui", i === 0 && "bg-surface-2")}>
                {t}
                {i === 0 ? <Check aria-hidden className="size-3.5" /> : null}
              </span>
            ))}
          </div>
          <div className="h-24" />
        </div>
        <p className="text-overline absolute right-4 top-3">0 · Ground</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {LEVELS.map((l) => (
          <li key={l.n} className="flex flex-col gap-2">
            {l.n === 4 ? (
              <span className="block rounded-[var(--radius-card)] bg-[rgb(26_29_27/0.42)] p-2">
                <span className={cn("grid h-10 place-items-center rounded-[var(--radius-card)] text-ui font-semibold", l.cls)}>{l.n}</span>
              </span>
            ) : (
              <span className={cn("grid h-14 place-items-center rounded-[var(--radius-card)] text-ui font-semibold", l.cls)}>{l.n}</span>
            )}
            <span className="text-ui font-medium">{l.name}</span>
            <span className="text-2xs text-ink-3">{l.rule}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SHADOWS: { token: string; cls: string; use: string }[] = [
  { token: "--card-shadow", cls: "shadow-[var(--card-shadow)]", use: "Cards and panels" },
  { token: "--btn-2-shadow", cls: "shadow-[var(--btn-2-shadow)]", use: "Secondary buttons, segmented items" },
  { token: "--shadow-sm", cls: "shadow-sm", use: "Switch thumb, small chips" },
  { token: "--shadow", cls: "shadow-md", use: "Rare: raised tiles" },
  { token: "--shadow-lg", cls: "shadow-lg", use: "Menus, popovers, dialogs, toasts" },
];

function Shadows() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {SHADOWS.map((s) => (
        <div key={s.token} className="flex flex-col gap-2">
          <Stage className="grid place-items-center p-6">
            <span className={cn("block h-16 w-full rounded-[var(--radius-card)] bg-surface", s.cls)} />
          </Stage>
          <Mono>{s.token}</Mono>
          <LiveVar name={s.token} />
          <span className="text-2xs text-ink-3">{s.use}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Focus rings                                                         */
/* ------------------------------------------------------------------ */

function FocusRings() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Tab through these">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Button</Button>
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <a href="#focus-rings" className="text-link text-ui">
            Text link
          </a>
          <Input size="sm" aria-label="Focusable input" placeholder="Input" className="w-32" />
          <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface px-3 text-ui focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
            <Search aria-hidden className="size-3.5" /> Custom
          </button>
          <span tabIndex={0} className="rounded-full focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:outline-none">
            <Avatar name="Liz Prueitt" size="sm" />
          </span>
        </div>
      </Stage>
      <Stage tone="ink" label="On ink">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="h-8 rounded-[var(--radius-control)] bg-white px-3 text-ui font-medium text-ink focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none">
            Approve
          </button>
          <button type="button" className="h-8 rounded-[var(--radius-control)] px-3 text-ui text-white/80 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
            Skip
          </button>
        </div>
      </Stage>
      <Stage tone="white" label="Static: what focus looks like">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-ink px-3 text-ui font-medium text-white outline-2 outline-offset-2 outline-[var(--focus-ring)] [outline-style:solid]">Button</span>
          <span className="inline-flex h-8 w-32 items-center rounded-[var(--radius-field)] border border-brand-700 bg-surface px-2.5 text-ui text-ink-3 outline-2 outline-offset-0 outline-brand-600 [outline-style:solid]">Input</span>
          <span className="inline-flex h-8 items-center rounded-[var(--radius-card)] border border-line bg-surface px-3 text-ui ring-2 ring-[var(--focus-ring)]">Card</span>
        </div>
      </Stage>
      <div className="flex flex-col gap-2 text-ui text-ink-2">
        <p>
          <strong className="font-medium text-ink">Global:</strong> <Mono>:focus-visible</Mono> draws a 2px <Mono>--focus-ring</Mono> outline, 2px offset.
        </p>
        <p>
          <strong className="font-medium text-ink">Fields:</strong> border turns brand-700 plus a 2px outline at 0 offset.
        </p>
        <p>
          <strong className="font-medium text-ink">Custom widgets:</strong> <Mono>focus-visible:ring-2 ring-[var(--focus-ring)]</Mono> and <Mono>outline-none</Mono>.
        </p>
        <p>
          <strong className="font-medium text-ink">On ink:</strong> <Mono>ring-white/70</Mono> with an ink offset.
        </p>
        <p className="flex items-center gap-2">
          <span className="text-ink-3">--focus-ring =</span> <LiveVar name="--focus-ring" />
          <span aria-hidden className="size-3 rounded-full bg-[var(--focus-ring)]" />
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ShapeContent() {
  return (
    <DocPage eyebrow="Foundations" title="Shape & elevation" intro="Tight corners, hairlines and almost no shadow. Only things that float cast one.">
      <Specimen title="Corner radius" description="8px is the largest corner anywhere. Values are read live from the theme.">
        <CornerRadius />
        <Spec items={[["Rule", "Controls 3 · badges 4 · cards 5 · CTAs 7 · frames 8"], ["Circles", "Only avatars, status dots and the switch track"]]} />
      </Specimen>
      <Specimen title="Borders">
        <Borders />
        <Spec items={[["Width", "1px everywhere; 1.5px on checkboxes; 3px left bar on alerts"], ["Contrast", "Control borders ≥ 3:1 (WCAG 1.4.11)"]]} />
      </Specimen>
      <Specimen title="Dividers">
        <Dividers />
      </Specimen>
      <Specimen title="Background surfaces">
        <Surfaces />
        <Spec items={[["Text on lime", "Ink only, 13px+"], ["No gradients", "Feature surfaces are flat cream"]]} />
      </Specimen>
      <Specimen title="Surface elevation" description="Five levels. Separation comes from hairlines first, shadow second.">
        <Elevation />
      </Specimen>
      <Specimen title="Shadows">
        <Shadows />
      </Specimen>
      <Specimen title="Focus rings" description="Keyboard focus is always visible. Press Tab to try.">
        <FocusRings />
      </Specimen>
    </DocPage>
  );
}
