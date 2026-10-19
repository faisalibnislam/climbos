"use client";

import { useState, type DragEvent, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { CalendarClock, Check, CircleAlert, GripVertical, Home, ImageIcon, Inbox, Loader2, Lock, Megaphone, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "@/components/icons";
import { Badge, Button, Checkbox, Field, IconButton, Input, Segmented, Skeleton, Switch, Tooltip } from "@/components/ui";
import { LiveProgress } from "@/components/ds/ai";
import { cn } from "@/lib/utils";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* ------------------------------------------------------------------ */
/* State matrix (static renderings of each state)                      */
/* ------------------------------------------------------------------ */

type State = "default" | "hover" | "active" | "focus" | "selected" | "disabled" | "read-only" | "loading" | "error";
const STATES: State[] = ["default", "hover", "active", "focus", "selected", "disabled", "read-only", "loading", "error"];

const STATE_NOTE: Record<State, string> = {
  default: "Resting",
  hover: "Pointer over, colour only",
  active: "Pressed",
  focus: "Keyboard focus",
  selected: "Chosen, ink + check",
  disabled: "Can't use now, 55%",
  "read-only": "Can see, can't change",
  loading: "Working, keep size",
  error: "Needs attention",
};

const focusRing = "ring-2 ring-[var(--focus-ring)] ring-offset-2 ring-offset-surface";

function MButton({ s }: { s: State }) {
  const base = "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-ui font-medium whitespace-nowrap [&_svg]:size-3.5";
  const sec = "border-[var(--btn-2-border)] bg-[var(--btn-2-bg)] text-ink shadow-[var(--btn-2-shadow)]";
  if (s === "read-only") return <span className="text-2xs text-ink-3">Hidden: no actions when read-only</span>;
  const cls = {
    default: sec,
    hover: cn(sec, "bg-surface-2"),
    active: cn(sec, "scale-[0.97] bg-surface-3 shadow-none"),
    focus: cn(sec, focusRing),
    selected: "border-ink bg-ink text-white",
    disabled: cn(sec, "opacity-55"),
    loading: cn(sec, "text-ink-2"),
    error: "border-red-800 bg-surface text-red-800",
  }[s];
  return (
    <span className={cn(base, cls)}>
      {s === "loading" ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : s === "selected" ? <Check aria-hidden /> : s === "error" ? <RotateCcw aria-hidden /> : null}
      {s === "loading" ? "Saving…" : s === "error" ? "Retry" : "Schedule"}
    </span>
  );
}

function MInput({ s }: { s: State }) {
  const base = "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-[var(--radius-field)] border bg-surface px-2.5 text-ui";
  const cls = {
    default: "border-control",
    hover: "border-control-hover",
    active: "border-ink",
    focus: "border-brand-700 outline-2 outline-brand-600 [outline-style:solid]",
    selected: "border-brand-700",
    disabled: "border-control/40 bg-surface-2 text-ink-3",
    "read-only": "border-transparent bg-surface-2 text-ink-2",
    loading: "border-control",
    error: "border-red-800",
  }[s];
  return (
    <span className="flex w-full flex-col gap-1">
      <span className={cn(base, cls)}>
        {s === "selected" ? (
          <span>
            Tartine <span className="bg-sun-soft">Bakery</span>
          </span>
        ) : s === "error" ? (
          <span className="text-ink-3">Business name</span>
        ) : (
          <span className="truncate">
            Tartine Bak{s === "active" ? <span aria-hidden className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-ink" /> : "ery"}
          </span>
        )}
        {s === "read-only" ? <Lock aria-hidden className="ml-auto size-3.5 text-ink-3" /> : null}
        {s === "loading" ? <Loader2 aria-hidden className="ml-auto size-3.5 animate-spin text-ink-3 motion-reduce:animate-none" /> : null}
      </span>
      {s === "error" ? (
        <span className="flex items-center gap-1 text-2xs font-medium text-red-800">
          <CircleAlert aria-hidden className="size-3" /> Enter a name
        </span>
      ) : null}
    </span>
  );
}

function MCard({ s }: { s: State }) {
  const base = "relative flex w-full flex-col gap-1 rounded-[var(--radius-card)] border bg-surface p-2.5";
  const cls = {
    default: "border-line shadow-[var(--card-shadow)]",
    hover: "border-line-strong shadow-[var(--btn-2-shadow)]",
    active: "scale-[0.99] border-line-strong bg-surface-2",
    focus: cn("border-line", focusRing),
    selected: "border-ink ring-1 ring-ink",
    disabled: "border-line bg-surface-2 opacity-55",
    "read-only": "border-line",
    loading: "border-line",
    error: "border-red-800/40 bg-red-100/40",
  }[s];
  if (s === "loading")
    return (
      <span className={cn(base, cls)} aria-busy>
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </span>
    );
  return (
    <span className={cn(base, cls)}>
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-ui font-medium">{s === "error" ? "Couldn’t load" : "Class reel"}</span>
        {s === "selected" ? (
          <span className="grid size-4 place-items-center rounded-full bg-ink text-white">
            <Check aria-hidden className="size-2.5" strokeWidth={3} />
          </span>
        ) : s === "read-only" ? (
          <Lock aria-hidden className="size-3.5 text-ink-3" />
        ) : s === "error" ? (
          <CircleAlert aria-hidden className="size-3.5 text-red-800" />
        ) : null}
      </span>
      <span className={cn("text-2xs", s === "error" ? "text-red-800" : "text-ink-3")}>{s === "error" ? "Tap to retry" : s === "read-only" ? "View only" : "Instagram · Sat"}</span>
    </span>
  );
}

function MRow({ s }: { s: State }) {
  const base = "flex h-9 w-full items-center gap-2 border-y border-line px-2 text-ui";
  const cls = {
    default: "bg-surface",
    hover: "bg-surface-2",
    active: "bg-surface-3",
    focus: "bg-surface ring-2 ring-inset ring-[var(--focus-ring)]",
    selected: "bg-brand-50 shadow-[inset_2px_0_0_var(--ink)]",
    disabled: "bg-surface text-ink-3",
    "read-only": "bg-surface",
    loading: "bg-surface",
    error: "bg-red-100/50 text-red-800",
  }[s];
  if (s === "loading")
    return (
      <span className={cn(base, cls)} aria-busy>
        <Skeleton className="size-3.5" />
        <Skeleton className="h-2.5 flex-1" />
      </span>
    );
  const box =
    s === "read-only" ? (
      <Lock aria-hidden className="size-3.5 text-ink-3" />
    ) : s === "error" ? (
      <CircleAlert aria-hidden className="size-3.5" />
    ) : (
      <span aria-hidden className={cn("grid size-3.5 place-items-center rounded-[3px] border-[1.5px]", s === "selected" ? "border-ink bg-ink text-white" : s === "disabled" ? "border-control/40" : "border-control")}>
        {s === "selected" ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
    );
  return (
    <span className={cn(base, cls)}>
      {box}
      <span className="truncate">{s === "error" ? "Didn’t send" : "Win-back email"}</span>
      {s === "hover" ? <MoreHorizontal aria-hidden className="ml-auto size-3.5 text-ink-2" /> : <span className="ml-auto text-2xs tabular-nums text-ink-3">318</span>}
    </span>
  );
}

function StateMatrix() {
  const cols: [string, (p: { s: State }) => ReactNode][] = [
    ["Button", MButton],
    ["Input", MInput],
    ["Card", MCard],
    ["Row", MRow],
  ];
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-ui">
        <caption className="sr-only">States for button, input, card and row</caption>
        <thead className="bg-surface-2 text-left text-xs text-ink-3">
          <tr>
            <th scope="col" className="h-9 w-32 px-4 font-medium">State</th>
            {cols.map(([c]) => (
              <th key={c} scope="col" className="px-4 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATES.map((s) => (
            <tr key={s} className="border-t border-line">
              <th scope="row" className="px-4 py-3 text-left align-middle font-normal">
                <span className="block text-ui font-medium capitalize text-ink">{s}</span>
                <span className="block text-2xs text-ink-3">{STATE_NOTE[s]}</span>
              </th>
              {cols.map(([c, C]) => (
                <td key={c} className="px-4 py-3 align-middle">
                  <C s={s} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live states                                                         */
/* ------------------------------------------------------------------ */

function HoverStates() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Buttons and icons">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <Button size="sm" variant="ghost">
            Ghost
          </Button>
          <Button size="sm" variant="link">
            Link
          </Button>
          <IconButton size="sm" aria-label="Edit" icon={<Pencil className="size-4" />} />
        </div>
      </Stage>
      <Stage label="Nav items">
        <nav aria-label="Sample" className="flex flex-col gap-0.5">
          {[
            [Home, "Today"],
            [Inbox, "Approvals"],
            [Megaphone, "Campaigns"],
          ].map(([I, t]) => {
            const Icon = I as typeof Home;
            return (
              <a key={t as string} href="#hover-states" className="flex h-9 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm text-ink-2 transition-colors duration-[120ms] hover:bg-surface hover:text-ink">
                <Icon aria-hidden className="size-4" />
                {t as string}
              </a>
            );
          })}
        </nav>
      </Stage>
      <Stage label="Cards">
        <a href="#hover-states" className="block rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)] transition-colors duration-[120ms] hover:border-line-strong">
          <span className="heading-card block">Saturday class reel</span>
          <span className="text-xs text-ink-3">Border strengthens on hover. No lift, no shadow jump.</span>
        </a>
      </Stage>
      <Stage tone="white" label="Rows reveal actions">
        <ul className="divide-y divide-line">
          {["Win-back email", "Lead list"].map((t) => (
            <li key={t} className="group flex h-[var(--cell-h)] items-center gap-2 px-2 text-ui transition-colors duration-[120ms] hover:bg-surface-2 focus-within:bg-surface-2">
              {t}
              <span className="ml-auto flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <IconButton size="sm" aria-label={`Edit ${t}`} icon={<Pencil className="size-3.5" />} tooltip={false} />
                <IconButton size="sm" aria-label={`Delete ${t}`} icon={<Trash2 className="size-3.5" />} tooltip={false} />
              </span>
            </li>
          ))}
        </ul>
      </Stage>
    </div>
  );
}

function ActiveStates() {
  const [seg, setSeg] = useState("week");
  const [current, setCurrent] = useState("Approvals");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Pressed (hold the mouse down)">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="active:scale-[0.97] motion-reduce:active:scale-100">
            Approve
          </Button>
          <Button size="sm" variant="secondary" className="active:scale-[0.97] motion-reduce:active:scale-100">
            Edit
          </Button>
          <button type="button" className="rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-left text-ui shadow-[var(--card-shadow)] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-surface-2 motion-reduce:active:scale-100">
            Press a card
          </button>
        </div>
      </Stage>
      <Stage label="Current (where you are)">
        <div className="flex flex-col gap-3">
          <nav aria-label="Current page sample" className="flex flex-col gap-0.5">
            {["Today", "Approvals", "Campaigns"].map((t) => (
              <button
                key={t}
                type="button"
                aria-current={current === t ? "page" : undefined}
                onClick={() => setCurrent(t)}
                className={cn("flex h-9 items-center rounded-[var(--radius-control)] px-3 text-left text-sm transition-colors", current === t ? "bg-surface font-medium text-ink shadow-[var(--card-shadow)]" : "text-ink-2 hover:text-ink")}
              >
                {t}
              </button>
            ))}
          </nav>
          <Segmented
            label="Range"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </div>
      </Stage>
    </div>
  );
}

const PICK = [
  { id: "bookings", t: "Class bookings", d: "Most plays aim here" },
  { id: "orders", t: "Catering orders", d: "Offices nearby" },
  { id: "reviews", t: "More reviews", d: "Ask happy guests" },
];

function SelectedStates() {
  const [goal, setGoal] = useState("bookings");
  const [rows, setRows] = useState<string[]>(["Class reel"]);
  const [chips, setChips] = useState<string[]>(["Instagram"]);
  const toggleRow = (r: string) => setRows(rows.includes(r) ? rows.filter((x) => x !== r) : [...rows, r]);
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-medium text-ink-2">Single choice (radio cards)</legend>
        {PICK.map((p) => {
          const on = goal === p.id;
          return (
            <label key={p.id} className={cn("relative flex cursor-pointer flex-col gap-0.5 rounded-[var(--radius-card)] border bg-surface p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]", on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong")}>
              <input type="radio" name="goal-sample" className="sr-only" checked={on} onChange={() => setGoal(p.id)} />
              <span className="flex items-center justify-between text-ui font-medium">
                {p.t}
                {on ? (
                  <span className="grid size-4 place-items-center rounded-full bg-ink text-white">
                    <Check aria-hidden className="size-2.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="size-4 rounded-full border border-control" />
                )}
              </span>
              <span className="text-xs text-ink-3">{p.d}</span>
            </label>
          );
        })}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <p className="flex h-9 items-center bg-surface-2 px-3 text-xs text-ink-3" aria-live="polite">
            {rows.length ? `${rows.length} selected` : "Select rows"}
          </p>
          <ul className="divide-y divide-line">
            {["Class reel", "Win-back email", "Lead list"].map((r) => {
              const on = rows.includes(r);
              return (
                <li key={r} className={cn("flex items-center px-3 transition-colors", on ? "bg-brand-50 shadow-[inset_2px_0_0_var(--ink)]" : "hover:bg-surface-2")}>
                  <Checkbox label={r} checked={on} onCheckedChange={() => toggleRow(r)} />
                </li>
              );
            })}
          </ul>
        </div>
        <Stage tone="white" label="Multi choice (chips)">
          <div role="group" aria-label="Channels" className="flex flex-wrap gap-1.5">
            {["Instagram", "Facebook", "Email", "Google"].map((c) => {
              const on = chips.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => setChips(on ? chips.filter((x) => x !== c) : [...chips, c])} className={cn("inline-flex h-8 items-center gap-1 rounded-[var(--radius-badge)] border px-2.5 text-ui transition-colors", on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:text-ink")}>
                  {on ? <Check aria-hidden className="size-3.5" /> : null}
                  {c}
                </button>
              );
            })}
          </div>
        </Stage>
      </div>
    </div>
  );
}

function DisabledStates() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Say why, next to it">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled>
              Publish
            </Button>
            <Tooltip content="Connect Instagram first">
              <span tabIndex={0} className="inline-flex rounded-[var(--radius-control)]">
                <Button size="sm" variant="secondary" disabled>
                  Schedule
                </Button>
              </span>
            </Tooltip>
          </div>
          <p className="text-xs text-ink-3">Connect Instagram to publish. Disabled buttons can’t take focus, so the reason is in text (and in a tooltip on a focusable wrapper).</p>
        </div>
      </Stage>
      <Stage tone="white" label="Controls">
        <div className="flex flex-col gap-1">
          <Field label="Ad budget" hint="Unlocks on Pro.">
            <Input disabled defaultValue="$5 a day" />
          </Field>
          <Switch label="Auto-publish" description="Needs a connected account." checked={false} disabled />
          <Checkbox label="Send at best time" disabled checked />
        </div>
      </Stage>
    </div>
  );
}

function ReadOnly() {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 rounded-[var(--radius-card)] border border-line bg-cream-soft px-3 py-2 text-ui text-ink">
        <Lock aria-hidden className="size-4" />
        Viewing as Liz (read-only). Nothing you do here changes her account.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Stage tone="white" label="Read-only fields">
          <div className="flex flex-col gap-3">
            <Field label="Business name" hint="Set by the owner.">
              <Input readOnly defaultValue="Tartine Bakery" className="border-transparent bg-surface-2 text-ink-2 hover:border-transparent" />
            </Field>
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-ui font-medium">Social autopilot</span>
                <span className="block text-xs text-ink-3">Only owners can change this.</span>
              </span>
              <Badge tone="neutral" icon={<Lock />}>
                On
              </Badge>
            </div>
          </div>
        </Stage>
        <Stage tone="white" label="Key–value display">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-ui">
            {[
              ["Plan", "Pro · $39/mo"],
              ["Credits", "590 left"],
              ["Model", "Sol (Expert)"],
              ["Owner", "Liz Prueitt"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Stage>
      </div>
    </div>
  );
}

function Loading() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Stage tone="white" label="Under 2s: spinner in place">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              loading={busy}
              loadingText="Saving…"
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => setBusy(false), 1500);
              }}
            >
              Save
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" /> Syncing reviews…
            </span>
          </div>
          <p className="text-xs text-ink-3">Button keeps its width; label changes to say what’s happening.</p>
        </div>
      </Stage>
      <Stage tone="white" label="Over 2s: bar, time left, steps">
        <LiveProgress label="Scanning 6 competitors · step 3 of 6" value={58} secondsLeft={14} />
        <p className="mt-2 text-xs text-ink-3">Found so far: 3 sell sourdough, none run classes.</p>
      </Stage>
      <Stage tone="white" label="First load: skeleton in the final shape" className="md:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3" aria-busy aria-label="Loading plays">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line p-3">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          ))}
        </div>
      </Stage>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dragging                                                            */
/* ------------------------------------------------------------------ */

function Dragging() {
  const [items, setItems] = useState(["Restore the Book now button", "Saturday class reel", "Answer 14 reviews", "Win-back email"]);
  const [drag, setDrag] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const moveTo = (item: string, to: number) => {
    const next = items.filter((x) => x !== item);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    setItems(next);
    return next;
  };
  const onOver = (e: DragEvent, over: string) => {
    e.preventDefault();
    if (!drag || drag === over) return;
    moveTo(drag, items.indexOf(over));
  };
  const onKey = (e: KeyboardEvent, item: string) => {
    const i = items.indexOf(item);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted === item) {
        setLifted(null);
        setMsg(`${item} dropped at position ${i + 1}.`);
      } else {
        setLifted(item);
        setMsg(`${item} lifted. Use arrow keys to move, Space to drop.`);
      }
    } else if (lifted === item && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const to = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (to < 0 || to >= items.length) return;
      moveTo(item, to);
      setMsg(`Position ${to + 1} of ${items.length}.`);
    } else if (e.key === "Escape" && lifted) {
      setLifted(null);
      setMsg("Move finished.");
    }
  };
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="flex flex-col gap-2">
        <p className="text-overline">Priority · drag, or focus the handle and press Space</p>
        <ol className="flex flex-col gap-1.5">
          {items.map((t, i) => {
            const isDrag = drag === t;
            const isLift = lifted === t;
            return (
              <li
                key={t}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", t);
                  setDrag(t);
                }}
                onDragOver={(e) => onOver(e, t)}
                onDragEnd={() => setDrag(null)}
                className={cn(
                  "flex h-[var(--h-lg)] items-center gap-2 rounded-[var(--radius-card)] border bg-surface pl-1 pr-3 text-ui transition-[box-shadow,opacity] duration-200",
                  isDrag ? "border-dashed border-line-strong bg-surface-2 opacity-50 shadow-none" : isLift ? "border-ink shadow-lg ring-1 ring-ink" : "border-line shadow-[var(--card-shadow)]",
                )}
              >
                <button type="button" aria-label={`Reorder ${t}`} aria-pressed={isLift} onKeyDown={(e) => onKey(e, t)} className="grid h-8 w-6 cursor-grab place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
                  <GripVertical aria-hidden className="size-4" />
                </button>
                <span className="w-4 text-xs tabular-nums text-ink-3">{i + 1}</span>
                <span className="truncate">{t}</span>
              </li>
            );
          })}
        </ol>
        <p aria-live="assertive" className="min-h-4 text-xs text-ink-3">
          {msg}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-overline">How it looks</p>
        <div className="flex h-[var(--h-lg)] rotate-[1.5deg] items-center gap-2 rounded-[var(--radius-card)] border border-ink bg-surface px-3 text-ui shadow-lg ring-1 ring-ink">
          <GripVertical aria-hidden className="size-4 text-ink-3" />
          Lifted item
        </div>
        <div className="flex h-[var(--h-lg)] items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface-2 px-3 text-xs text-ink-3">Where it came from</div>
        <Spec items={[["Lifted", "shadow-lg + ink ring, cursor grabbing"], ["Origin", "dashed, 50% opacity"], ["Keys", "Space lift/drop, ↑ ↓ move, Esc stop"]]} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drop target                                                         */
/* ------------------------------------------------------------------ */

const DRAFTS = [
  { id: "d1", t: "Saturday class reel", ok: true },
  { id: "d2", t: "Starter tips carousel", ok: true },
  { id: "d3", t: "Holiday hours post", ok: false },
];

type ZoneState = "idle" | "available" | "over" | "rejected" | "dropped";

const ZONE_CLS: Record<ZoneState, string> = {
  idle: "border-dashed border-line-strong bg-surface text-ink-3",
  available: "border-dashed border-ink bg-surface-2 text-ink-2",
  over: "border-solid border-ink bg-brand-50 text-ink ring-1 ring-ink",
  rejected: "border-solid border-red-800 bg-red-100/50 text-red-800",
  dropped: "border-solid border-line bg-surface text-ink",
};

function Zone({ state, children, ...rest }: { state: ZoneState; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-h-24 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border-[1.5px] p-3 text-center text-ui transition-colors duration-[120ms]", ZONE_CLS[state])} {...rest}>
      {children}
    </div>
  );
}

function DropTarget() {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const dragging = DRAFTS.find((d) => d.id === drag);
  const state: ZoneState = dragging ? (over ? (dragging.ok ? "over" : "rejected") : "available") : slot ? "dropped" : "idle";
  const place = (id: string) => {
    const d = DRAFTS.find((x) => x.id === id);
    if (d?.ok) setSlot(d.t);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-overline">Drafts</p>
          {DRAFTS.map((d) => (
            <div
              key={d.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", d.id);
                setDrag(d.id);
              }}
              onDragEnd={() => {
                setDrag(null);
                setOver(false);
              }}
              className={cn("flex cursor-grab items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-2.5 text-ui shadow-[var(--card-shadow)] active:cursor-grabbing", drag === d.id && "opacity-50")}
            >
              <GripVertical aria-hidden className="size-4 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{d.t}</span>
              {d.ok ? null : (
                <Badge tone="amber" icon={<ImageIcon />}>
                  Needs image
                </Badge>
              )}
              <Button size="sm" variant="ghost" disabled={!d.ok} onClick={() => place(d.id)} aria-label={`Schedule ${d.t} for Saturday 9:00`}>
                Schedule
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-overline">Saturday 9:00</p>
          <Zone
            state={state}
            aria-label="Saturday 9:00 slot"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = dragging?.ok ? "move" : "none";
              if (!over) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              place(e.dataTransfer.getData("text/plain"));
              setOver(false);
              setDrag(null);
            }}
          >
            <span aria-live="polite" className="flex flex-col items-center gap-1">
              <CalendarClock aria-hidden className="size-5" />
              {state === "idle"
                ? "Drop a draft here"
                : state === "available"
                  ? "Drop here to schedule"
                  : state === "over"
                    ? "Release to schedule"
                    : state === "rejected"
                      ? "Add an image first"
                      : `Scheduled: ${slot}`}
            </span>
            {state === "dropped" ? (
              <Button size="sm" variant="ghost" onClick={() => setSlot(null)}>
                Undo
              </Button>
            ) : null}
          </Zone>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Drop target states">
        {(Object.keys(ZONE_CLS) as ZoneState[]).map((z) => (
          <div key={z} className="flex flex-col gap-1">
            <div className={cn("grid h-14 place-items-center rounded-[var(--radius-card)] border-[1.5px] text-xs capitalize", ZONE_CLS[z])}>{z}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StatesContent() {
  return (
    <DocPage eyebrow="Foundations" title="States" intro="Every interactive thing has the same set of states, and each state changes more than colour.">
      <Specimen title="Design states" description="The full matrix, frozen so you can compare. Live versions follow.">
        <StateMatrix />
        <Spec items={[["Order", "Error > loading > disabled > selected > focus > active > hover > default"], ["Rule", "Every state also changes text, icon or shape, not colour alone"]]} />
      </Specimen>
      <Specimen title="Hover states" description="Colour only, 120ms. Never move layout. Nothing important hides behind hover on touch.">
        <HoverStates />
      </Specimen>
      <Specimen title="Active states" description="Two meanings: pressed right now, and current (the page or option you’re on).">
        <ActiveStates />
        <Spec items={[["Pressed", "surface-3 or scale 0.97, 120ms"], ["Current", "aria-current, white raised item or ink fill"]]} />
      </Specimen>
      <Specimen title="Selected states" description="Ink border or fill, plus a check. Exposed with aria-checked, aria-pressed or aria-selected.">
        <SelectedStates />
      </Specimen>
      <Specimen title="Disabled states" description="55% opacity, no pointer events. Always say what unlocks it.">
        <DisabledStates />
      </Specimen>
      <Specimen title="Read-only" description="Readable, copyable, not editable. Different from disabled: it isn’t greyed out.">
        <ReadOnly />
      </Specimen>
      <Specimen title="Loading" description="Keep the shape. Short waits spin; long ones show a bar, time left and what’s been found.">
        <Loading />
      </Specimen>
      <Specimen title="Dragging">
        <Dragging />
      </Specimen>
      <Specimen title="Drop target" description="Shows where things can go as soon as a drag starts, and says no before you let go.">
        <DropTarget />
      </Specimen>
    </DocPage>
  );
}
