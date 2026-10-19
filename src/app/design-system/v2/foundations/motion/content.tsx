"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Loader2, Play, RotateCcw } from "@/components/icons";
import { Button, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-2xs text-ink-2">{children}</code>;
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DURATIONS: { name: string; ms: number; cls: string; use: string }[] = [
  { name: "instant", ms: 0, cls: "duration-0", use: "Selection, focus rings, text changes" },
  { name: "fast", ms: 120, cls: "duration-[var(--dur-fast)]", use: "Hover colour, button press" },
  { name: "base", ms: 200, cls: "duration-[var(--dur-base)]", use: "Toggles, checks, tooltips, menus" },
  { name: "slow", ms: 300, cls: "duration-[var(--dur-slow)]", use: "Drawers, panels, progress bars" },
  { name: "deliberate", ms: 420, cls: "duration-[var(--dur-deliberate)]", use: "Step-in, onboarding, first paint of a result" },
];

const EASINGS: { name: string; curve: [number, number, number, number]; use: string }[] = [
  { name: "standard", curve: [0.2, 0, 0, 1], use: "Things that move within the screen" },
  { name: "enter", curve: [0.2, 0.7, 0.2, 1], use: "Arriving: menus, toasts, step-in (animate-fade-up)" },
  { name: "exit", curve: [0.4, 0, 1, 1], use: "Leaving: closing drawers, dismissing" },
  { name: "linear", curve: [0, 0, 1, 1], use: "Progress, spinners, shimmer only" },
];

const bez = (c: [number, number, number, number]) => `cubic-bezier(${c.join(", ")})`;

/* ------------------------------------------------------------------ */
/* Durations                                                           */
/* ------------------------------------------------------------------ */

function Durations() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => setOn(!on)}>
          {on ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
          {on ? "Back" : "Play all"}
        </Button>
        <span className="text-xs text-ink-3">Or hover a row. All use the enter curve.</span>
      </div>
      <div className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {DURATIONS.map((d) => (
          <div key={d.name} className="group grid grid-cols-[6rem_1fr] items-center gap-3 px-4 py-3 sm:grid-cols-[6rem_4rem_1fr_minmax(0,14rem)]">
            <span className="text-ui font-medium">{d.name}</span>
            <span className="text-xs tabular-nums text-ink-3 sm:order-none">{d.ms}ms</span>
            <span className="relative col-span-2 h-6 rounded-[var(--radius-control)] bg-surface-2 sm:col-span-1">
              <span
                className={cn("absolute top-1 size-4 rounded-[2px] bg-ink transition-[left] motion-reduce:transition-none", on ? "left-[calc(100%-1.25rem)]" : "left-1 group-hover:left-[calc(100%-1.25rem)]")}
                style={{ transitionDuration: `${d.ms}ms`, transitionTimingFunction: bez(EASINGS[1].curve) }}
              />
            </span>
            <span className="col-span-2 text-xs text-ink-3 sm:col-span-1">{d.use}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

function Curve({ c }: { c: [number, number, number, number] }) {
  const p = (x: number, y: number) => `${Math.round(x * 100 * 100) / 100},${Math.round((100 - y * 100) * 100) / 100}`;
  return (
    <svg viewBox="-6 -6 112 112" className="size-20 shrink-0" aria-hidden>
      <rect x={0} y={0} width={100} height={100} fill="none" stroke="var(--line-strong)" />
      <line x1={0} y1={100} x2={c[0] * 100} y2={100 - c[1] * 100} stroke="var(--chart-6)" strokeDasharray="2 2" />
      <line x1={100} y1={0} x2={c[2] * 100} y2={100 - c[3] * 100} stroke="var(--chart-6)" strokeDasharray="2 2" />
      <path d={`M${p(0, 0)} C${p(c[0], c[1])} ${p(c[2], c[3])} ${p(1, 1)}`} fill="none" stroke="var(--ink)" strokeWidth={2.5} />
    </svg>
  );
}

function Easing() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => setOn(!on)}>
          {on ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
          {on ? "Back" : "Play all"}
        </Button>
        <span className="text-xs text-ink-3">Each runs for 600ms here so the curve is easy to see.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {EASINGS.map((e) => (
          <div key={e.name} className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Curve c={e.curve} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-ui font-medium">{e.name}</span>
              <Mono>{bez(e.curve)}</Mono>
              <span className="relative h-6 rounded-[var(--radius-control)] bg-surface-2">
                <span
                  className={cn("absolute top-1 size-4 rounded-full bg-ink transition-[left] duration-[600ms] motion-reduce:transition-none", on ? "left-[calc(100%-1.25rem)]" : "left-1 group-hover:left-[calc(100%-1.25rem)]")}
                  style={{ transitionTimingFunction: bez(e.curve) }}
                />
              </span>
              <span className="text-xs text-ink-3">{e.use}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Microinteractions                                                   */
/* ------------------------------------------------------------------ */

function PressDemo() {
  const [n, setN] = useState(0);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={() => setN(n + 1)} className="transition-[transform,background-color] duration-[120ms] active:scale-[0.97] motion-reduce:active:scale-100">
        Approve
      </Button>
      <span className="text-xs tabular-nums text-ink-3" aria-live="polite">
        Pressed {n} {n === 1 ? "time" : "times"}
      </span>
    </div>
  );
}

function CheckDemo() {
  const [on, setOn] = useState(false);
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]">
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span aria-hidden className={cn("grid size-5 place-items-center rounded-[4px] border-[1.5px] transition-colors duration-200", on ? "border-ink bg-ink" : "border-control bg-surface")}>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
          <path d="M3 8.5 6.5 12 13 4.5" stroke="white" strokeWidth={2.2} strokeLinecap="square" strokeDasharray={18} strokeDashoffset={on ? 0 : 18} className="transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none" />
        </svg>
      </span>
      <span className="text-ui">Approve draft</span>
    </label>
  );
}

function CopyDemo() {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText("climbos.app/r/tartine");
        } catch {}
        setDone(true);
        window.setTimeout(() => setDone(false), 1500);
      }}
      aria-live="polite"
    >
      <span className="relative inline-grid size-4 place-items-center">
        <Copy aria-hidden className={cn("absolute size-4 transition-[opacity,transform] duration-200 motion-reduce:transition-none", done ? "scale-50 opacity-0" : "opacity-100")} />
        <Check aria-hidden className={cn("absolute size-4 text-green-800 transition-[opacity,transform] duration-200 motion-reduce:transition-none", done ? "opacity-100" : "scale-50 opacity-0")} />
      </span>
      {done ? "Copied" : "Copy link"}
    </Button>
  );
}

function ToggleDemo() {
  const [on, setOn] = useState(true);
  return <Switch label="Autopilot" checked={on} onCheckedChange={setOn} />;
}

function LiveDotDemo() {
  return (
    <span className="inline-flex items-center gap-2 text-ui">
      <span className="relative grid size-2.5 place-items-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-green-500/60 motion-reduce:hidden" />
        <span aria-hidden className="relative size-2 rounded-full bg-green-800" />
      </span>
      Researcher is working
    </span>
  );
}

function Micro() {
  const items: [string, ReactNode, string][] = [
    ["Button press", <PressDemo key="p" />, "scale 0.97 · fast 120ms · standard"],
    ["Toggle", <ToggleDemo key="t" />, "thumb slides · base 200ms · state text changes too"],
    ["Check", <CheckDemo key="c" />, "fill then draw the tick · base 200ms · enter"],
    ["Copy", <CopyDemo key="o" />, "icon cross-fades to a tick, label says Copied for 1.5s"],
    ["Live dot", <LiveDotDemo key="l" />, "1 ring ping per second while an agent works; hidden for reduced motion"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([t, demo, spec]) => (
        <div key={t} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <span className="text-overline">{t}</span>
          <div className="flex min-h-14 items-center">{demo}</div>
          <span className="text-xs text-ink-3">{spec}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */

function useSystemReducedMotion() {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduce(mq.matches);
    const id = requestAnimationFrame(read);
    mq.addEventListener("change", read);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", read);
    };
  }, []);
  return reduce;
}

const SAMPLE = "Bookings fell from 18 to 11 because Saturday posts stopped.";

function ReducedMotion() {
  const system = useSystemReducedMotion();
  const [sim, setSim] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(SAMPLE.length);
  const reduce = sim || system === true;
  const type = () => {
    if (reduce) {
      setTyped(SAMPLE.length);
      return;
    }
    setTyped(0);
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n + 2 >= SAMPLE.length) window.clearInterval(id);
        return Math.min(SAMPLE.length, n + 2);
      });
    }, 30);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <p className="text-ui">
          <span className="text-ink-3">Your system setting: </span>
          <span className="font-medium">{system === null ? "checking…" : system ? "Reduce motion is on" : "Reduce motion is off"}</span>
        </p>
        <Switch label="Simulate reduced motion" checked={sim} onCheckedChange={setSim} className="min-w-64" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Stage tone="white" label="Spinner">
          <div className="flex items-center gap-2 text-ui">
            <Loader2 aria-hidden className={cn("size-4", !reduce && "animate-spin")} />
            Saving…
          </div>
          <p className="mt-3 text-xs text-ink-3">{reduce ? "Stops turning. The word carries the state." : "Turns while busy."}</p>
        </Stage>
        <Stage tone="white" label="Panel">
          <Button size="sm" variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Close panel" : "Open panel"}
          </Button>
          <div className="relative mt-3 h-14 overflow-hidden rounded-[var(--radius-control)] bg-surface-2">
            <div
              className={cn(
                "absolute inset-y-0 right-0 w-2/3 rounded-[var(--radius-control)] border border-line bg-surface shadow-lg",
                reduce ? "transition-opacity duration-200" : "transition-[transform,opacity] duration-300",
                open ? "translate-x-0 opacity-100" : reduce ? "translate-x-0 opacity-0" : "translate-x-full opacity-100",
              )}
              style={{ transitionTimingFunction: bez(EASINGS[1].curve) }}
            />
          </div>
          <p className="mt-3 text-xs text-ink-3">{reduce ? "Fades in place. No slide." : "Slides in from the right."}</p>
        </Stage>
        <Stage tone="white" label="AI reply">
          <Button size="sm" variant="secondary" onClick={type}>
            Replay
          </Button>
          <p className="text-voice mt-3 min-h-12 !text-sm">{SAMPLE.slice(0, typed)}</p>
          <p className="mt-1 text-xs text-ink-3">{reduce ? "Shows the full reply at once." : "Types out like it streams."}</p>
        </Stage>
      </div>
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-ui">
          <caption className="sr-only">Reduced motion rules</caption>
          <thead className="bg-surface-2 text-left text-xs text-ink-3">
            <tr>
              <th scope="col" className="h-9 px-4 font-medium">Pattern</th>
              <th scope="col" className="px-4 font-medium">Class</th>
              <th scope="col" className="px-4 font-medium">With reduced motion</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Spinners", "animate-spin motion-reduce:animate-none", "Static icon + text"],
              ["Slides and drawers", "motion-reduce:transition-none or fade only", "Appear in place"],
              ["Hover lifts, arrow nudges", "motion-reduce:transition-none", "Colour change only"],
              ["Live dots, pulses", "motion-reduce:animate-none / hidden", "Solid dot + word"],
              ["Typing replies", "useTypewriter checks the media query", "Full text at once"],
              ["Everything else", "globals.css @media (prefers-reduced-motion)", "Durations forced to 0.01ms"],
            ].map(([a, b, c]) => (
              <tr key={a} className="h-[var(--cell-h)] border-t border-line">
                <td className="px-4">{a}</td>
                <td className="px-4">
                  <Mono>{b}</Mono>
                </td>
                <td className="px-4 text-ink-2">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MotionContent() {
  return (
    <DocPage eyebrow="Foundations" title="Motion" intro="Quick and quiet. Motion confirms what happened or shows where something went; it never decorates.">
      <Specimen title="Durations" description="Five steps. Small things move fast; big things move a little slower.">
        <Durations />
        <Spec items={[["Loops", "Pulse 1.6s · shimmer 1.4s · spin 1s (linear)"], ["Never", "Longer than 420ms for UI; never block input while animating"]]} />
      </Specimen>
      <Specimen title="Easing" description="Enter decelerates, exit accelerates. Linear only for things that run continuously.">
        <Easing />
      </Specimen>
      <Specimen title="Microinteractions" description="Small, instant confirmations. Each one also changes text or state, not only motion.">
        <Micro />
      </Specimen>
      <Specimen title="Reduced motion" description="When the system asks for less motion, movement becomes a fade or nothing. Meaning never depends on animation.">
        <ReducedMotion />
      </Specimen>
    </DocPage>
  );
}
