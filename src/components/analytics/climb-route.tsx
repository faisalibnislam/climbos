"use client";

/*
 * Climb route to goal: the signature ClimbOS chart. An isometric topographic
 * mountain whose summit is the owner's goal; the route climbs from today's base
 * through each play (camps) to the peak. The covered part of the route is solid
 * lime, the rest dashed. Risks are flagged pins. Built for the ink hero card.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, r2, useEntered, type Tip } from "./shared";

export interface ClimbMilestone {
  label: string;
  /** Position along the route, 0 (start) to 1 (summit). */
  at: number;
  kind: "start" | "camp" | "risk" | "now" | "goal";
  detail?: string;
}

const W = 800;
const H = 470;
const CX = 400;
const BASE_Y = 330;
const RINGS = 17;

function ringPoints(k: number): [number, number][] {
  const t = k / RINGS;
  const R = 300 * (1 - t) ** 1.15 + 6;
  const lift = 210 * (1 - (1 - t) ** 1.6);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const n = 1 + 0.1 * Math.sin(3 * a + 0.6) + 0.06 * Math.sin(5 * a + 1.7 + k * 0.25) + 0.04 * Math.sin(8 * a + k * 0.5);
    const x = CX - 40 * t + Math.cos(a) * R * n;
    const y = BASE_Y - lift + Math.sin(a) * R * n * 0.36;
    pts.push([x, y]);
  }
  return pts;
}

const toPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + "Z";

/** A point on the route at fraction f (spirals up the front face of the mountain). */
function routeAt(f: number): [number, number] {
  // Ease so the route spends most of its length on the wide lower slopes, not the tiny summit rings.
  const k = f ** 1.8 * (RINGS - 1);
  const t = k / RINGS;
  const R = 300 * (1 - t) ** 1.15 + 6;
  const lift = 210 * (1 - (1 - t) ** 1.6);
  // Stay on the visible front face (0..π), sweeping left to right as it climbs.
  const a = Math.PI * (0.88 - 0.7 * f) + 0.12 * Math.sin(f * 7);
  return [r2(CX - 40 * t + Math.cos(a) * R * 0.98), r2(BASE_Y - lift + Math.sin(a) * R * 0.36 * 0.98)];
}

const PIN: Record<ClimbMilestone["kind"], { fill: string; ink: string; mark: string; stem: number }> = {
  start: { fill: "#ffffff", ink: "#161815", mark: "S", stem: 46 },
  camp: { fill: "var(--cream)", ink: "#161815", mark: "▲", stem: 70 },
  risk: { fill: "var(--coral)", ink: "#161815", mark: "!", stem: 58 },
  now: { fill: "var(--lime)", ink: "#161815", mark: "●", stem: 52 },
  goal: { fill: "#ffffff", ink: "#161815", mark: "⚑", stem: 40 },
};

export function ClimbRoute({ milestones, progress, goal }: { milestones: ClimbMilestone[]; progress: number; goal: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const rings = useMemo(() => Array.from({ length: RINGS }, (_, k) => toPath(ringPoints(k))), []);
  const route = useMemo(() => Array.from({ length: 81 }, (_, i) => routeAt(i / 80)), []);
  const cut = Math.round(progress * 80);
  const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const ticks = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => {
        const a = (i / 120) * Math.PI * 2;
        const long = i % 10 === 0;
        const r1 = 345;
        const rr = long ? 362 : 354;
        return [CX + Math.cos(a) * r1, BASE_Y + 10 + Math.sin(a) * r1 * 0.36, CX + Math.cos(a) * rr, BASE_Y + 10 + Math.sin(a) * rr * 0.36].map(r2);
      }),
    [],
  );

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Climb to ${goal}: ${Math.round(progress * 100)}% of the route covered`}>
        {/* Compass base */}
        <ellipse cx={CX} cy={BASE_Y + 10} rx={330} ry={330 * 0.36} fill="none" stroke="var(--sage)" strokeWidth={1.5} />
        {ticks.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(255 255 255 / 0.35)" strokeWidth={1} />
        ))}
        {(
          [
            ["W", CX - 372, BASE_Y + 4],
            ["E", CX + 372, BASE_Y + 4],
            ["N", CX + 250, BASE_Y - 92],
            ["S", CX - 250, BASE_Y + 120],
          ] as const
        ).map(([l, x, y]) => (
          <text key={l} x={x} y={y} fill="#ffffff" fontSize={16} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{l}</text>
        ))}
        {/* Contours, low to high (each ring hides the back of the ones below) */}
        <g className={cn("origin-bottom transition-all duration-700", entered ? "opacity-100" : "translate-y-3 opacity-0")}>
          {rings.map((d, k) => (
            <path key={k} d={d} fill="var(--ink)" stroke={k % 4 === 0 ? "rgb(255 255 255 / 0.55)" : "rgb(255 255 255 / 0.3)"} strokeWidth={k % 4 === 0 ? 1.4 : 1} />
          ))}
        </g>
        {/* Route: covered (solid lime) then remaining (dashed) */}
        <path d={line(route.slice(cut))} fill="none" stroke="rgb(255 255 255 / 0.85)" strokeWidth={2} strokeDasharray="5 5" />
        <path
          d={line(route.slice(0, cut + 1))}
          fill="none"
          stroke="var(--lime)"
          strokeWidth={3}
          strokeLinecap="square"
          pathLength={1}
          strokeDasharray="1 1"
          style={{ strokeDashoffset: entered ? 0 : 1, transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1) .3s" }}
        />
        {/* Pins */}
        {milestones.map((m, mi) => {
          const [x, y] = routeAt(m.at);
          const p = PIN[m.kind];
          const top = y - p.stem - (mi % 2 ? 22 : 0);
          return (
            <g
              key={m.label}
              tabIndex={0}
              role="button"
              aria-label={`${m.label}${m.detail ? `: ${m.detail}` : ""}`}
              className="cursor-default outline-none"
              onMouseEnter={() => setTip({ x: (x / W) * 100, y: ((top - 16) / H) * 100, title: m.label, lines: m.detail ? [m.detail] : undefined })}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip({ x: (x / W) * 100, y: ((top - 16) / H) * 100, title: m.label, lines: m.detail ? [m.detail] : undefined })}
              onBlur={() => setTip(null)}
            >
              <line x1={x} y1={y} x2={x} y2={top} stroke={m.kind === "risk" ? "var(--coral)" : m.kind === "now" ? "var(--lime)" : "rgb(255 255 255 / 0.7)"} strokeWidth={1.5} />
              <rect x={x - 3} y={y - 3} width={6} height={6} fill={m.kind === "now" ? "var(--lime)" : "#ffffff"} />
              <circle cx={x} cy={top - 14} r={14} fill={p.fill} stroke="var(--ink)" strokeWidth={2} />
              <text x={x} y={top - 13.5} fill={p.ink} fontSize={m.kind === "camp" ? 11 : 13} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{p.mark}</text>
            </g>
          );
        })}
      </svg>
      <TipLayer tip={tip} />
      <DataTable caption={`Climb to ${goal}`} columns={["Milestone", "Kind", "Route position", "Detail"]} rows={milestones.map((m) => [m.label, m.kind, `${Math.round(m.at * 100)}%`, m.detail ?? ""])} />
    </div>
  );
}
