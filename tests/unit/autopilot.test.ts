import { describe, expect, it } from "vitest";
import { localDate, nextTrust, nextWeekOf, routeDraft, slotTime, spreadDays, thisWeekOf, TRUST_THRESHOLD, zonedTime, type RouteInput } from "../../shared/autopilot";
import { fixtureCalendar } from "../../shared/autopilot/fixture";

const base: RouteInput = {
  mode: "auto",
  channel: "facebook",
  text: "Why your furnace filter is the reason the upstairs stays cold, and the 2-minute check.",
  trust: { channel: "facebook", streak: 0, unlocked: false },
  unsupportedClaims: [],
  reviewShipped: true,
  alwaysAskTopics: [],
  firstOnChannel: false,
  canPublish: true,
};

describe("autopilot routing", () => {
  it("always_ask never auto-posts", () => {
    expect(routeDraft({ ...base, mode: "always_ask" }).decision).toBe("ask");
  });

  it("auto posts a clean draft on a connected channel", () => {
    const r = routeDraft(base);
    expect(r.decision).toBe("auto");
    expect(r.reasons[0]).toMatch(/safety check/);
  });

  it.each([
    [{ unsupportedClaims: ["30% faster"] }, /confirmed facts/],
    [{ reviewShipped: false }, /reviewer/],
    [{ firstOnChannel: true }, /first post/],
    [{ canPublish: false }, /Connect Facebook/],
    [{ channel: "tiktok" }, /export pack/],
    [{ channel: "linkedin", canPublish: false }, /Connect LinkedIn/],
    [{ text: "Book this week and get 20% off your tune-up" }, /price or offer/],
    [{ text: "Our plan is risk-free and guaranteed" }, /guarantee/],
    [{ text: "Win a free tune-up in our giveaway" }, /giveaway/],
    [{ text: "We're open [NEEDS FACT: hours] on Saturday" }, /fact for you/],
    [{ alwaysAskTopics: ["new hires"], text: "Meet our new hires on the install team" }, /approve yourself/],
    [{ plannerNeedsOwner: true, plannerNote: "Mentions a partner by name" }, /partner by name/],
  ] as [Partial<RouteInput>, RegExp][])("auto still asks when %o", (patch, why) => {
    const r = routeDraft({ ...base, ...patch });
    expect(r.decision).toBe("ask");
    expect(r.reasons.join(" ")).toMatch(why);
  });

  it("trust ladder asks until the channel is unlocked, then auto-posts", () => {
    const locked = routeDraft({ ...base, mode: "trust_ladder", trust: { channel: "facebook", streak: 3, unlocked: false } });
    expect(locked.decision).toBe("ask");
    expect(locked.reasons.join(" ")).toMatch(/2 more approvals/);
    const open = routeDraft({ ...base, mode: "trust_ladder", trust: { channel: "facebook", streak: 5, unlocked: true } });
    expect(open.decision).toBe("auto");
  });
});

describe("trust ladder", () => {
  it(`unlocks after ${TRUST_THRESHOLD} clean approvals and resets on rejection or a problem`, () => {
    let t = { channel: "x", streak: 0, unlocked: false };
    for (let i = 0; i < TRUST_THRESHOLD - 1; i++) t = nextTrust(t, "approved_unedited");
    expect(t.unlocked).toBe(false);
    t = nextTrust(t, "approved_unedited");
    expect(t).toMatchObject({ streak: TRUST_THRESHOLD, unlocked: true });
    expect(nextTrust(t, "approved_edited").unlocked).toBe(true); // edits don't revoke earned trust
    expect(nextTrust(t, "rejected")).toMatchObject({ streak: 0, unlocked: false });
    expect(nextTrust(t, "auto_problem")).toMatchObject({ streak: 0, unlocked: false });
  });

  it("edits before unlock restart the count", () => {
    const t = nextTrust({ channel: "x", streak: 4, unlocked: false }, "approved_edited");
    expect(t).toMatchObject({ streak: 0, unlocked: false });
  });
});

describe("time zones and slots", () => {
  it("converts local wall-clock times to UTC, including DST", () => {
    // 9:00 in New York: EDT (UTC-4) in July, EST (UTC-5) in January.
    expect(new Date(zonedTime(2026, 6, 14, 9, 0, "America/New_York")).toISOString()).toBe("2026-07-14T13:00:00.000Z");
    expect(new Date(zonedTime(2026, 0, 14, 9, 0, "America/New_York")).toISOString()).toBe("2026-01-14T14:00:00.000Z");
    expect(new Date(zonedTime(2026, 9, 20, 9, 0, "Asia/Dhaka")).toISOString()).toBe("2026-10-20T03:00:00.000Z");
  });

  it("finds this and next local Monday", () => {
    const sat = Date.parse("2026-10-17T20:00:00Z"); // Saturday evening in UTC; Sunday morning in Tokyo
    expect(thisWeekOf(sat, "UTC")).toBe("2026-10-12");
    expect(nextWeekOf(sat, "UTC")).toBe("2026-10-19");
    expect(localDate(sat, "Asia/Tokyo").weekday).toBe(7);
    expect(nextWeekOf(sat, "Asia/Tokyo")).toBe("2026-10-19");
  });

  it("places slots on the right local day and hour, avoiding quiet hours", () => {
    const at = slotTime({ weekOf: "2026-10-19", day: 2, channel: "linkedin", timeZone: "Europe/London", indexOnDay: 0 });
    expect(new Date(at).toISOString()).toBe("2026-10-20T07:00:00.000Z"); // Tue 08:00 BST
    const quiet = slotTime({ weekOf: "2026-10-19", day: 1, channel: "instagram", timeZone: "UTC", indexOnDay: 0, quietHours: { start: 10, end: 13 } });
    expect(new Date(quiet).getUTCHours()).toBe(18);
  });

  it("spreads posts across the week", () => {
    expect(spreadDays(3)).toEqual([1, 3, 5]);
    expect(spreadDays(1)).toEqual([1]);
    expect(new Set(spreadDays(5)).size).toBe(5);
  });
});

describe("demo calendar", () => {
  it("fills exactly the requested cadence from the remaining days, without invented offers", () => {
    const plan = fixtureCalendar({ instagram: 3, linkedin: 2 }, 3, "Wire Co", ["We install heat pumps in Ohio."]);
    expect(plan.slots.filter((s) => s.channel === "instagram")).toHaveLength(3);
    expect(plan.slots.filter((s) => s.channel === "linkedin")).toHaveLength(2);
    expect(plan.slots.every((s) => s.day >= 3 && s.day <= 7)).toBe(true);
    expect(plan.slots.map((s) => s.idea).join(" ")).not.toMatch(/%|\$|discount/i);
  });
});
