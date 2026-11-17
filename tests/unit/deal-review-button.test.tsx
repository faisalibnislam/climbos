import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ draft: "", setDraft: vi.fn(), addSelection: vi.fn(), setOpen: vi.fn() }));
vi.mock("../../src/components/climb/context", () => ({ useClimb: () => state }));
const { DealReviewButton } = await import("../../src/components/app/pipeline/DealReviewButton");
afterEach(() => { vi.clearAllMocks(); state.draft = ""; });
it("makes review an explicit editable request, with no effect during render", () => {
  const close = vi.fn();
  const html = renderToStaticMarkup(createElement(DealReviewButton, { id: "deal", name: "Buyer", onPrepared: close }));
  expect(html).toContain("Review next step");
  expect(html).toContain('type="button"');
  expect(html).toContain("Nothing is submitted or sent yet");
  for (const fn of [close, state.setDraft, state.addSelection, state.setOpen]) expect(fn).not.toHaveBeenCalled();
});
it("protects a nearly full unsent question from truncation", () => {
  state.draft = "x".repeat(3900);
  const html = renderToStaticMarkup(createElement(DealReviewButton, { id: "deal", name: "Buyer", onPrepared: vi.fn() }));
  expect(html).toContain("disabled");
  expect(html).toContain("Shorten it before adding this review");
  expect(state.setDraft).not.toHaveBeenCalled();
});
