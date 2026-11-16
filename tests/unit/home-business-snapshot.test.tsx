import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeBusinessSnapshot } from "../../src/components/app/today/HomeBusinessSnapshot";

const snapshot = {
  from: "2026-09-25",
  to: "2026-10-24",
  timezone: "Asia/Dhaka",
  metrics: [
    { key: "visits" as const, label: "Website visits", definition: "Sessions reported by your analytics.", hasData: true, total: 1250, recordedDays: 28, expectedDays: 30, partial: true, partialReason: "Recorded subtotal from 28 of 30 days. Missing days remain unknown.", sourceName: "Google Analytics 4", freshness: Date.parse("2026-10-24T08:00:00Z"), isFixture: false },
    { key: "signups" as const, label: "Sign-ups", definition: "Key events you confirmed as a sign-up.", hasData: false, total: null, recordedDays: 0, expectedDays: 30, partial: true, partialReason: null, sourceName: null, freshness: null, isFixture: false },
  ],
};

describe("Growth Home business snapshot", () => {
  it("labels source and freshness, and does not display a missing measure as zero", () => {
    const html = renderToStaticMarkup(createElement(HomeBusinessSnapshot, { slug: "demo", snapshot }));

    expect(html).toContain("1,250");
    expect(html).toContain("Google Analytics 4");
    expect(html).toContain("data in 28 reported days");
    expect(html).toContain("Recorded subtotal from 28 of 30 days");
    expect(html).toContain("No data recorded for this measure.");
    expect(html).not.toContain(">0</p>");
    expect(html).toContain("not proof that a campaign caused a change or produced revenue");
  });

  it("offers a data connection instead of displaying unknown values as zero", () => {
    const empty = { ...snapshot, metrics: snapshot.metrics.map((metric) => ({ ...metric, hasData: false, total: null, recordedDays: 0, expectedDays: 30, partial: true, partialReason: null, sourceName: null, freshness: null })) };
    const html = renderToStaticMarkup(createElement(HomeBusinessSnapshot, { slug: "demo", snapshot: empty }));

    expect(html).toContain("No website activity data recorded yet");
    expect(html).toContain("Connect Google Analytics 4");
    expect(html).not.toContain(">0</p>");
  });

  it("marks synthetic metrics as demo data", () => {
    const demo = { ...snapshot, metrics: snapshot.metrics.map((metric) => ({ ...metric, hasData: true, isFixture: true })) };
    const html = renderToStaticMarkup(createElement(HomeBusinessSnapshot, { slug: "demo", snapshot: demo }));
    expect(html).toContain("Demo data");
    expect(html).not.toContain(">Recorded</span>");
  });

  it("explains incompatible totals without showing a fabricated number or a connection-empty state", () => {
    const incompatible = { ...snapshot, metrics: snapshot.metrics.map(metric => ({ ...metric, hasData: true, total: null, partialReason: "Total unavailable: overlapping sources need reconciliation." })) };
    const html = renderToStaticMarkup(createElement(HomeBusinessSnapshot, { slug: "demo", snapshot: incompatible }));
    expect(html).toContain("Total unavailable: overlapping sources");
    expect(html).not.toContain("1,250");
    expect(html).not.toContain("No website activity data recorded yet");
  });
});
