import { describe, expect, it } from "vitest";
import { applyOps, commit, createHistory, DesignOpError, findLayer, redo, resolvePaint, undo } from "../../shared/design/ops";
import { newDesign, TEMPLATES, templatePage } from "../../shared/design/templates";
import { FORMATS, type TextLayer } from "../../shared/design/types";

describe("design documents", () => {
  it("builds every template in every format inside the canvas", () => {
    for (const t of TEMPLATES) {
      for (const format of Object.keys(FORMATS) as (keyof typeof FORMATS)[]) {
        const page = templatePage(t.id, format);
        const f = FORMATS[format];
        for (const l of page.layers) {
          expect(l.x).toBeGreaterThanOrEqual(0);
          expect(l.y).toBeGreaterThanOrEqual(0);
          expect(l.x + l.width).toBeLessThanOrEqual(f.width + 1);
          expect(l.y + l.height).toBeLessThanOrEqual(f.height + 1);
        }
      }
    }
  });

  it("applies edit operations immutably and supports undo/redo", () => {
    const doc = newDesign("instagram_portrait", "bold_statement");
    const page = doc.pages[0];
    const headline = page.layers.find((l) => l.slot === "headline") as TextLayer;
    const next = applyOps(doc, [{ op: "update_layer", pageId: page.id, layerId: headline.id, props: { text: "Fewer questions, more bookings" } }]);
    expect((findLayer(next.pages[0].layers, headline.id) as TextLayer).text).toBe("Fewer questions, more bookings");
    expect((findLayer(doc.pages[0].layers, headline.id) as TextLayer).text).not.toBe("Fewer questions, more bookings");
    let h = commit(createHistory(doc), next);
    h = undo(h);
    expect(h.present).toBe(doc);
    h = redo(h);
    expect(h.present).toBe(next);
  });

  it("groups, ungroups, reorders and guards pages", () => {
    const doc = newDesign("instagram_square", "split");
    const p = doc.pages[0];
    const [a, b] = p.layers;
    const grouped = applyOps(doc, [{ op: "group", pageId: p.id, layerIds: [a.id, b.id], groupId: "g1" }]);
    expect(grouped.pages[0].layers.find((l) => l.id === "g1")?.type).toBe("group");
    const ungrouped = applyOps(grouped, [{ op: "ungroup", pageId: p.id, groupId: "g1" }]);
    expect(ungrouped.pages[0].layers.map((l) => l.id)).toEqual(p.layers.map((l) => l.id));
    expect(() => applyOps(doc, [{ op: "remove_page", pageId: p.id }])).toThrow(DesignOpError);
  });

  it("makes carousels and resolves brand paints", () => {
    const doc = newDesign("instagram_portrait", "bold_statement", undefined, 3);
    expect(doc.pages).toHaveLength(5);
    expect(resolvePaint("brand:primary", doc.brand)).toBe(doc.brand.colors.primary);
    expect(resolvePaint("#ff0000", doc.brand)).toBe("#ff0000");
  });
});
