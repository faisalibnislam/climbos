import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarDaySelect, CalendarLoadMore } from "../../src/components/app/content/ContentCalendar";
import { mergeCalendarItems, type CalendarItem } from "../../shared/contentCalendar";

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

  it("offers more pages without claiming a partial count is the full calendar", () => {
    const available = renderToStaticMarkup(createElement(CalendarLoadMore, {
      total: 100, hasMore: true, loading: false, onMore: vi.fn(),
    }));
    const loading = renderToStaticMarkup(createElement(CalendarLoadMore, {
      total: 100, hasMore: true, loading: true, onMore: vi.fn(),
    }));
    expect(available).toContain("Showing 100 loaded items");
    expect(available).toContain("Load more calendar items");
    expect(loading).toContain("disabled");
    expect(loading).toContain("Loading more");
    expect(renderToStaticMarkup(createElement(CalendarLoadMore, {
      total: 351, hasMore: false, loading: false, onMore: vi.fn(),
    }))).toBe("");
  });

  it("deduplicates linked posts across pages and keeps Autopilot timing regardless of arrival order", () => {
    const draft: CalendarItem = { id: "post", artifactId: "post", slotId: null, title: "Review me", channel: "facebook", status: "in_review", scheduledFor: 1, autopilot: false, autopilotStatus: null, unscheduled: true };
    const slot: CalendarItem = { ...draft, id: "post", slotId: "slot", scheduledFor: 10, autopilot: true, autopilotStatus: "needs_approval", unscheduled: undefined };
    expect(mergeCalendarItems([draft], [slot], [draft])).toEqual([slot]);
    expect(mergeCalendarItems([slot], [draft])).toEqual([slot]);
    const other = { ...draft, id: "other", artifactId: "other", scheduledFor: 5 };
    expect(mergeCalendarItems([slot], [other])).toEqual([other, slot]);
  });
});
