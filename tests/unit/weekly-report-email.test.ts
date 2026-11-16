import { describe, expect, it } from "vitest";
import { weeklyReportEmail } from "../../convex/lib/emailTemplates";

describe("weekly report competitor source links", () => {
  it("preserves unknown values and escaped evidence limits in both email formats", () => {
    const email = weeklyReportEmail({ orgName: "Example", url: "https://example.com", report: {
      weekStart: Date.UTC(2026, 10, 15, 18), weekEnd: Date.UTC(2026, 10, 22, 18), timezone: "Asia/Dhaka", headline: "Recorded activity", next: [],
      lines: [{ key: "reach", label: "Reach during this period", value: null, change: null, note: "Unknown <not zero>; impressions are separate." }],
    } });
    expect(email.text).toContain("Reach during this period: Unknown");
    expect(email.html).toContain("Unknown &lt;not zero&gt;");
    expect(email.html).not.toContain("Unknown <not zero>");
    expect(email.html).toContain("Nov 16–Nov 22");
  });
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
