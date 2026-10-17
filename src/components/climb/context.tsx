"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Climb AI screen context. Any element can describe itself to the agent with
 * `{...climbTarget(type, id, label)}`; Climb AI reads those (plus the page's
 * visible text) to understand the screen, and point mode lets the owner pick
 * them (or any other element) as context for a question or command.
 */

export interface ClimbEntity {
  type: string;
  id: string;
  label: string;
}

/** Spread on an element to make it a semantic Climb AI target. */
export function climbTarget(type: string, id: string, label: string) {
  return { "data-climb": JSON.stringify({ type, id, label: label.slice(0, 160) }) } as const;
}

export function parseTarget(el: Element | null): ClimbEntity | null {
  const raw = el?.getAttribute("data-climb");
  if (!raw) return null;
  try {
    const e = JSON.parse(raw) as ClimbEntity;
    return e.type && e.id ? e : null;
  } catch {
    return null;
  }
}

/** Everything describable on the current screen (for the agent and the keyboard picker). */
export function screenEntities(): ClimbEntity[] {
  if (typeof document === "undefined") return [];
  const seen = new Set<string>();
  const out: ClimbEntity[] = [];
  for (const el of Array.from(document.querySelectorAll("main [data-climb]"))) {
    const e = parseTarget(el);
    if (e && !seen.has(`${e.type}:${e.id}`)) {
      seen.add(`${e.type}:${e.id}`);
      out.push(e);
    }
  }
  return out.slice(0, 60);
}

/** The page's visible text, compacted (fallback understanding of any screen). */
export function screenSummary(): string {
  if (typeof document === "undefined") return "";
  const main = document.querySelector("main");
  const text = (main as HTMLElement | null)?.innerText ?? "";
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").slice(0, 4000);
}

/** Find an element on screen by entity id (semantic or a picked element's ref). */
export function findTarget(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const el of Array.from(document.querySelectorAll("[data-climb]"))) {
    if (parseTarget(el)?.id === id) return el as HTMLElement;
  }
  return document.querySelector(`[data-climb-ref="${CSS.escape(id)}"]`);
}

interface ClimbState {
  open: boolean;
  setOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  pointing: boolean;
  setPointing: (v: boolean) => void;
  selection: ClimbEntity[];
  addSelection: (e: ClimbEntity) => void;
  removeSelection: (id: string) => void;
  clearSelection: () => void;
  /** Text queued for the composer (e.g. from a "Ask Climb AI about this" button). */
  draft: string;
  setDraft: (t: string) => void;
  /** Briefly ring an element on screen. */
  flash: (id: string, note?: string) => void;
  flashed: { id: string; note?: string; at: number } | null;
}

const Ctx = createContext<ClimbState | null>(null);

export function ClimbProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [pointing, setPointing] = useState(false);
  const [selection, setSelection] = useState<ClimbEntity[]>([]);
  const [draft, setDraft] = useState("");
  const [flashed, setFlashed] = useState<ClimbState["flashed"]>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // Remember whether the panel was open (per browser).
    if (loaded.current) return;
    loaded.current = true;
    try {
      const wanted = new URLSearchParams(window.location.search).get("climb") === "open";
      if (wanted || localStorage.getItem("climb:open") === "1") queueMicrotask(() => setOpenState(true));
    } catch {
      // storage unavailable
    }
  }, []);

  const setOpen = useCallback((v: boolean | ((o: boolean) => boolean)) => {
    setOpenState((o) => {
      const next = typeof v === "function" ? v(o) : v;
      try {
        localStorage.setItem("climb:open", next ? "1" : "0");
      } catch {
        // storage unavailable
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setOpen(true);
        setPointing(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const value = useMemo<ClimbState>(
    () => ({
      open,
      setOpen,
      pointing,
      setPointing,
      selection,
      addSelection: (e) => setSelection((s) => (s.some((x) => x.id === e.id) ? s : [...s, e].slice(-6))),
      removeSelection: (id) => setSelection((s) => s.filter((x) => x.id !== id)),
      clearSelection: () => setSelection([]),
      draft,
      setDraft,
      flash: (id, note) => setFlashed({ id, note, at: Date.now() }),
      flashed,
    }),
    [open, setOpen, pointing, selection, draft, flashed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClimb(): ClimbState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useClimb must be used inside ClimbProvider");
  return c;
}

/** Optional: a hook for components outside the provider (renders nothing then). */
export function useClimbMaybe(): ClimbState | null {
  return useContext(Ctx);
}
