import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup } from "./helpers";

describe("booked calls: reminders, guest cancel, no-shows", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z")); // Monday
  });
  afterEach(() => vi.useRealTimers());

  it("lets the guest cancel with their private link, and a no-show gets a rebooking email", async () => {
    const t = setup();
    const owner = await asNewUser(t, "calls@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Calls Co" });
    await makePaid(t, orgId);
    const pageSlug = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("bookingPages", { orgId: orgId as Id<"organizations">, slug: "calls-co", title: "Intro call", durationMin: 30, timezone: "UTC", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, bufferMin: 0, noticeHours: 1, active: true, createdAt: now, updatedAt: now });
      return "calls-co";
    });
    const pub = await t.query(api.outbound.publicPage, { slug: pageSlug });
    const slot = pub!.slots.find((s: number) => s > Date.now() + 24 * 3_600_000)!;
    const booked = await t.mutation(api.outbound.book, { slug: pageSlug, startAt: slot, name: "Ana", email: "ana@x.example" });
    const { manageToken } = await import("../../convex/bookings");
    const token = await manageToken(booked.bookingId);
    expect((await t.query(api.bookings.manageView, { token }))?.status).toBe("confirmed");
    // Reminder due the day before.
    vi.setSystemTime(new Date(slot - 20 * 3_600_000));
    expect(await t.query(internal.bookings.dueReminders, {})).toEqual([booked.bookingId]);
    await t.mutation(api.bookings.cancelByGuest, { token });
    expect((await t.query(api.bookings.manageView, { token }))?.status).toBe("cancelled");
    expect(await t.query(internal.bookings.dueReminders, {})).toEqual([]);

    // A second booking that's missed.
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z"));
    const slot2 = (await t.query(api.outbound.publicPage, { slug: pageSlug }))!.slots.find((s: number) => s > Date.now() + 3 * 3_600_000)!;
    const b2 = await t.mutation(api.outbound.book, { slug: pageSlug, startAt: slot2, name: "Ben", email: "ben@x.example" });
    await expect(owner.client.mutation(api.bookings.setOutcome, { slug, bookingId: b2.bookingId, outcome: "no_show" })).rejects.toThrow(/hasn't happened/);
    vi.setSystemTime(new Date(slot2 + 3_600_000));
    const inbox = await owner.client.query(api.inbox.list, { slug, box: "open" });
    const item = inbox.find((m) => m.text.includes("Booked a 30-minute call") && m.from === "Ben")!;
    const info = await owner.client.query(api.bookings.forInbox, { slug, inboxId: item.id });
    expect(info?.past).toBe(true);
    await owner.client.mutation(api.bookings.setOutcome, { slug, bookingId: b2.bookingId, outcome: "no_show" });
    expect((await owner.client.query(api.bookings.forInbox, { slug, inboxId: item.id }))?.outcome).toBe("no_show");
  });
});
