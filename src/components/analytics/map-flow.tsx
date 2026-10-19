"use client";

/*
 * Place and process views.
 * - DotMap: a dotted world (land sampled on a grid from simplified outlines) with
 *   sized pins and a callout for the selected place (reference: user geography).
 * - FlowNetwork: labelled stages joined by dashed curves with square junction marks
 *   (reference: Watch → Ship → Detect…), each stage carrying its count. Flat, no glow.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, fmt, r2, useEntered, type Tip } from "./shared";

type Poly = [number, number][];
const LAND: Poly[] = [
  [[-168, 66], [-162, 70], [-140, 70], [-120, 72], [-95, 74], [-80, 70], [-62, 60], [-56, 52], [-66, 45], [-75, 38], [-80, 31], [-81, 25], [-90, 29], [-97, 26], [-97, 20], [-90, 16], [-84, 10], [-79, 8], [-86, 14], [-105, 20], [-115, 30], [-124, 40], [-125, 48], [-135, 57], [-150, 60], [-165, 60]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-60, 82], [-72, 78], [-58, 70]],
  [[-80, 10], [-60, 11], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-74, -50], [-72, -30], [-70, -18], [-81, -5]],
  [[-10, 36], [0, 43], [-5, 48], [-2, 51], [5, 53], [8, 57], [12, 55], [18, 60], [22, 65], [28, 71], [40, 68], [45, 60], [40, 45], [30, 45], [28, 41], [23, 38], [15, 38], [12, 44], [5, 43], [3, 42], [-8, 37]],
  [[-6, 50], [2, 51], [0, 55], [-3, 59], [-6, 57]],
  [[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -1], [40, -15], [35, -25], [28, -34], [18, -34], [12, -18], [9, -2], [8, 4], [-5, 5], [-14, 10]],
  [[28, 41], [40, 45], [45, 60], [40, 68], [60, 70], [80, 73], [100, 77], [120, 73], [140, 72], [160, 70], [180, 67], [178, 62], [160, 58], [142, 52], [140, 45], [130, 42], [122, 40], [121, 31], [118, 24], [108, 20], [106, 10], [100, 13], [98, 8], [103, 1], [95, 15], [90, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [48, 29], [55, 22], [58, 18], [52, 15], [44, 13], [35, 30], [36, 36]],
  [[130, 31], [135, 34], [141, 38], [142, 45], [140, 41], [135, 36]],
  [[95, 5], [106, -6], [115, -8], [125, -9], [140, -5], [150, -6], [130, 0], [118, 4], [108, 2]],
  [[114, -22], [122, -17], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [131, -31], [115, -34]],
  [[44, -25], [49, -15], [50, -13], [47, -25]],
  [[167, -46], [172, -41], [178, -38], [175, -36], [171, -40]],
];

function inside([x, y]: [number, number], poly: Poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const MW = 720;
const MH = 300;
const px = (lon: number) => r2(((lon + 170) / 350) * MW);
const py = (lat: number) => r2(((80 - lat) / 138) * MH);

export interface Place {
  label: string;
  lon: number;
  lat: number;
  value: number;
}

export function DotMap({ places, unit = "leads", selected }: { places: Place[]; unit?: string; selected?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const dots = useMemo(() => {
    const out: [number, number][] = [];
    for (let lat = 78; lat >= -56; lat -= 3.2) for (let lon = -168; lon <= 180; lon += 3.2) if (LAND.some((p) => inside([lon, lat], p))) out.push([px(lon), py(lat)]);
    return out;
  }, []);
  const max = Math.max(...places.map((p) => p.value)) || 1;
  const sel = places.find((p) => p.label === selected) ?? places.reduce((a, b) => (b.value > a.value ? b : a), places[0]);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${MW} ${MH}`} className="w-full" role="img" aria-label={`${unit} by place: ${places.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}`}>
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.7} fill="var(--ink)" opacity={entered ? 0.16 : 0} style={{ transition: `opacity .6s ${(x / MW) * 400}ms` }} />
        ))}
        {places.map((p) => {
          const r = r2(4 + 9 * Math.sqrt(p.value / max));
          const x = px(p.lon);
          const y = py(p.lat);
          const isSel = p === sel;
          const show = () => setTip({ x: (x / MW) * 100, y: ((y - r) / MH) * 100, title: p.label, lines: [`${fmt(p.value)} ${unit}`] });
          return (
            <g key={p.label} tabIndex={0} className="outline-none" onMouseEnter={show} onMouseLeave={() => setTip(null)} onFocus={show} onBlur={() => setTip(null)}>
              <circle cx={x} cy={y} r={r + 5} fill={isSel ? "var(--lime)" : "var(--brand-200)"} opacity={0.6} />
              <circle cx={x} cy={y} r={r} fill={isSel ? "var(--ink)" : "var(--brand-700)"} stroke="var(--surface)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      {sel ? (
        <div className="pointer-events-none absolute rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 shadow-lg" style={{ left: `${(px(sel.lon) / MW) * 100 + 2}%`, top: `${(py(sel.lat) / MH) * 100 - 16}%` }}>
          <p className="text-xs text-ink-2">{sel.label}</p>
          <p className="text-lg font-semibold leading-6 tabular-nums">{fmt(sel.value)} <span className="text-xs font-normal text-ink-3">{unit}</span></p>
        </div>
      ) : null}
      <TipLayer tip={tip} />
      <DataTable caption={`${unit} by place`} columns={["Place", unit]} rows={places.map((p) => [p.label, p.value])} />
    </div>
  );
}

export interface FlowNode {
  id: string;
  label: string;
  count?: number;
  x: number;
  y: number;
  tone?: "white" | "cream" | "sage" | "lime" | "ink";
}

const NODE: Record<NonNullable<FlowNode["tone"]>, string> = {
  white: "bg-surface text-ink ring-1 ring-line",
  cream: "bg-cream text-ink",
  sage: "bg-sage-ink text-white",
  lime: "bg-lime text-ink",
  ink: "bg-ink text-white",
};

export function FlowNetwork({ nodes, edges, height = 300 }: { nodes: FlowNode[]; edges: [string, string][]; height?: number }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div ref={ref} className="relative w-full" style={{ height }} role="img" aria-label={`Flow: ${nodes.map((n) => `${n.label}${n.count !== undefined ? ` ${fmt(n.count)}` : ""}`).join(", ")}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {edges.map(([a, b], i) => {
          const A = by[a];
          const B = by[b];
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2 - 14 * (i % 2 ? 1 : -1);
          return (
            <path key={i} d={`M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`} fill="none" stroke="var(--ink)" strokeWidth={1.2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity={entered ? 0.7 : 0} style={{ transition: `opacity .5s ${i * 80}ms` }} />
          );
        })}
      </svg>
      {edges.map(([a, b], i) => {
        const A = by[a];
        const B = by[b];
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2 - 14 * (i % 2 ? 1 : -1);
        // point on the quadratic curve at t = 0.5
        const qx = 0.25 * A.x + 0.5 * mx + 0.25 * B.x;
        const qy = 0.25 * A.y + 0.5 * my + 0.25 * B.y;
        return <span key={`j${i}`} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 bg-ink" style={{ left: `${qx}%`, top: `${qy}%` }} aria-hidden />;
      })}
      {nodes.map((n, i) => (
        <div
          key={n.id}
          className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 items-baseline gap-1.5 rounded-[var(--radius-cta)] px-3.5 py-2 transition-all duration-500", NODE[n.tone ?? "white"], entered ? "scale-100 opacity-100" : "scale-90 opacity-0")}
          style={{ left: `${n.x}%`, top: `${n.y}%`, transitionDelay: `${i * 70}ms` }}
        >
          <span className="font-display text-base">{n.label}</span>
          {n.count !== undefined ? <span className="text-xs font-semibold tabular-nums opacity-80">{fmt(n.count)}</span> : null}
        </div>
      ))}
    </div>
  );
}
