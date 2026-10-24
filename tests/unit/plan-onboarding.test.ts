import { describe, expect, it } from "vitest";
import { CLIMB_TOOLS, climbToolDefs, localTime } from "../../convex/lib/climbTools";
import { localWeek, weekStartIn, weekStartUtc } from "../../shared/report/weekly";
import { wishesFrom } from "../../src/components/app/wish/pairing";

describe("wish pairing", () => {
  it("pairs answers by the wish they reply to, even when two wishes are in flight", () => {
    const chat = [
      { id: "a", author: "user" as const, replyTo: null },
      { id: "b", author: "user" as const, replyTo: null },
      { id: "rb", author: "climbos" as const, replyTo: "b" },
      { id: "ra", author: "climbos" as const, replyTo: "a" },
    ];
    const w = wishesFrom(chat);
    expect(w.map((x) => [x.ask.id, x.answer?.id])).toEqual([
      ["b", "rb"],
      ["a", "ra"],
    ]);
  });

  it("falls back to the next message for older answers without a link", () => {
    const w = wishesFrom([
      { id: "a", author: "user" as const, replyTo: null },
      { id: "ra", author: "climbos" as const, replyTo: null },
      { id: "b", author: "user" as const, replyTo: null },
    ]);
    expect(w.map((x) => [x.ask.id, x.answer?.id ?? null])).toEqual([
      ["b", null],
      ["a", "ra"],
    ]);
  });
});

describe("local weeks", () => {
  it("starts the week at Monday midnight in the workspace's timezone", () => {
    // Monday 03:00 UTC is still Sunday evening in New York.
    const t = Date.UTC(2026, 9, 19, 3);
    expect(new Date(weekStartIn(t, "UTC")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(new Date(weekStartIn(t, "America/New_York")).toISOString()).toBe("2026-10-12T04:00:00.000Z");
    // Kolkata is ahead: Monday 00:00 IST = Sunday 18:30 UTC.
    expect(new Date(weekStartIn(Date.UTC(2026, 9, 19, 12), "Asia/Kolkata")).toISOString()).toBe("2026-10-18T18:30:00.000Z");
    expect(weekStartIn(t, "Not/AZone")).toBe(weekStartUtc(t));
  });

  it("handles a daylight-saving week and steps back whole weeks", () => {
    // US clocks go back on Sunday 1 Nov 2026: that week is 169 hours long.
    const w = localWeek(Date.UTC(2026, 10, 4, 15), "America/New_York", 0);
    expect(new Date(w.start).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(new Date(w.prevStart).toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(w.end - w.start).toBe(7 * 86_400_000);
    const last = localWeek(Date.UTC(2026, 10, 4, 15), "America/New_York", 1);
    expect(last.start).toBe(w.prevStart);
    expect(last.end).toBe(w.start);
  });
});

describe("Climb AI times and costs", () => {
  it("shows times in the owner's timezone", () => {
    const at = Date.parse("2026-10-20T09:00:00+01:00");
    expect(localTime(at, "Europe/London")).toMatch(/9:00\s?AM/);
    expect(localTime(at, "America/New_York")).toMatch(/4:00\s?AM/);
    expect(localTime(at, "Bad/Zone")).toMatch(/8:00\s?AM/);
  });

  it("rejects dates it can't read, and summarizes schedules in local time", () => {
    const schedule = CLIMB_TOOLS.find((t) => t.name === "schedule_draft")!;
    expect(schedule.input.safeParse({ artifactId: "x", when: "next tuesday-ish" }).success).toBe(false);
    expect(schedule.input.safeParse({ artifactId: "x", when: "2026-02-31T09:00:00Z" }).success).toBe(false);
    expect(schedule.input.safeParse({ artifactId: "x", when: "2026-10-20T09:00:00+15:00" }).success).toBe(false);
    const ok = schedule.input.parse({ artifactId: "x", when: "2026-10-20T09:00:00+01:00" });
    expect(schedule.summarize!(ok, { timeZone: "Europe/London" })).toMatch(/Tue, Oct 20.*9:00\s?AM/);
  });

  it("bounds read and research inputs before dispatch", () => {
    const input = (name: string) => CLIMB_TOOLS.find((tool) => tool.name === name)!.input;
    expect(input("list_drafts").safeParse({ limit: 26 }).success).toBe(false);
    expect(input("list_drafts").safeParse({ limit: 10 }).success).toBe(true);
    expect(input("get_results").safeParse({ days: 6 }).success).toBe(false);
    expect(input("get_results").safeParse({ days: 365 }).success).toBe(true);
    expect(input("get_weekly_report").safeParse({ weeksAgo: 13 }).success).toBe(false);
    expect(input("find_customers").safeParse({ count: 31 }).success).toBe(false);
    expect(input("review_prospects").safeParse({ prospectIds: [] , stage: "approved" }).success).toBe(false);
  });

  it("constrains autopilot schedules and exports valid model tool schemas", () => {
    const autopilot = CLIMB_TOOLS.find((tool) => tool.name === "set_autopilot")!.input;
    const base = { enabled: true, mode: "always_ask" as const };
    expect(autopilot.safeParse({ ...base, channels: [{ channel: "linkedin", postsPerWeek: 7 }] }).success).toBe(false);
    expect(autopilot.safeParse({ ...base, channels: [{ channel: "linkedin", postsPerWeek: 6 }, { channel: "linkedin", postsPerWeek: 1 }] }).success).toBe(false);
    expect(autopilot.safeParse({ ...base, channels: [{ channel: "linkedin", postsPerWeek: 6 }, { channel: "instagram", postsPerWeek: 6 }, { channel: "facebook", postsPerWeek: 6 }, { channel: "tiktok", postsPerWeek: 4 }] }).success).toBe(false);
    expect(autopilot.safeParse({ ...base, channels: [{ channel: "linkedin", postsPerWeek: 2 }] }).success).toBe(true);
    expect(() => climbToolDefs({ ui: true })).not.toThrow();
  });

  it("asks before refreshing the plan, with the credit cost", () => {
    const refresh = CLIMB_TOOLS.find((t) => t.name === "refresh_plan")!;
    expect(refresh.risk).toBe("confirm");
    expect(refresh.summarize!({})).toMatch(/Uses up to [\d,]+ credits/);
  });
});
