import { describe, expect, it } from "vitest";
import { buildWeeklyReport, weekStartUtc, type WeekCounts } from "../../shared/report/weekly";

const zero: WeekCounts = { postsPublished: 0, emailsSent: 0, replies: 0, callsBooked: 0, newProspects: 0, reach: 0, clicks: 0, creditsUsed: 0, jobsDone: 0 };
const ctx = { pendingApprovals: 0, upcomingCalls: [], scheduledPosts: 3, outboundOn: true, hasPlan: true, creditsLeft: 500 };

describe("weekly CEO report", () => {
  it("leads with booked calls, orders lines by value and shows changes", () => {
    const r = buildWeeklyReport({ weekStart: 0, weekEnd: 1, now: { ...zero, callsBooked: 2, emailsSent: 40, postsPublished: 3 }, before: { ...zero, emailsSent: 25 }, ctx });
    expect(r.headline).toBe("2 calls booked this week.");
    expect(r.lines.map((l) => l.key)).toEqual(["callsBooked", "emailsSent", "postsPublished"]);
    expect(r.lines[1].change).toBe(15);
  });
  it("lists what needs the owner, at most five", () => {
    const r = buildWeeklyReport({ weekStart: 0, weekEnd: 1, now: { ...zero, replies: 2 }, before: zero, ctx: { ...ctx, pendingApprovals: 4, outboundOn: false, scheduledPosts: 0, creditsLeft: 10, upcomingCalls: [{ name: "Ana", startAt: Date.UTC(2026, 9, 20) }] } });
    expect(r.next[0]).toBe("Approve 4 drafts.");
    expect(r.next).toContain("Answer 2 replies.");
    expect(r.next.length).toBeLessThanOrEqual(5);
  });
  it("weeks start on Monday UTC", () => {
    expect(new Date(weekStartUtc(Date.UTC(2026, 9, 18, 15))).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});
