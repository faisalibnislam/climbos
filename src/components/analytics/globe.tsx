"use client";

/*
 * DotGlobe: an interactive 3D dotted globe (orthographic projection, no WebGL).
 * Drag to spin; it drifts slowly on its own (not with reduced motion). Clicking a
 * place, on the globe or in the list beside it, turns the globe to face it. Dotted
 * arcs join each place to home. Places carry pill labels with their lead counts.
 * Flat colour only; the whole thing is one SVG path for the land, cheap to redraw.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LAND, inside, type Place } from "./map-flow";
import { DataTable, fmt, r2 } from "./shared";

const D = Math.PI / 180;
const SIZE = 420;
const R = 196;
const C = SIZE / 2;

interface View {
  lon: number;
  lat: number;
}

function project(lon: number, lat: number, v: View): { x: number; y: number; front: number } {
  const l = (lon - v.lon) * D;
  const p = lat * D;
  const p0 = v.lat * D;
  const front = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return { x: C + R * Math.cos(p) * Math.sin(l), y: C - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), front };
}

/** Points along the great circle between two places. */
function arc(a: Place, b: Place, n = 40): [number, number][] {
  const toV = (lon: number, lat: number) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
  const A = toV(a.lon, a.lat);
  const B = toV(b.lon, b.lat);
  const w = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])) || 1e-6;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const s1 = Math.sin((1 - t) * w) / Math.sin(w);
    const s2 = Math.sin(t * w) / Math.sin(w);
    const P = [s1 * A[0] + s2 * B[0], s1 * A[1] + s2 * B[1], s1 * A[2] + s2 * B[2]];
    return [Math.atan2(P[1], P[0]) / D, Math.asin(Math.max(-1, Math.min(1, P[2]))) / D];
  });
}

export function DotGlobe({ places, home, unit = "leads", stats }: { places: Place[]; home?: Place; unit?: string; stats?: [string, string][] }) {
  const land = useMemo(() => {
    const pts: [number, number][] = [];
    for (let lat = -56; lat <= 80; lat += 2.6) {
      const step = 2.6 / Math.max(0.25, Math.cos(lat * D));
      for (let lon = -180; lon < 180; lon += step) if (LAND.some((p) => inside([lon, lat], p))) pts.push([lon, lat]);
    }
    return pts;
  }, []);
  const max = Math.max(...places.map((p) => p.value)) || 1;
  const [view, setView] = useState<View>({ lon: home ? home.lon + 25 : -40, lat: 22 });
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; v: View } | null>(null);
  const [dragging, setDragging] = useState(false);
  const tween = useRef<number | null>(null);
  const paused = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Slow drift; stops while dragging, hovering or after a selection, and never under reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let t0 = performance.now();
    const tick = (t: number) => {
      const dt = t - t0;
      t0 = t;
      if (!paused.current && !drag.current && tween.current === null) setView((v) => ({ ...v, lon: v.lon - dt * 0.0015 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const focus = useCallback((p: Place) => {
    setSelected(p.label);
    paused.current = true;
    const from = { ...view };
    const dLon = ((p.lon - from.lon + 540) % 360) - 180;
    const to = { lon: from.lon + dLon, lat: Math.max(-50, Math.min(55, p.lat)) };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setView(to);
      return;
    }
    const start = performance.now();
    const run = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      const e = 1 - (1 - k) ** 3;
      setView({ lon: from.lon + (to.lon - from.lon) * e, lat: from.lat + (to.lat - from.lat) * e });
      tween.current = k < 1 ? requestAnimationFrame(run) : null;
    };
    if (tween.current) cancelAnimationFrame(tween.current);
    tween.current = requestAnimationFrame(run);
  }, [view]);

  const landPath = useMemo(() => {
    let d = "";
    for (const [lon, lat] of land) {
      const p = project(lon, lat, view);
      if (p.front <= 0.02) continue;
      const r = 1.1 + 0.9 * p.front;
      d += `M${r2(p.x - r)} ${r2(p.y)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`;
    }
    return d;
  }, [land, view]);

  const arcs = useMemo(
    () =>
      home
        ? places
            .filter((p) => p.label !== home.label)
            .map((p) => {
              const pts = arc(home, p).map(([lo, la]) => project(lo, la, view));
              let d = "";
              let pen = false;
              for (const q of pts) {
                if (q.front > 0) {
                  d += `${pen ? "L" : "M"}${r2(q.x)} ${r2(q.y)}`;
                  pen = true;
                } else pen = false;
              }
              return { label: p.label, d };
            })
        : [],
    [home, places, view],
  );

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, v: view };
    setDragging(true);
    if (tween.current) {
      cancelAnimationFrame(tween.current);
      tween.current = null;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    setView({ lon: g.v.lon - (e.clientX - g.x) * 0.35, lat: Math.max(-60, Math.min(70, g.v.lat + (e.clientY - g.y) * 0.35)) });
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const sel = places.find((p) => p.label === selected);
  return (
    <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
      <div className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none" onPointerEnter={() => (paused.current = true)} onPointerLeave={() => (paused.current = Boolean(selected))}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={cn("size-full", dragging ? "cursor-grabbing" : "cursor-grab")}
          role="img"
          aria-label={`Globe of ${unit} by place: ${places.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}. Drag to rotate.`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <circle cx={C} cy={C} r={R} fill="var(--surface-2)" stroke="var(--line-strong)" />
          {mounted ? <path d={landPath} fill="var(--ink)" fillOpacity={0.4} /> : null}
          {mounted && arcs.map((a) => (
            <path key={a.label} d={a.d} fill="none" stroke={a.label === selected ? "var(--ink)" : "var(--brand-700)"} strokeWidth={a.label === selected ? 1.6 : 1.1} strokeDasharray="2 4" />
          ))}
          {mounted && places.map((p) => {
            const q = project(p.lon, p.lat, view);
            if (q.front <= 0) return null;
            const r = 4 + 7 * Math.sqrt(p.value / max);
            const isSel = p.label === selected;
            return (
              <g key={p.label} className="cursor-pointer" onClick={() => focus(p)} onPointerDown={(e) => e.stopPropagation()}>
                <circle cx={r2(q.x)} cy={r2(q.y)} r={r2(r + 5)} fill={isSel ? "var(--lime)" : "var(--brand-200)"} opacity={0.7} />
                <circle cx={r2(q.x)} cy={r2(q.y)} r={r2(r)} fill={isSel || p.label === home?.label ? "var(--ink)" : "var(--brand-700)"} stroke="var(--surface)" strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        {/* Pill labels (HTML so they stay crisp) */}
        {mounted && places.map((p) => {
          const q = project(p.lon, p.lat, view);
          if (q.front <= 0.15) return null;
          const isSel = p.label === selected;
          return (
            <button
              key={p.label}
              type="button"
              tabIndex={-1}
              onClick={() => focus(p)}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-[var(--radius-cta)] px-2.5 py-1 text-xs shadow-sm transition-opacity",
                isSel ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-line",
              )}
              style={{ left: `${(q.x / SIZE) * 100}%`, top: `${(q.y / SIZE) * 100}%`, opacity: Math.min(1, (q.front - 0.15) * 4) }}
            >
              {p.label} <b className="font-semibold tabular-nums">{fmt(p.value)}</b>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-3">Drag the globe, or pick a place:</p>
        <ul className="flex flex-col gap-1">
          {places
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((p) => (
              <li key={p.label}>
                <button
                  type="button"
                  aria-pressed={p.label === selected}
                  onClick={() => focus(p)}
                  className={cn("flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-ui transition-colors hover:bg-surface-2", p.label === selected && "bg-ink text-white hover:bg-ink")}
                >
                  <span className="min-w-0 flex-1 truncate">{p.label}{p.label === home?.label ? " · home" : ""}</span>
                  <span className="tabular-nums">{fmt(p.value)}</span>
                  <span className={cn("h-1.5 rounded-full", p.label === selected ? "bg-lime" : "bg-brand-700")} style={{ width: `${8 + 32 * (p.value / max)}px` }} />
                </button>
              </li>
            ))}
        </ul>
        {sel ? (
          <p className="rounded-[var(--radius-control)] bg-cream px-3 py-2 text-xs text-ink-2">
            <b className="text-ink">{sel.label}</b>: {fmt(sel.value)} {unit}, {Math.round((sel.value / places.reduce((s, p) => s + p.value, 0)) * 100)}% of all.
          </p>
        ) : null}
        {stats ? (
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-3">
            {stats.map(([v, l]) => (
              <div key={l}><p className="text-base font-semibold tabular-nums">{v}</p><p className="text-2xs text-ink-3">{l}</p></div>
            ))}
          </div>
        ) : null}
      </div>
      <DataTable caption={`${unit} by place`} columns={["Place", unit]} rows={places.map((p) => [p.label, p.value])} />
    </div>
  );
}
