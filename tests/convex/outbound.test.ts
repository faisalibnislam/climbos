import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

/**
 * Outbound end to end on the deterministic model: find customers → evidenced
 * prospects + a sequence → approve → public booking page → a booked call marks
 * the prospect booked. Nothing is ever sent to prospects.
 */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Wire Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 0 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

describe("outbound", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z"));
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("finds evidenced prospects, writes the sequence, and a booking marks the prospect booked", async () => {
    const t = setup();
    const w = await workspace(t, "ob@example.com");
    await w.client.mutation(api.outbound.start, { slug: w.slug, who: "Agencies that build Webflow sites", where: "UK", count: 10 });
    let view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.campaign?.status).toBe("researching");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.campaign?.status).toBe("review");
    expect(view.prospects).toHaveLength(3);
    expect(view.prospects[0].evidence[0].url).toMatch(/^https:\/\//);
    expect(view.prospects[0].firstLine).toMatch(/opener/);
    expect(view.campaign?.sequence[0].body).toContain("{{firstLine}}");
    expect(view.page?.slug).toBeTruthy();

    // A second run skips companies already in the pipeline.
    await w.client.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [view.prospects[0].id], stage: "approved" });

    const page = await t.query(api.outbound.publicPage, { slug: view.page!.slug });
    expect(page?.slots.length).toBeGreaterThan(10);
    const res = await t.mutation(api.outbound.book, { slug: view.page!.slug, startAt: page!.slots[0], name: "Ada", email: "ada@alpha.example.com", ref: view.prospects[0].id });
    expect(res.endAt - res.startAt).toBe(30 * 60_000);
    // The slot is gone, and the same slot can't be booked twice.
    const after = await t.query(api.outbound.publicPage, { slug: view.page!.slug });
    expect(after?.slots).not.toContain(page!.slots[0]);
    await expect(t.mutation(api.outbound.book, { slug: view.page!.slug, startAt: page!.slots[0], name: "Bob", email: "bob@x.com" })).rejects.toThrow(/just taken/);

    view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.prospects.find((p) => p.id === view.prospects[0].id)?.stage).toBe("booked");
    expect(view.bookings).toHaveLength(1);
    const stored = await t.run(async (ctx) => ctx.db.query("bookings").first());
    expect(stored?.emailCiphertext).not.toContain("ada@");
  });

  it("starts from a wish and links the card to the campaign", async () => {
    const t = setup();
    const u = await asNewUser(t, "ob-wish@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await u.client.mutation(api.workspace.sendChat, { slug, text: "Drop your website link: find customers who need us, write the emails and book the calls" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const cards = await t.run(async (ctx) => ctx.db.query("actionCards").collect());
    const card = cards.find((c) => c.kind === "find_customers");
    expect(card?.status).toBe("done");
    expect(cards.some((c) => JSON.parse(c.payload).channel === "email")).toBe(false); // not mistaken for a newsletter
    const view = await u.client.query(api.outbound.get, { slug });
    expect(view.campaign?.status).toBe("review");
    expect(view.prospects.length).toBeGreaterThanOrEqual(3);
  });

  it("other workspaces can't read or change prospects", async () => {
    const t = setup();
    const w = await workspace(t, "ob-a@example.com");
    await w.client.mutation(api.outbound.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const view = await w.client.query(api.outbound.get, { slug: w.slug });
    const other = await workspace(t, "ob-b@example.com");
    await expect(other.client.mutation(api.outbound.setStage, { slug: other.slug, prospectIds: [view.prospects[0].id], stage: "skipped" })).rejects.toThrow();
    await expect(other.client.query(api.outbound.get, { slug: w.slug })).rejects.toThrow();
  });
});
