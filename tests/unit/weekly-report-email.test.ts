import { describe, expect, it } from "vitest";
import { weeklyReportEmail } from "../../convex/lib/emailTemplates";

describe("weekly report competitor source links", () => {
  it("includes the observed source in text and an escaped link in HTML", () => {
    const email = weeklyReportEmail({
      orgName: "Example Co",
      url: "https://climbos.example/report",
      report: {
        weekStart: Date.UTC(2026, 9, 19),
        weekEnd: Date.UTC(2026, 9, 26),
        headline: "A quiet week.",
        lines: [],
        next: [],
        competitors: [{ name: "Rival", summary: "Changed its price", sourceUrls: ["https://rival.example/pricing?a=1&b=2"] }],
      },
    });
    expect(email.text).toContain("source: https://rival.example/pricing?a=1&b=2");
    expect(email.html).toContain('href="https://rival.example/pricing?a=1&amp;b=2"');
    expect(email.html).toContain(">Source</a>");
  });
});
