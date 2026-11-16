import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { ArtifactView } from "../../src/components/app/content/detail/model";
const state = vi.hoisted(() => ({ value: undefined as unknown, check: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => state.value, useAction: () => state.check, useMutation: () => vi.fn() }));
const { EmailSendRecovery } = await import("../../src/components/app/content/detail/EmailSendPanel");
afterEach(() => { state.value = undefined; state.check.mockReset(); });
const artifact = { id: "artifact", status: "draft" } as ArtifactView;
function render(canCheck: boolean, resolving = false) {
  state.value = { omitted: false, items: [{ id: "approval", title: "Send original subject to 1 contact", canCheck, resolving, message: "The result is unknown" }] };
  return renderToStaticMarkup(createElement(EmailSendRecovery, { slug: "business", artifact }));
}
it("shows original-send recovery even after the draft has changed, without invoking an action", () => {
  const html = render(true);
  expect(html).toContain("Check provider result");
  expect(html).toContain("original approved version");
  expect(html).toContain("never sends another email");
  expect(html).toContain('type="button"');
  expect(state.check).not.toHaveBeenCalled();
});
it("keeps legacy or unauthorized attempts visible without an action button", () => {
  const html = render(false);
  expect(html).not.toContain("Check provider result");
  expect(html).toContain("inspect the original Resend account");
});
it("shows accounting in progress separately from missing authorization", () => {
  const html = render(false, true);
  expect(html).toContain("Updating the original contact history");
  expect(html).not.toContain("Automatic checking needs");
});
it("adds no recovery panel when no attempt is unresolved", () => {
  state.value = { omitted: false, items: [] };
  expect(renderToStaticMarkup(createElement(EmailSendRecovery, { slug: "business", artifact }))).toBe("");
});
