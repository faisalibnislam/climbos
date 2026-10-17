import type { BrandKit, DesignDoc, Fill, Layer, Page } from "./types";

/**
 * Every change to a design is one of these operations: from the editor, from
 * templates and from AI edits. `applyOps` is pure: it returns a new document
 * and never mutates the input, which keeps undo/redo and collaboration simple.
 */
export type DesignOp =
  | { op: "add_layer"; pageId: string; layer: Layer; index?: number }
  | { op: "update_layer"; pageId: string; layerId: string; props: Partial<Layer> }
  | { op: "remove_layer"; pageId: string; layerId: string }
  | { op: "move_layer"; pageId: string; layerId: string; toIndex: number }
  | { op: "set_background"; pageId: string; background: Page["background"] }
  | { op: "add_page"; page: Page; index?: number }
  | { op: "remove_page"; pageId: string }
  | { op: "move_page"; pageId: string; toIndex: number }
  | { op: "update_page"; pageId: string; props: Partial<Pick<Page, "notes">> }
  | { op: "set_brand"; brand: Partial<Omit<BrandKit, "colors" | "fonts">> & { colors?: Partial<BrandKit["colors"]>; fonts?: Partial<BrandKit["fonts"]> } }
  | { op: "group"; pageId: string; layerIds: string[]; groupId: string }
  | { op: "ungroup"; pageId: string; groupId: string };

export class DesignOpError extends Error {}

let counter = 0;
/** Short unique id for layers and pages. */
export function newId(prefix = "l"): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pageIndex(doc: DesignDoc, pageId: string): number {
  const i = doc.pages.findIndex((p) => p.id === pageId);
  if (i < 0) throw new DesignOpError(`No page ${pageId}`);
  return i;
}

/** Find a layer anywhere in a page, including inside groups. */
export function findLayer(layers: Layer[], id: string): Layer | undefined {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.type === "group") {
      const inner = findLayer(l.children, id);
      if (inner) return inner;
    }
  }
  return undefined;
}

function mapLayers(layers: Layer[], id: string, fn: (l: Layer) => Layer | null): Layer[] {
  const out: Layer[] = [];
  for (const l of layers) {
    if (l.id === id) {
      const next = fn(l);
      if (next) out.push(next);
    } else if (l.type === "group") {
      out.push({ ...l, children: mapLayers(l.children, id, fn) });
    } else {
      out.push(l);
    }
  }
  return out;
}

function clampIndex(i: number, len: number) {
  return Math.max(0, Math.min(len, Math.round(i)));
}

function withPage(doc: DesignDoc, pageId: string, fn: (p: Page) => Page): DesignDoc {
  const i = pageIndex(doc, pageId);
  const pages = doc.pages.slice();
  pages[i] = fn(pages[i]);
  return { ...doc, pages };
}

/** Bounding box of several layers (unrotated), in design pixels. */
export function boundsOf(layers: Layer[]): { x: number; y: number; width: number; height: number } {
  if (!layers.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x1 = Math.min(...layers.map((l) => l.x));
  const y1 = Math.min(...layers.map((l) => l.y));
  const x2 = Math.max(...layers.map((l) => l.x + l.width));
  const y2 = Math.max(...layers.map((l) => l.y + l.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function applyOp(doc: DesignDoc, o: DesignOp): DesignDoc {
  switch (o.op) {
    case "add_layer":
      return withPage(doc, o.pageId, (p) => {
        if (findLayer(p.layers, o.layer.id)) throw new DesignOpError(`Layer ${o.layer.id} already exists`);
        const layers = p.layers.slice();
        layers.splice(clampIndex(o.index ?? layers.length, layers.length), 0, o.layer);
        return { ...p, layers };
      });
    case "update_layer":
      return withPage(doc, o.pageId, (p) => {
        if (!findLayer(p.layers, o.layerId)) throw new DesignOpError(`No layer ${o.layerId}`);
        // id and type are immutable.
        const { id: _id, type: _type, ...props } = o.props as Record<string, unknown>;
        return { ...p, layers: mapLayers(p.layers, o.layerId, (l) => ({ ...l, ...props }) as Layer) };
      });
    case "remove_layer":
      return withPage(doc, o.pageId, (p) => {
        if (!findLayer(p.layers, o.layerId)) throw new DesignOpError(`No layer ${o.layerId}`);
        return { ...p, layers: mapLayers(p.layers, o.layerId, () => null) };
      });
    case "move_layer":
      return withPage(doc, o.pageId, (p) => {
        const from = p.layers.findIndex((l) => l.id === o.layerId);
        if (from < 0) throw new DesignOpError(`Layer ${o.layerId} is not a top-level layer`);
        const layers = p.layers.slice();
        const [l] = layers.splice(from, 1);
        layers.splice(clampIndex(o.toIndex, layers.length), 0, l);
        return { ...p, layers };
      });
    case "set_background":
      return withPage(doc, o.pageId, (p) => ({ ...p, background: o.background }));
    case "add_page": {
      if (doc.pages.some((p) => p.id === o.page.id)) throw new DesignOpError(`Page ${o.page.id} already exists`);
      if (doc.pages.length >= 20) throw new DesignOpError("A design can have at most 20 pages.");
      const pages = doc.pages.slice();
      pages.splice(clampIndex(o.index ?? pages.length, pages.length), 0, o.page);
      return { ...doc, pages };
    }
    case "remove_page": {
      if (doc.pages.length <= 1) throw new DesignOpError("A design needs at least one page.");
      pageIndex(doc, o.pageId);
      return { ...doc, pages: doc.pages.filter((p) => p.id !== o.pageId) };
    }
    case "move_page": {
      const from = pageIndex(doc, o.pageId);
      const pages = doc.pages.slice();
      const [p] = pages.splice(from, 1);
      pages.splice(clampIndex(o.toIndex, pages.length), 0, p);
      return { ...doc, pages };
    }
    case "update_page":
      return withPage(doc, o.pageId, (p) => ({ ...p, ...o.props }));
    case "set_brand":
      return {
        ...doc,
        brand: {
          ...doc.brand,
          ...o.brand,
          colors: { ...doc.brand.colors, ...o.brand.colors },
          fonts: { ...doc.brand.fonts, ...o.brand.fonts },
        },
      };
    case "group":
      return withPage(doc, o.pageId, (p) => {
        const members = p.layers.filter((l) => o.layerIds.includes(l.id));
        if (members.length < 2) throw new DesignOpError("Select at least two top-level layers to group.");
        const b = boundsOf(members);
        const firstIndex = p.layers.findIndex((l) => o.layerIds.includes(l.id));
        const group: Layer = {
          id: o.groupId,
          type: "group",
          ...b,
          rotation: 0,
          opacity: 1,
          // Children keep absolute coordinates; the group box is their bounds.
          children: members,
        };
        const rest = p.layers.filter((l) => !o.layerIds.includes(l.id));
        rest.splice(Math.min(firstIndex, rest.length), 0, group);
        return { ...p, layers: rest };
      });
    case "ungroup":
      return withPage(doc, o.pageId, (p) => {
        const i = p.layers.findIndex((l) => l.id === o.groupId);
        const g = p.layers[i];
        if (!g || g.type !== "group") throw new DesignOpError(`No group ${o.groupId}`);
        const layers = p.layers.slice();
        layers.splice(i, 1, ...g.children);
        return { ...p, layers };
      });
  }
}

export function applyOps(doc: DesignDoc, ops: DesignOp[]): DesignDoc {
  return ops.reduce(applyOp, doc);
}

/** Move a group and everything inside it by (dx, dy). Groups keep absolute child coordinates. */
export function translateLayer(l: Layer, dx: number, dy: number): Layer {
  if (l.type === "group") return { ...l, x: l.x + dx, y: l.y + dy, children: l.children.map((c) => translateLayer(c, dx, dy)) };
  return { ...l, x: l.x + dx, y: l.y + dy };
}

/** Resolve "brand:primary"-style paints against the brand kit. */
export function resolvePaint(paint: string | undefined, brand: BrandKit): string {
  if (!paint) return "transparent";
  if (paint.startsWith("brand:")) {
    const slot = paint.slice(6) as keyof BrandKit["colors"];
    return brand.colors[slot] ?? "#000000";
  }
  return paint;
}

export function resolveFont(font: string, brand: BrandKit): string {
  if (font === "brand:heading") return brand.fonts.heading;
  if (font === "brand:body") return brand.fonts.body;
  return font;
}

export function solid(color: string): Fill {
  return { kind: "solid", color };
}

/* ---------------- History (undo/redo) ---------------- */

export interface History {
  past: DesignDoc[];
  present: DesignDoc;
  future: DesignDoc[];
}

const HISTORY_LIMIT = 100;

export function createHistory(doc: DesignDoc): History {
  return { past: [], present: doc, future: [] };
}

/** Commit a new state (e.g. after a drag ends). No-op if nothing changed. */
export function commit(h: History, next: DesignDoc): History {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}
