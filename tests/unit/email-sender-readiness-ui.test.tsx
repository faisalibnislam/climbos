import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { EmailSenderReadiness } from "../../shared/growth/emailReadiness";
const check = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useAction: () => check }));
const { EmailSenderCheck } = await import("../../src/components/app/content/detail/EmailSenderCheck");
const report: EmailSenderReadiness = { domain: "example.com", state: "verified", sourceUrl: "https://api.resend.com/domains/fixture", message: "Provider reports domain setup verified.", checkedAt: Date.UTC(2026, 10, 17) };
it.each(["verified", "setup_required", "unknown"] as const)("shows the %s observation, date and limits without checking or sending on render", state => {
  const html = renderToStaticMarkup(createElement(EmailSenderCheck, { slug: "business", from: "hello@example.com", report: { ...report, state } }));
  expect(html).toContain("Check sender setup");
  expect(html).toContain('type="button"');
  expect(html).toContain("2026-11-17 00:00:00");
  expect(html).toContain("does not verify DMARC");
  expect(html).toContain("No email is sent");
  expect(html).toContain("still needs its own approval");
  expect(check).not.toHaveBeenCalled();
});
it("does not show another sender's successful check", () => {
  const html = renderToStaticMarkup(createElement(EmailSenderCheck, { slug: "business", from: "hello@different.example.com", report }));
  expect(html).not.toContain("Domain setup reported verified");
  expect(html).toContain("has not been checked");
});
it("disables checking until one valid sender is entered", () => {
  const html = renderToStaticMarkup(createElement(EmailSenderCheck, { slug: "business", from: "", report: null }));
  expect(html).toContain("disabled");
  expect(check).not.toHaveBeenCalled();
});

it("explains email content review separately from sending", async () => {
  const { approveConsequence } = await import("../../src/components/app/content/detail/ApprovalPanel");
  const text = approveConsequence({ kind: "email_sequence", channel: "email", current: { version: 3 }, isDemo: false } as never, null);
  expect(text).toContain("Approves email content v3 only");
  expect(text).toContain("separate approval for its sender and audience");
  expect(text).toContain("Nothing is sent now");
  expect(text).not.toContain("can't post");
});
