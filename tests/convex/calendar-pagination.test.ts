import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaginationResult } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { mergeCalendarItems, type CalendarItem } from "../../shared/contentCalendar";
import { asNewUser, setup, type T } from "./helpers";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 19, 8);

async function workspace(t: T, email = "calendar-pages@example.com") {
  const user = await asNewUser(t, email);
  const { slug, orgId } = await user.client.mutation(api.orgs.createWorkspace, { businessName: "Calendar Co" });
  const businessId = await t.run(async (ctx) => (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).unique())!._id);
  return { ...user, slug, orgId, businessId };
}

type Workspace = Awaited<ReturnType<typeof workspace>>;
type Source = "scheduled" | "autopilot" | "review";

async function allPages(w: Workspace, source: Source, from = NOW, to = NOW + DAY) {
  let cursor: string | null = null;
  const items: CalendarItem[] = [];
  let calls = 0;
  for (;;) {
    const result: PaginationResult<CalendarItem> = await w.client.query(api.content.calendarPage, { slug: w.slug, from, to, source, paginationOpts: { cursor, numItems: 100 } });
    items.push(...result.page);
    calls++;
    if (result.isDone) return { items, calls };
    if (calls > 20) throw new Error("Calendar cursor did not reach the end");
    cursor = result.continueCursor;
  }
}

async function addPosts(t: T, w: Workspace, count: number, scheduledFor?: number) {
  return t.run(async (ctx) => {
    const ids: Id<"artifacts">[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(await ctx.db.insert("artifacts", {
        orgId: w.orgId, businessId: w.businessId, kind: "social_post", channel: "facebook",
        title: `Post ${i}`, status: scheduledFor === undefined ? "in_review" : "scheduled",
        currentVersion: 1, scheduledFor, createdAt: Date.now(), updatedAt: Date.now(),
      }));
    }
    return ids;
  });
}

async function addSlots(t: T, w: Workspace, ids: Id<"artifacts">[], slotAt: number, status: "scheduled" | "skipped" = "scheduled") {
  await t.run(async (ctx) => {
    for (const artifactId of ids) await ctx.db.insert("calendarSlots", {
      orgId: w.orgId, weekOf: "2026-10-19", channel: "facebook", day: 1, slotAt,
      pillar: "Test", purpose: "education", format: "text", idea: "Own workspace idea",
      angle: "Example", hookDraft: "Read this", callToAction: "Learn", needsOwner: false,
      status, artifactId, createdAt: NOW, updatedAt: NOW,
    });
  });
}

describe("complete paginated content calendar", () => {
  afterEach(() => vi.useRealTimers());

  it("reaches every scheduled post and slot beyond 300 without duplicate linked entries or actions", async () => {
    const t = setup();
    const w = await workspace(t);
    const ids = await addPosts(t, w, 351, NOW + 60_000);
    await addSlots(t, w, ids, NOW + 60_000);
    const scheduled = await allPages(w, "scheduled");
    const slots = await allPages(w, "autopilot");
    expect(scheduled.calls).toBeGreaterThan(3);
    expect(slots.calls).toBeGreaterThan(3);
    expect(scheduled.items).toHaveLength(351);
    expect(slots.items).toHaveLength(351);
    const items = mergeCalendarItems(scheduled.items, slots.items);
    expect(items).toHaveLength(351);
    expect(new Set(items.map((item) => item.artifactId))).toEqual(new Set(ids));
    expect(items.every((item) => item.autopilot)).toBe(true);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("approvals").collect()).toHaveLength(0);
      expect(await ctx.db.query("actionReceipts").collect()).toHaveLength(0);
      expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(0);
      expect((await ctx.db.get(ids[0]))?.status).toBe("scheduled");
    });
  });

  it("finds all older review drafts even when more than 300 newer drafts are outside the range", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const t = setup();
    const w = await workspace(t);
    const oldIds = await addPosts(t, w, 351);
    vi.setSystemTime(NOW + 5 * DAY);
    await addPosts(t, w, 351);
    const result = await allPages(w, "review", NOW - 1, NOW + DAY);
    expect(result.items).toHaveLength(351);
    expect(new Set(result.items.map((item) => item.artifactId))).toEqual(new Set(oldIds));
    expect(result.items.every((item) => item.unscheduled)).toBe(true);
    const legacy = await w.client.query(api.content.calendar, { slug: w.slug, from: NOW - 1, to: NOW + DAY });
    expect(legacy.items).toHaveLength(300);
    expect(legacy.limitsReached.awaitingReview).toBe(true);
  });

  it("continues after an empty filtered page and ignores skipped and moved slots", async () => {
    const t = setup();
    const w = await workspace(t);
    const ids = await addPosts(t, w, 101, NOW + 60_000);
    await addSlots(t, w, ids.slice(0, 100), NOW + 60_000, "skipped");
    await addSlots(t, w, ids.slice(100), NOW + 120_000);
    const first = await w.client.query(api.content.calendarPage, { slug: w.slug, from: NOW, to: NOW + DAY, source: "autopilot", paginationOpts: { cursor: null, numItems: 100 } });
    expect(first.page).toHaveLength(0);
    expect(first.isDone).toBe(false);
    expect((await allPages(w, "autopilot")).items.map((item) => item.artifactId)).toEqual([ids[100]]);
    await t.run(async (ctx) => ctx.db.patch(ids[100], { scheduledFor: NOW + 2 * DAY }));
    expect((await allPages(w, "autopilot")).items).toHaveLength(0);
    expect((await allPages(w, "scheduled", NOW + 2 * DAY, NOW + 3 * DAY)).items.map((item) => item.artifactId)).toEqual([ids[100]]);
  });

  it("enforces tenant access for each source and never follows a foreign artifact link", async () => {
    const t = setup();
    const alice = await workspace(t);
    const bob = await workspace(t, "calendar-bob@example.com");
    const [privateId] = await addPosts(t, alice, 1, NOW + 60_000);
    await addSlots(t, bob, [privateId], NOW + 60_000);
    for (const source of ["scheduled", "review", "autopilot"] as const) {
      await expect(bob.client.query(api.content.calendarPage, { slug: alice.slug, from: NOW, to: NOW + DAY, source, paginationOpts: { cursor: null, numItems: 100 } })).rejects.toThrow(/couldn't find/);
    }
    const own = await allPages(bob, "autopilot");
    expect(own.items).toHaveLength(1);
    expect(own.items[0]).toMatchObject({ artifactId: null, title: "Own workspace idea" });
    expect((await allPages(bob, "scheduled")).items).toHaveLength(0);
  });

  it("uses half-open ranges and rejects invalid or unbounded requests", async () => {
    const t = setup();
    const w = await workspace(t);
    const [atStart] = await addPosts(t, w, 1, NOW);
    const [atEnd] = await addPosts(t, w, 1, NOW + DAY);
    expect((await allPages(w, "scheduled")).items.map((item) => item.artifactId)).toEqual([atStart]);
    expect((await allPages(w, "scheduled", NOW + DAY, NOW + 2 * DAY)).items.map((item) => item.artifactId)).toEqual([atEnd]);
    for (const [from, to] of [[NOW, NOW], [NOW, NOW - 1], [NOW, NOW + 63 * DAY], [NOW, Infinity]]) {
      await expect(w.client.query(api.content.calendarPage, { slug: w.slug, from, to, source: "scheduled", paginationOpts: { cursor: null, numItems: 100 } })).rejects.toThrow(/date range/);
    }
  });
});
