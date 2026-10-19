"use client";

/*
 * Shape views (Signal).
 * - RadarChart: several measures on spokes; this period vs a grey comparison.
 * - Treemap: squarified tiles, area = value, colour = group.
 * - SankeyDiagram: flows between stages (sources → replies → outcomes).
 * Each is one tab stop with arrow keys, a tooltip and a hidden data table.
 */
import { useMemo, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { fmt, r2, useEntered } from "@/components/analytics/shared";
import { CHART, ChartTooltip, PALETTE, focusRing, useKeyNav, type ChartTip, SrTable } from "./core";
import { ChartLegend } from "./controls";

/* ---------------- Radar ---------------- */

export interface RadarSeries {
  key: string;
  label: string;
  values: number[];
  color?: string;
  dashed?: boolean;
}

const RW = 360;
const RH = 300;
const RC: [number, number] = [180, 150];
const RR = 104;

export function RadarChart({ axes, series, max = 100, label, format = fmt, svgRef }: { axes: string[]; series: RadarSeries[]; max?: number; label: string; format?: (n: number) => string; svgRef?: RefObject<SVGSVGElement | null> }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const n = axes.length;
  const step = (Math.PI * 2) / n;
  const ang = (i: number) => -Math.PI / 2 + i * step;
  const pt = (i: number, r: number): [number, number] => [r2(RC[0] + Math.cos(ang(i)) * r), r2(RC[1] + Math.sin(ang(i)) * r)];
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, (Math.min(v, max) / max) * RR).join(",")).join(" ");
  const colors = series.map((s, i) => s.color ?? PALETTE[i % PALETTE.length]);
  const nav = useKeyNav(n);
  const a = nav.active;
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: (pt(a, RR * 0.6)[0] / RW) * 100,
          y: (Math.min(...series.map((s) => pt(a, (s.values[a] / max) * RR)[1])) / RH) * 100,
          title: axes[a],
          rows: series.map((s, si) => ({ label: s.label, value: `${format(s.values[a])} / ${max}`, color: colors[si], shape: "dot" as const, strong: si === 0 })),
        };
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div role="group" tabIndex={0} aria-label={`${label}. Arrow keys read each measure.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} onMouseLeave={nav.onMouseLeave} className={cn("relative mx-auto w-full max-w-md rounded-[2px]", focusRing)}>
        <svg ref={svgRef} viewBox={`0 0 ${RW} ${RH}`} className="w-full overflow-visible" aria-hidden>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <polygon key={t} points={axes.map((_, i) => pt(i, RR * t).join(",")).join(" ")} fill="none" stroke="var(--line-strong)" strokeDasharray={t === 1 ? undefined : "3 4"} />
          ))}
          {[0.5, 1].map((t) => (
            <text key={t} x={RC[0] + 4} y={r2(RC[1] - RR * t - 3)} fontSize={9} fill="var(--ink-3)">{Math.round(max * t)}</text>
          ))}
          {axes.map((ax, i) => {
            const [x2, y2] = pt(i, RR);
            const [lx, ly] = pt(i, RR + 16);
            const c = Math.cos(ang(i));
            const s = Math.sin(ang(i));
            return (
              <g key={ax}>
                <line x1={RC[0]} y1={RC[1]} x2={x2} y2={y2} stroke={a === i ? "var(--ink)" : "var(--line-strong)"} strokeWidth={a === i ? 1.5 : 1} />
                <text x={lx} y={ly} fontSize={11} fill={a === i ? "var(--ink)" : "var(--ink-2)"} fontWeight={a === i ? 600 : 400} textAnchor={c > 0.25 ? "start" : c < -0.25 ? "end" : "middle"} dominantBaseline={s < -0.5 ? "auto" : s > 0.5 ? "hanging" : "middle"}>
                  {ax}
                </text>
              </g>
            );
          })}
          <g style={{ transform: entered ? "scale(1)" : "scale(0.2)", transformOrigin: `${RC[0]}px ${RC[1]}px`, opacity: entered ? 1 : 0, transition: "transform .7s cubic-bezier(.2,.7,.2,1), opacity .4s" }}>
            {[...series].reverse().map((s) => {
              const si = series.indexOf(s);
              return (
                <g key={s.key}>
                  <polygon points={poly(s.values)} fill={colors[si]} fillOpacity={si === 0 ? 0.16 : 0.06} stroke={colors[si]} strokeWidth={si === 0 ? 2 : 1.5} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" />
                  {s.values.map((v, i) => {
                    const [x, y] = pt(i, (Math.min(v, max) / max) * RR);
                    return <circle key={i} cx={x} cy={y} r={a === i ? 4.5 : si === 0 ? 3 : 2.5} fill={colors[si]} stroke="var(--surface)" strokeWidth={1.5} />;
                  })}
                </g>
              );
            })}
          </g>
          {axes.map((ax, i) => {
            const p1 = pt(i - 0.5, RR + 26);
            const p2 = pt(i, RR + 30);
            const p3 = pt(i + 0.5, RR + 26);
            return <polygon key={`hit-${ax}`} points={`${RC.join(",")} ${p1.join(",")} ${p2.join(",")} ${p3.join(",")}`} fill="transparent" onMouseEnter={() => nav.setActive(i)} />;
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
      <ChartLegend label={label} items={series.map((s, i) => ({ key: s.key, label: s.label, color: colors[i], shape: s.dashed ? "dashed" : "line" }))} className="justify-center" />
      <SrTable caption={label} columns={["Measure", ...series.map((s) => s.label)]} rows={axes.map((ax, i) => [ax, ...series.map((s) => s.values[i])])} />
    </div>
  );
}

/* ---------------- Treemap ---------------- */

export interface TreeItem {
  label: string;
  value: number;
  group?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap layout (Bruls et al.), values already sorted descending. */
export function squarify(values: number[], box: Rect): Rect[] {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const areas = values.map((v) => (v / total) * box.w * box.h);
  const out: Rect[] = [];
  let rect = { ...box };
  let row: number[] = [];
  const worst = (r: number[], side: number) => {
    const s = r.reduce((t, v) => t + v, 0);
    const mx = Math.max(...r);
    const mn = Math.min(...r);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const lay = (r: number[]) => {
    const s = r.reduce((t, v) => t + v, 0);
    if (rect.w >= rect.h) {
      const w = s / rect.h;
      let y = rect.y;
      r.forEach((v) => {
        out.push({ x: rect.x, y, w, h: v / w });
        y += v / w;
      });
      rect = { x: rect.x + w, y: rect.y, w: rect.w - w, h: rect.h };
    } else {
      const h = s / rect.w;
      let x = rect.x;
      r.forEach((v) => {
        out.push({ x, y: rect.y, w: v / h, h });
        x += v / h;
      });
      rect = { x: rect.x, y: rect.y + h, w: rect.w, h: rect.h - h };
    }
  };
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(rect.w, rect.h);
    const next = areas[i];
    if (!row.length || worst([...row, next], side) <= worst(row, side)) {
      row.push(next);
      i++;
    } else {
      lay(row);
      row = [];
    }
  }
  if (row.length) lay(row);
  return out;
}

export function Treemap({ items, groups = [], format = fmt, unit = "", label }: { items: TreeItem[]; groups?: { key: string; label: string; color?: string }[]; format?: (n: number) => string; unit?: string; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const sorted = useMemo(() => [...items].sort((p, q) => q.value - p.value), [items]);
  const rects = useMemo(() => squarify(sorted.map((s) => s.value), { x: 0, y: 0, w: 150, h: 100 }), [sorted]);
  const total = sorted.reduce((s, v) => s + v.value, 0) || 1;
  const color = (g?: string) => {
    const i = groups.findIndex((x) => x.key === g);
    return i < 0 ? CHART.sage : (groups[i].color ?? PALETTE[i % PALETTE.length]);
  };
  const nav = useKeyNav(sorted.length);
  const a = nav.active;
  const pct = (r: Rect) => ({ left: (r.x / 150) * 100, top: r.y, width: (r.w / 150) * 100, height: r.h });
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: pct(rects[a]).left + pct(rects[a]).width / 2,
          y: pct(rects[a]).top + Math.min(pct(rects[a]).height / 2, 12),
          title: sorted[a].label,
          rows: [{ label: "Value", value: `${format(sorted[a].value)}${unit}`, color: color(sorted[a].group), strong: true }],
          note: `${Math.round((sorted[a].value / total) * 100)}% of total${groups.length ? ` · ${groups.find((g) => g.key === sorted[a].group)?.label ?? ""}` : ""}`,
        };
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div role="group" tabIndex={0} aria-label={`${label}. Arrow keys read each tile, largest first.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} onMouseLeave={nav.onMouseLeave} className={cn("relative aspect-[3/2] w-full rounded-[var(--radius-card)]", focusRing)}>
        {sorted.map((it, i) => {
          const p = pct(rects[i]);
          const big = p.width > 16 && p.height > 16;
          const c = color(it.group);
          const light = c === CHART.previous;
          return (
            <div key={it.label} className="absolute p-px" style={{ left: `${r2(p.left)}%`, top: `${r2(p.top)}%`, width: `${r2(p.width)}%`, height: `${r2(p.height)}%` }} onMouseEnter={() => nav.setActive(i)}>
              <div
                className={cn("flex size-full flex-col justify-between overflow-hidden rounded-[2px] p-2 transition-[opacity,transform] duration-500", light ? "text-ink" : "text-white", entered ? "scale-100 opacity-100" : "scale-95 opacity-0", a !== null && a !== i && "opacity-55", a === i && "outline-2 -outline-offset-2 outline-ink")}
                style={{ background: c, transitionDelay: entered && a === null ? `${i * 40}ms` : "0ms" }}
              >
                {big ? (
                  <>
                    <span className="truncate text-xs font-medium">{it.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{format(it.value)}{unit}</span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        <ChartTooltip tip={tip} />
      </div>
      {groups.length ? <ChartLegend label="Groups" items={groups.map((g) => ({ key: g.key, label: g.label, color: color(g.key) }))} /> : null}
      <SrTable caption={label} columns={["Item", "Value", "Share", ...(groups.length ? ["Group"] : [])]} rows={sorted.map((s) => [s.label, s.value, `${Math.round((s.value / total) * 100)}%`, ...(groups.length ? [groups.find((g) => g.key === s.group)?.label ?? ""] : [])])} />
    </div>
  );
}

/* ---------------- Sankey ---------------- */

export interface SankeyNode {
  id: string;
  label: string;
  column: number;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

const SW = 1000;
const NW = 14;

export function SankeyDiagram({ nodes, links, height = 300, format = fmt, unit = "", label }: { nodes: SankeyNode[]; links: SankeyLink[]; height?: number; format?: (n: number) => string; unit?: string; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const H = height;
  const layout = useMemo(() => {
    const cols = Math.max(...nodes.map((n) => n.column)) + 1;
    const size = (id: string) => Math.max(links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0), links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0));
    const gap = 14;
    const byCol = Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.column === c));
    const k = Math.min(...byCol.map((list) => (H - gap * (list.length - 1)) / (list.reduce((s, n) => s + size(n.id), 0) || 1)));
    const pos: Record<string, { x: number; y: number; h: number; value: number; color: string; label: string; column: number }> = {};
    byCol.forEach((list, c) => {
      const used = list.reduce((s, n) => s + size(n.id) * k, 0) + gap * (list.length - 1);
      let y = (H - used) / 2;
      list.forEach((n, i) => {
        const h = size(n.id) * k;
        pos[n.id] = { x: cols === 1 ? 0 : (c / (cols - 1)) * (SW - NW), y, h, value: size(n.id), color: n.color ?? PALETTE[i % PALETTE.length], label: n.label, column: c };
        y += h + gap;
      });
    });
    const outOff: Record<string, number> = {};
    const inOff: Record<string, number> = {};
    const sortedLinks = [...links].sort((p, q) => pos[p.source].y - pos[q.source].y || pos[p.target].y - pos[q.target].y);
    const paths = sortedLinks.map((l) => {
      const s = pos[l.source];
      const t = pos[l.target];
      const th = l.value * k;
      const y0 = s.y + (outOff[l.source] ?? 0);
      const y1 = t.y + (inOff[l.target] ?? 0);
      outOff[l.source] = (outOff[l.source] ?? 0) + th;
      inOff[l.target] = (inOff[l.target] ?? 0) + th;
      const x0 = s.x + NW;
      const x1 = t.x;
      const xm = (x0 + x1) / 2;
      const d = `M${r2(x0)} ${r2(y0)} C${r2(xm)} ${r2(y0)} ${r2(xm)} ${r2(y1)} ${r2(x1)} ${r2(y1)} L${r2(x1)} ${r2(y1 + th)} C${r2(xm)} ${r2(y1 + th)} ${r2(xm)} ${r2(y0 + th)} ${r2(x0)} ${r2(y0 + th)} Z`;
      return { ...l, d, mx: xm, my: (y0 + y1) / 2 + th / 2, color: s.color };
    });
    return { pos, paths, cols };
  }, [nodes, links, H]);
  const nav = useKeyNav(layout.paths.length);
  const a = nav.active;
  const tip: ChartTip | null =
    a === null
      ? null
      : (() => {
          const l = layout.paths[a];
          const s = layout.pos[l.source];
          const t = layout.pos[l.target];
          return { x: (l.mx / SW) * 100, y: (l.my / H) * 100, title: `${s.label} → ${t.label}`, rows: [{ label: "Flow", value: `${format(l.value)}${unit}`, color: l.color, strong: true }], note: `${Math.round((l.value / (s.value || 1)) * 100)}% of ${s.label}` };
        })();
  return (
    <div ref={ref}>
      {/* Right gutter keeps the last column's labels clear of the middle ones. */}
      <div role="group" tabIndex={0} aria-label={`${label}. Arrow keys read each flow.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} onMouseLeave={nav.onMouseLeave} className={cn("w-full rounded-[2px] pr-24", focusRing)}>
        <div className="relative" style={{ height: H }}>
          <svg aria-hidden viewBox={`0 0 ${SW} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
            {layout.paths.map((l, i) => (
              <path key={`${l.source}-${l.target}`} d={l.d} fill={l.color} fillOpacity={a === i ? 0.55 : a === null ? 0.22 : 0.1} onMouseEnter={() => nav.setActive(i)} style={{ opacity: entered ? 1 : 0, transition: `opacity .5s ${200 + i * 50}ms, fill-opacity .15s` }} />
            ))}
            {Object.entries(layout.pos).map(([id, p]) => (
              <rect key={id} x={r2(p.x)} y={r2(p.y)} width={NW} height={r2(Math.max(1, p.h))} fill={p.color} rx={1.5} style={{ transform: entered ? "scaleY(1)" : "scaleY(0)", transformOrigin: `0 ${r2(p.y + p.h / 2)}px`, transition: `transform .5s ${p.column * 120}ms` }} />
            ))}
          </svg>
          {Object.entries(layout.pos).map(([id, p]) => (
            <span
              key={`l-${id}`}
              aria-hidden
              className="pointer-events-none absolute ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-[2px] bg-surface/85 px-1 leading-tight"
              style={{ left: `${r2(((p.x + NW) / SW) * 100)}%`, top: `${r2(((p.y + p.h / 2) / H) * 100)}%` }}
            >
              <span className="block text-xs font-medium text-ink">{p.label}</span>
              <span className="block text-2xs tabular-nums text-ink-3">{format(p.value)}{unit}</span>
            </span>
          ))}
          <ChartTooltip tip={tip} />
        </div>
      </div>
      <SrTable caption={label} columns={["From", "To", "Flow"]} rows={layout.paths.map((l) => [layout.pos[l.source].label, layout.pos[l.target].label, l.value])} />
    </div>
  );
}
