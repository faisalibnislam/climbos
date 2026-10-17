"use client";

import { useEffect, useRef, useState } from "react";
import { findTarget, parseTarget, useClimb, type ClimbEntity } from "./context";

/** The Climb AI pointer: a pine arrow with a sunrise spark (hotspot at the tip). */
const CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M3 2.5 L3 20 L8 15.5 L11.5 23 L14.6 21.6 L11.2 14.3 L18 14.3 Z' fill='#0b5d46' stroke='white' stroke-width='1.6' stroke-linejoin='round'/><path d='M22 3 L23.2 6.3 L26.5 7.5 L23.2 8.7 L22 12 L20.8 8.7 L17.5 7.5 L20.8 6.3 Z' fill='#ec8b5e' stroke='white' stroke-width='1'/></svg>`,
)}") 3 2, crosshair`;

const TYPE_LABEL: Record<string, string> = {
  draft: "Draft",
  approval: "Waiting for approval",
  play: "Growth play",
  slot: "Planned post",
  image: "Image",
  wish: "Wish",
  chart: "Chart",
  stat: "Number",
  job: "Job",
  plan: "Plan section",
  channel: "Channel",
};

const BLOCKS = "article, li, tr, figure, section, [role='region'], button, a, img, h1, h2, h3, p, dd, td";

function resolve(el: Element | null): { el: HTMLElement; entity: ClimbEntity | null } | null {
  if (!el || el.closest("[data-climb-panel], [data-climb-overlay]")) return null;
  const main = document.querySelector("main");
  if (!main?.contains(el)) return null;
  const semantic = el.closest("[data-climb]");
  if (semantic && main.contains(semantic)) return { el: semantic as HTMLElement, entity: parseTarget(semantic) };
  const block = el.closest(BLOCKS);
  return block && main.contains(block) ? { el: block as HTMLElement, entity: null } : null;
}

function describe(el: HTMLElement): ClimbEntity {
  let ref = el.getAttribute("data-climb-ref");
  if (!ref) {
    ref = `el-${Math.random().toString(36).slice(2, 9)}`;
    el.setAttribute("data-climb-ref", ref);
  }
  const tag = el.tagName.toLowerCase();
  const type = tag === "img" ? "image" : /^h[1-3]$/.test(tag) ? "heading" : tag === "button" || tag === "a" ? "control" : el.querySelector("svg[role='img'], [role='img']") ? "chart" : "text";
  const text = (tag === "img" ? (el as HTMLImageElement).alt : el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  return { type, id: ref, label: text.slice(0, 160) || tag };
}

export function PointOverlay() {
  const climb = useClimb();
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; label: string } | null>(null);
  const hovered = useRef<{ el: HTMLElement; entity: ClimbEntity | null } | null>(null);

  // Point mode: custom cursor, hover outline + label, click to pin.
  useEffect(() => {
    if (!climb.pointing) return;
    const style = document.createElement("style");
    style.setAttribute("data-climb-overlay", "");
    style.textContent = `main, main * { cursor: ${CURSOR} !important; }`;
    document.head.appendChild(style);
    const onMove = (e: PointerEvent) => {
      const hit = resolve(document.elementFromPoint(e.clientX, e.clientY));
      hovered.current = hit;
      if (!hit) return setBox(null);
      const r = hit.el.getBoundingClientRect();
      const label = hit.entity ? `${TYPE_LABEL[hit.entity.type] ?? hit.entity.type} · ${hit.entity.label}` : describe(hit.el).label || "This";
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height, label: label.slice(0, 80) });
    };
    const onClick = (e: MouseEvent) => {
      const hit = hovered.current ?? resolve(e.target as Element);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      climb.addSelection(hit.entity ?? describe(hit.el));
      if (!e.shiftKey) climb.setPointing(false);
    };
    const swallow = (e: Event) => {
      if (resolve(e.target as Element)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") climb.setPointing(false);
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("mousedown", swallow, true);
    window.addEventListener("pointerdown", swallow, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      style.remove();
      setBox(null);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("mousedown", swallow, true);
      window.removeEventListener("pointerdown", swallow, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [climb, climb.pointing]);

  // Agent "highlight": scroll to the element and ring it briefly.
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number; note?: string } | null>(null);
  useEffect(() => {
    if (!climb.flashed) return;
    const el = findTarget(climb.flashed.id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const note = climb.flashed.note;
    const show = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRing({ x: r.left, y: r.top, w: r.width, h: r.height, note });
    }, 350);
    const hide = window.setTimeout(() => setRing(null), 3200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [climb.flashed]);

  return (
    <>
      {climb.pointing ? (
        <div data-climb-overlay className="pointer-events-none fixed inset-x-0 top-14 z-[70] flex justify-center px-4">
          <p className="rounded-lg bg-ink px-3 py-1.5 text-ui text-white shadow-lg">
            Click anything to ask Climb AI about it · <kbd className="font-sans font-medium">Shift</kbd> to pick several · <kbd className="font-sans font-medium">Esc</kbd> to stop
          </p>
        </div>
      ) : null}
      {box ? (
        <div data-climb-overlay aria-hidden className="pointer-events-none fixed z-[69] rounded-lg ring-2 ring-sun-strong transition-all duration-75" style={{ left: box.x - 3, top: box.y - 3, width: box.w + 6, height: box.h + 6, background: "color-mix(in srgb, var(--sun) 8%, transparent)" }}>
          <span className="absolute -top-6 left-0 max-w-80 truncate rounded-md bg-ink px-1.5 py-0.5 text-xs font-medium text-white">{box.label}</span>
        </div>
      ) : null}
      {ring ? (
        <div data-climb-overlay aria-hidden className="pointer-events-none fixed z-[69] animate-soft-pulse rounded-lg ring-[3px] ring-sun-strong" style={{ left: ring.x - 4, top: ring.y - 4, width: ring.w + 8, height: ring.h + 8 }}>
          {ring.note ? <span className="absolute -top-7 left-0 max-w-80 truncate rounded-md bg-ink px-2 py-1 text-xs text-white shadow-lg">{ring.note}</span> : null}
        </div>
      ) : null}
    </>
  );
}
