import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarDaySelect, CalendarLimitNotice } from "../../src/components/app/content/ContentCalendar";

describe("content calendar day selection", () => {
  it("keeps a full-date, touch-sized selection control available below desktop width", () => {
    const html = renderToStaticMarkup(createElement(CalendarDaySelect, {
      day: new Date(Date.UTC(2026, 9, 25, 12)),
      onSelect: vi.fn(),
    }));

    expect(html).toContain('aria-label="View Sunday, October 25"');
    expect(html).toContain("min-h-11 min-w-11");
    expect(html).toContain('md:hidden">Sunday, October 25</span>');
    expect(html).toContain("hidden md:inline");
    expect(html).toContain("25</span>");
  });

  it("warns owners when a calendar query reaches either source limit", () => {
    const scheduled = renderToStaticMarkup(createElement(CalendarLimitNotice, {
      limitsReached: { scheduledPosts: true, autopilotSlots: false },
    }));
    const autopilot = renderToStaticMarkup(createElement(CalendarLimitNotice, {
      limitsReached: { scheduledPosts: false, autopilotSlots: true },
    }));

    expect(scheduled).toContain("300-item limit for scheduled posts");
    expect(scheduled).toContain("may be incomplete");
    expect(autopilot).toContain("300-item limit for Autopilot slots");
  });
});
