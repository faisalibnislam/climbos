import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { CalendarItem } from "../../shared/contentCalendar";

type PageState = { results: CalendarItem[]; status: "LoadingFirstPage" | "LoadingMore" | "CanLoadMore" | "Exhausted"; loadMore: ReturnType<typeof vi.fn> };
const mocks = vi.hoisted(() => ({ pages: {} as Record<string, PageState>, query: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: () => "Asia/Dhaka",
  usePaginatedQuery: (_ref: unknown, args: { slug: string; source: string; from: number; to: number }) => {
    mocks.query(args);
    return mocks.pages[args.source];
  },
}));
vi.mock("../../src/components/app/content/shared", async original => ({
  ...await original<typeof import("../../src/components/app/content/shared")>(),
  useNow: () => Date.UTC(2026, 9, 19, 8),
}));
import { ContentCalendar } from "../../src/components/app/content/ContentCalendar";

beforeEach(() => {
  mocks.query.mockClear();
  for (const source of ["scheduled", "autopilot", "review"]) mocks.pages[source] = { results: [], status: "Exhausted", loadMore: vi.fn() };
});

it("keeps load more available for empty filtered pages without declaring the range empty", () => {
  mocks.pages.autopilot.status = "CanLoadMore";
  const html = renderToStaticMarkup(createElement(ContentCalendar, { slug: "calendar-owner" }));
  expect(html).toContain("Load more calendar items");
  expect(html).toContain("Showing 0 loaded items");
  expect(html).not.toContain("Nothing scheduled this week");
  expect(html).not.toContain("All items loaded");
  const calls = mocks.query.mock.calls.map(([args]) => args);
  expect(calls).toEqual(["scheduled", "autopilot", "review"].map(source => ({
    slug: "calendar-owner", source,
    from: Date.UTC(2026, 9, 18, 18), to: Date.UTC(2026, 9, 25, 18),
  })));
});

it("renders one linked post with Autopilot state and declares completeness only after every source ends", () => {
  const post: CalendarItem = { id: "post", artifactId: "post", slotId: null, title: "Unique scheduled post", channel: "facebook", status: "scheduled", scheduledFor: Date.UTC(2026, 9, 19, 9), autopilot: false, autopilotStatus: null };
  mocks.pages.scheduled.results = [post];
  mocks.pages.autopilot.results = [{ ...post, slotId: "slot", autopilot: true, autopilotStatus: "scheduled" }];
  const html = renderToStaticMarkup(createElement(ContentCalendar, { slug: "calendar-owner" }));
  expect(html.match(/href="\/app\/calendar-owner\/content\/post"/g)).toHaveLength(1);
  expect(html).toContain("1 item loaded for this week. All items loaded.");
  expect(html).toContain("Autopilot");
  expect(html).not.toContain("Load more calendar items");
  mocks.pages.review.status = "LoadingMore";
  const partial = renderToStaticMarkup(createElement(ContentCalendar, { slug: "calendar-owner" }));
  expect(partial).toContain('aria-busy="true"');
  expect(partial).toContain("Loading more");
  expect(partial).not.toContain("All items loaded");
});
