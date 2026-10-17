"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { findLayer, translateLayer } from "@shared/design/ops";
import type { DesignDoc, Layer, TextLayer } from "@shared/design/types";
import { resolveFont, resolvePaint } from "@shared/design/ops";
import { PageView, type AssetResolver } from "../DesignRenderer";
import { fontStack, nearestWeight } from "../fonts";
import type { Editor } from "./useEditor";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: { h: Handle; sx: -1 | 0 | 1; sy: -1 | 0 | 1; cursor: string }[] = [
  { h: "nw", sx: -1, sy: -1, cursor: "nwse-resize" },
  { h: "n", sx: 0, sy: -1, cursor: "ns-resize" },
  { h: "ne", sx: 1, sy: -1, cursor: "nesw-resize" },
  { h: "e", sx: 1, sy: 0, cursor: "ew-resize" },
  { h: "se", sx: 1, sy: 1, cursor: "nwse-resize" },
  { h: "s", sx: 0, sy: 1, cursor: "ns-resize" },
  { h: "sw", sx: -1, sy: 1, cursor: "nesw-resize" },
  { h: "w", sx: -1, sy: 0, cursor: "ew-resize" },
];

const SNAP_PX = 6;

type Drag =
  | { kind: "move"; start: { x: number; y: number }; originals: Layer[] }
  | { kind: "resize"; start: { x: number; y: number }; original: Layer; sx: number; sy: number; keepAspect: boolean }
  | { kind: "rotate"; original: Layer; center: { x: number; y: number } }
  | { kind: "marquee"; start: { x: number; y: number }; current: { x: number; y: number }; additive: boolean };

function rot(p: { x: number; y: number }, deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
}

export function EditorCanvas({ editor, resolve }: { editor: Editor; resolve: AssetResolver }) {
  const { doc, page, state, dispatch, selectedLayers } = editor;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const drag = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const scale = state.zoom || fitScale;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFitScale(Math.max(0.05, Math.min((r.width - 96) / doc.width, (r.height - 96) / doc.height)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.width, doc.height]);

  const toDesign = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  /** Snap a moving box to page edges/centre and other layers; returns the correction and guides. */
  const snap = (box: { x: number; y: number; width: number; height: number }, movingIds: string[]) => {
    const tol = SNAP_PX / scale;
    const xs = [0, doc.width / 2, doc.width];
    const ys = [0, doc.height / 2, doc.height];
    for (const l of page.layers) {
      if (movingIds.includes(l.id) || l.hidden) continue;
      xs.push(l.x, l.x + l.width / 2, l.x + l.width);
      ys.push(l.y, l.y + l.height / 2, l.y + l.height);
    }
    const mx = [box.x, box.x + box.width / 2, box.x + box.width];
    const my = [box.y, box.y + box.height / 2, box.y + box.height];
    let dx = 0;
    let dy = 0;
    let bestX = tol;
    let bestY = tol;
    const gx: number[] = [];
    const gy: number[] = [];
    for (const t of xs)
      for (const m of mx)
        if (Math.abs(t - m) < bestX) {
          bestX = Math.abs(t - m);
          dx = t - m;
        }
    for (const t of ys)
      for (const m of my)
        if (Math.abs(t - m) < bestY) {
          bestY = Math.abs(t - m);
          dy = t - m;
        }
    if (bestX < tol) for (const t of xs) if (mx.some((m) => Math.abs(m + dx - t) < 0.5)) gx.push(t);
    if (bestY < tol) for (const t of ys) if (my.some((m) => Math.abs(m + dy - t) < 0.5)) gy.push(t);
    return { dx, dy, guides: { x: [...new Set(gx)], y: [...new Set(gy)] } };
  };

  const topLevelId = (target: EventTarget | null): string | null => {
    let el = target as HTMLElement | null;
    let found: string | null = null;
    while (el && el !== stageRef.current) {
      if (el.dataset?.layerId) found = el.dataset.layerId;
      el = el.parentElement;
    }
    return found;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (state.editingTextId) return;
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle;
    const p = toDesign(e);
    if (handle && selectedLayers.length === 1) {
      const l = selectedLayers[0];
      if (handle === "rotate") {
        drag.current = { kind: "rotate", original: l, center: { x: l.x + l.width / 2, y: l.y + l.height / 2 } };
      } else {
        const h = HANDLES.find((x) => x.h === handle)!;
        const corner = h.sx !== 0 && h.sy !== 0;
        drag.current = { kind: "resize", start: p, original: l, sx: h.sx, sy: h.sy, keepAspect: corner && (l.type === "image" || l.type === "icon" || l.type === "group") !== e.shiftKey };
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const id = topLevelId(e.target);
    const layer = id ? page.layers.find((l) => l.id === id) : undefined;
    if (!layer || layer.locked) {
      drag.current = { kind: "marquee", start: p, current: p, additive: e.shiftKey };
      if (!e.shiftKey) dispatch({ type: "select", ids: [] });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    let ids = state.selected;
    if (e.shiftKey) ids = ids.includes(layer.id) ? ids.filter((x) => x !== layer.id) : [...ids, layer.id];
    else if (!ids.includes(layer.id)) ids = [layer.id];
    dispatch({ type: "select", ids });
    const originals = ids.map((x) => page.layers.find((l) => l.id === x)).filter((l): l is Layer => Boolean(l && !l.locked));
    drag.current = { kind: "move", start: p, originals };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const replaceLayers = (updated: Layer[]): DesignDoc => {
    const map = new Map(updated.map((l) => [l.id, l]));
    return { ...state.history.present, pages: state.history.present.pages.map((pg) => (pg.id === page.id ? { ...pg, layers: pg.layers.map((l) => map.get(l.id) ?? l) } : pg)) };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toDesign(e);
    if (d.kind === "move") {
      if (!d.originals.length) return;
      let dx = p.x - d.start.x;
      let dy = p.y - d.start.y;
      const xs = d.originals.map((l) => l.x + dx);
      const ys = d.originals.map((l) => l.y + dy);
      const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...d.originals.map((l) => l.x + dx + l.width)) - Math.min(...xs), height: Math.max(...d.originals.map((l) => l.y + dy + l.height)) - Math.min(...ys) };
      if (!e.altKey) {
        const s = snap(box, d.originals.map((l) => l.id));
        dx += s.dx;
        dy += s.dy;
        setGuides(s.guides);
      } else setGuides({ x: [], y: [] });
      dispatch({ type: "preview", doc: replaceLayers(d.originals.map((l) => translateLayer(l, Math.round(dx), Math.round(dy)))) });
    } else if (d.kind === "resize") {
      const o = d.original;
      const local = rot({ x: p.x - d.start.x, y: p.y - d.start.y }, -o.rotation);
      let w = Math.max(8, o.width + d.sx * local.x);
      let h = Math.max(8, o.height + d.sy * local.y);
      if (d.keepAspect) {
        const ratio = o.width / o.height;
        if (Math.abs(w / o.width) > Math.abs(h / o.height)) h = w / ratio;
        else w = h * ratio;
      }
      const shift = rot({ x: (d.sx * (w - o.width)) / 2, y: (d.sy * (h - o.height)) / 2 }, o.rotation);
      const cx = o.x + o.width / 2 + shift.x;
      const cy = o.y + o.height / 2 + shift.y;
      let next: Layer = { ...o, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: Math.round(w), height: Math.round(h) };
      if (o.type === "group") {
        // Scale children proportionally inside the group box.
        const kx = w / o.width;
        const ky = h / o.height;
        next = {
          ...next,
          type: "group",
          children: o.children.map((c) => ({ ...c, x: Math.round(next.x + (c.x - o.x) * kx), y: Math.round(next.y + (c.y - o.y) * ky), width: Math.round(c.width * kx), height: Math.round(c.height * ky) })),
        } as Layer;
      }
      dispatch({ type: "preview", doc: replaceLayers([next]) });
    } else if (d.kind === "rotate") {
      let angle = (Math.atan2(p.y - d.center.y, p.x - d.center.x) * 180) / Math.PI + 90;
      angle = ((angle % 360) + 360) % 360;
      const nearest = Math.round(angle / 15) * 15;
      if (e.shiftKey || Math.abs(angle - nearest) < 4) angle = nearest % 360;
      dispatch({ type: "preview", doc: replaceLayers([{ ...d.original, rotation: Math.round(angle) }]) });
    } else if (d.kind === "marquee") {
      d.current = p;
      setMarquee({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides({ x: [], y: [] });
    if (!d) return;
    if (d.kind === "marquee") {
      const m = { x: Math.min(d.start.x, d.current.x), y: Math.min(d.start.y, d.current.y), x2: Math.max(d.start.x, d.current.x), y2: Math.max(d.start.y, d.current.y) };
      setMarquee(null);
      if (m.x2 - m.x > 4 || m.y2 - m.y > 4) {
        const hits = page.layers.filter((l) => !l.locked && !l.hidden && l.x < m.x2 && l.x + l.width > m.x && l.y < m.y2 && l.y + l.height > m.y).map((l) => l.id);
        dispatch({ type: "select", ids: d.additive ? [...new Set([...state.selected, ...hits])] : hits });
      }
      return;
    }
    dispatch({ type: "commitDraft" });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = topLevelId(e.target);
    const l = id ? page.layers.find((x) => x.id === id) : undefined;
    if (l?.type === "text" && !l.locked) dispatch({ type: "editText", id: l.id });
  };

  const editing = state.editingTextId ? (findLayer(page.layers, state.editingTextId) as TextLayer | undefined) : undefined;
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-auto bg-surface-3/60" onPointerDown={(e) => e.target === wrapRef.current && dispatch({ type: "select", ids: [] })}>
      <div
        ref={stageRef}
        className="relative shrink-0 shadow-lg"
        style={{ width: doc.width * scale, height: doc.height * scale, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          dispatch({ type: "cancelDraft" });
        }}
        onDoubleClick={onDoubleClick}
        role="application"
        aria-label="Design canvas. Click a layer to select it, double-click text to edit."
      >
        {editing ? <style>{`[data-layer-id="${editing.id}"] > * { visibility: hidden; }`}</style> : null}
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: doc.width, height: doc.height, cursor: "default" }}>
          <PageView doc={doc} page={page} resolve={resolve} />
        </div>

        {/* Selection outlines */}
        {selectedLayers.map((l) => (
          <div
            key={l.id}
            className="pointer-events-none absolute"
            style={{
              left: l.x * scale,
              top: l.y * scale,
              width: l.width * scale,
              height: l.height * scale,
              transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
              outline: `2px solid ${l.locked ? "#98a2b3" : "#ff9a4d"}`,
              outlineOffset: 0,
              boxShadow: "0 0 0 3px rgba(255,255,255,0.85)",
            }}
          >
            {single && single.id === l.id && !l.locked && !editing ? (
              <>
                {HANDLES.map((h) => (
                  <span
                    key={h.h}
                    data-handle={h.h}
                    className="pointer-events-auto absolute size-3 rounded-full border-2 border-[#ff9a4d] bg-white shadow"
                    style={{ left: `calc(${(h.sx + 1) * 50}% - 6px)`, top: `calc(${(h.sy + 1) * 50}% - 6px)`, cursor: h.cursor }}
                  />
                ))}
                <span data-handle="rotate" className="pointer-events-auto absolute left-1/2 size-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-white bg-[#ff9a4d] shadow" style={{ top: -28 }} title="Rotate" />
              </>
            ) : null}
          </div>
        ))}

        {/* Snap guides */}
        {guides.x.map((x) => (
          <div key={`gx${x}`} className="pointer-events-none absolute top-0 h-full w-px bg-[#e5483a]" style={{ left: x * scale }} />
        ))}
        {guides.y.map((y) => (
          <div key={`gy${y}`} className="pointer-events-none absolute left-0 h-px w-full bg-[#e5483a]" style={{ top: y * scale }} />
        ))}
        {marquee ? <div className="pointer-events-none absolute border border-[#ff9a4d] bg-[#ff9a4d]/10" style={{ left: marquee.x * scale, top: marquee.y * scale, width: marquee.w * scale, height: marquee.h * scale }} /> : null}

        {editing ? <TextEditor key={editing.id} layer={editing} doc={doc} scale={scale} onDone={(text) => {
          dispatch({ type: "editText", id: null });
          if (text !== editing.text) editor.apply([{ op: "update_layer", pageId: page.id, layerId: editing.id, props: { text } }]);
        }} /> : null}
      </div>
    </div>
  );
}

/** In-place text editing: a textarea styled exactly like the text layer. */
function TextEditor({ layer, doc, scale, onDone }: { layer: TextLayer; doc: DesignDoc; scale: number; onDone: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(layer.text);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const family = resolveFont(layer.fontFamily, doc.brand);
  const style: CSSProperties = {
    position: "absolute",
    left: layer.x * scale,
    top: layer.y * scale,
    width: layer.width * scale,
    height: layer.height * scale,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    fontFamily: fontStack(family),
    fontWeight: nearestWeight(family, layer.fontWeight),
    fontStyle: layer.fontStyle,
    fontSize: layer.fontSize * scale,
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing * scale,
    color: resolvePaint(layer.color, doc.brand),
    textAlign: layer.align,
    textTransform: layer.transform === "uppercase" ? "uppercase" : undefined,
    background: "rgba(255,255,255,0.08)",
    outline: "2px dashed #ff9a4d",
    resize: "none",
    overflow: "hidden",
    padding: layer.background ? layer.background.padding * scale : 0,
    border: 0,
  };
  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDone(value);
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
    />
  );
}
