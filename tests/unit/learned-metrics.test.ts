import { describe, expect, it } from "vitest";
import { learningCounts, METRIC_DEFS, outreachCohortMature, OUTREACH_REPLY_WINDOW_DAYS, rateLine, wilson90 } from "../../shared/growth/learnedMetrics";

/** S4 (REQ-LEARN-01..03): windows match, reply ≠ interest, booked ≠ attended, counts with ranges. */
const empty = { outreach: [], bookingOutcomes: [], landing: [], chats: { total: 0, withEmail: 0 }, reviews: { sent: 0, clicked: 0 }, bio: null };

describe("learned metrics", () => {
  it("cumulative counters are never presented as a 120-day rate", () => {
    const c = learningCounts({ ...empty, landing: [{ views: 400, leads: 20 }], bio: { views: 1000, signups: 30 } });
    expect(METRIC_DEFS.landing_lead.window).toBe("lifetime");
    expect(METRIC_DEFS.bio_signup.window).toBe("lifetime");
    expect(rateLine("landing_lead", "own", c.landing_lead)).toMatch(/all time/);
    expect(rateLine("bio_signup", "own", c.bio_signup)).not.toMatch(/120 days/);
  });

  it("any reply is labelled as any reply; bookings and attendance are separate rates", () => {
    const c = learningCounts({ ...empty, outreach: [{ contacted: 200, replied: 10, qualified: 4, booked: 2 }], bookingOutcomes: ["attended", "no_show", "no_show"] });
    expect(c.outreach_reply).toEqual({ trials: 200, successes: 10 });
    expect(c.outreach_qualified_reply).toEqual({ trials: 200, successes: 4 });
    expect(c.outreach_booked).toEqual({ trials: 200, successes: 2 });
    expect(c.booking_attended).toEqual({ trials: 3, successes: 1 });
    expect(METRIC_DEFS.outreach_reply.label).toMatch(/any reply/);
    expect(METRIC_DEFS.outreach_reply.maturity).toContain(`${OUTREACH_REPLY_WINDOW_DAYS}-day`);
  });

  it("waits for outreach campaigns to stop and for the reply-watch window to close", () => {
    const now = Date.UTC(2026, 9, 24);
    const days = 86_400_000;
    expect(outreachCohortMature({ sendingStatus: "on", lastSentAt: now - 90 * days, latestObservedSentAt: now - 90 * days, now })).toBe(false);
    expect(outreachCohortMature({ sendingStatus: "paused", lastSentAt: now - 20 * days, latestObservedSentAt: now - 30 * days, now })).toBe(false);
    expect(outreachCohortMature({ sendingStatus: "done", lastSentAt: now - 21 * days, latestObservedSentAt: now - 30 * days, now })).toBe(true);
    expect(outreachCohortMature({ latestObservedSentAt: now - 20 * days, now })).toBe(false);
  });

  it("successes can't exceed trials; empty denominators give no rate", () => {
    const c = learningCounts({ ...empty, landing: [{ views: 10, leads: 50 }, { views: 0, leads: 3 }] });
    expect(c.landing_lead).toEqual({ trials: 10, successes: 10 });
    expect(learningCounts(empty)).toEqual({});
  });

  it("each rate carries counts and a 90% range, not a grade", () => {
    const line = rateLine("chat_lead", "own", { trials: 20, successes: 5 });
    expect(line).toMatch(/5\/20, last 120 days, 90% range \d/);
    expect(line).not.toMatch(/grade A/);
    expect(line).toMatch(/not proof of cause/);
    const small = wilson90(1, 5)!;
    const large = wilson90(100, 500)!;
    expect(small.high - small.low).toBeGreaterThan(large.high - large.low);
  });
});

describe("play IDs across plan versions", () => {
  it("a play with the same name keeps its ID; new plays get fresh unique IDs", async () => {
    const { withPlayIds } = await import("../../convex/jobWrites");
    const prior = [{ expert: { plays: [{ name: "Agency outreach", id: "pl_a" }] } }] as never;
    const out = withPlayIds([{ name: "agency outreach " }, { name: "Creator collabs" }, { name: "Creator collabs" }], prior);
    expect(out[0].id).toBe("pl_a");
    expect(out[1].id).toMatch(/^pl_/);
    expect(new Set(out.map((p) => p.id)).size).toBe(3);
  });
});
