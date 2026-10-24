import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

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

    // Free accounts: the booking page is off (a paid feature); with a package the owner switches it on.
    expect(view.page).toMatchObject({ active: false, live: false });
    expect(await t.query(api.outbound.publicPage, { slug: view.page!.slug })).toBeNull();
    const pageEdit = { slug: w.slug, title: "Intro call", durationMin: 30, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 };
    await expect(w.client.mutation(api.outbound.saveBookingPage, { ...pageEdit, active: true })).rejects.toThrow(/package/);
    await w.client.mutation(api.outbound.saveBookingPage, { ...pageEdit, active: false }); // editing an off page is fine
    await makePaid(t, w.orgId);
    await w.client.mutation(api.outbound.saveBookingPage, { ...pageEdit, active: true });

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
    await w.client.mutation(api.outbound.setReplyDisposition, { slug: w.slug, prospectId: view.prospects[0].id, disposition: "qualified" });
    expect(view.bookings).toHaveLength(1);
    const [stored, prospect] = await t.run(async (ctx) => Promise.all([ctx.db.query("bookings").first(), ctx.db.get(view.prospects[0].id)]));
    expect(stored?.emailCiphertext).not.toContain("ada@");
    expect(prospect?.replyDisposition).toBe("qualified");
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
    await expect(other.client.mutation(api.outbound.setReplyDisposition, { slug: other.slug, prospectId: view.prospects[0].id, disposition: "qualified" })).rejects.toThrow();
    await expect(other.client.query(api.outbound.get, { slug: w.slug })).rejects.toThrow();
  });

  it("creators mode finds creators (keyed by profile, not platform domain) and writes a collab pitch", async () => {
    const t = setup();
    const w = await workspace(t, "creators@example.com");
    await w.client.mutation(api.outbound.start, { slug: w.slug, kind: "creators", count: 5 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.campaign).toMatchObject({ kind: "creators", status: "review", title: "Find creators" });
    expect(view.prospects.length).toBeGreaterThan(0);
    expect(view.prospects[0].firstLineEvidenceUrl).toBe(view.prospects[0].contentSamples[0].url);
    expect(view.prospects[0].firstLine).toContain("grounded in the recent public content");
    const run = await t.run(async (ctx) => ctx.db.query("workflowSteps").collect());
    expect(run.some((s) => s.label.startsWith("Find creators"))).toBe(true);
  });

  it("stores creator audience and language only when the cited evidence contains the exact values", async () => {
    const t = setup();
    const w = await workspace(t, "creator-evidence@example.com");
    await w.client.mutation(api.outbound.start, { slug: w.slug, kind: "creators", count: 5 });
    const campaign = await t.run((ctx) => ctx.db.query("outboundCampaigns").first());
    const profile = "https://www.instagram.com/studio.ana/";
    await t.mutation(internal.outbound.saveResult, {
      campaignId: campaign!._id,
      prospects: {
        icp: { summary: "A relevant cooking creator", mustHaves: [], disqualifiers: [], triggers: [], decisionMaker: "Creator" },
        prospects: [{
          company: "Studio Ana", website: profile, location: "London", sizeBand: "12k followers",
          why: "Publishes relevant cooking lessons", evidence: [{ url: profile, observation: "12k followers. English language cooking tutorials." }],
          trigger: "Recent cooking tutorial", fit: 80, timing: 70, contact: "@studio.ana (Instagram)", publicEmail: "",
          audienceSize: { value: "12k followers", sourceUrl: profile },
          contentLanguage: { value: "English", sourceUrl: profile },
          collaborationConcept: "Proposed short cooking tutorial featuring the product; owner and creator have not agreed.",
        }],
        excluded: [],
      },
      outreach: { sequence: [], firstLines: [{ company: "Studio Ana", line: "I loved your recent post.", evidenceUrl: profile }], ownerNotes: [] },
    });
    const view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.prospects[0]).toMatchObject({
      audienceSize: { value: "12k followers", sourceUrl: profile },
      contentLanguage: { value: "English", sourceUrl: profile },
      collaborationConcept: expect.stringContaining("Proposed"),
      firstLine: "",
      firstLineEvidenceUrl: null,
    });
    expect(view.campaign?.ownerNotes).toContain("1 creator opener was omitted because no exact content sample was cited. Add a sourced opener before sending.");
  });

  it("records an append-only creator collaboration lifecycle and returns it as owner-reported context", async () => {
    const t = setup();
    const w = await workspace(t, "creator-collaboration@example.com");
    await w.client.mutation(api.outbound.start, { slug: w.slug, kind: "creators", count: 5 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let view = await w.client.query(api.outbound.get, { slug: w.slug });
    const creator = view.prospects[0];
    const now = Date.now();
    await expect(w.client.mutation(api.outbound.recordCreatorCollaboration, {
      slug: w.slug, prospectId: creator.id, status: "agreed", format: "paid",
      metric: { name: "Click-through rate", kind: "rate", value: 0.04, unit: "rate", periodStartAt: now - 7 * 86_400_000, periodEndAt: now },
    })).rejects.toThrow(/denominator/);

    await w.client.mutation(api.outbound.recordCreatorCollaboration, {
      slug: w.slug, prospectId: creator.id, status: "agreed", format: "paid", agreedValueMinor: 25_000,
      actualCostMinor: 20_000,
      metric: { name: "Click-through rate", kind: "rate", value: 0.04, unit: "rate", denominator: 1_000, eligible: 1_500, exposed: 1_000, periodStartAt: now - 7 * 86_400_000, periodEndAt: now, sourceUrl: "https://creator.example/insights" },
      note: "Owner-entered from the creator's report.",
    });
    await w.client.mutation(api.outbound.recordCreatorCollaboration, {
      slug: w.slug, prospectId: creator.id, status: "content_published", format: "paid", publishedUrl: "https://creator.example/post-1",
    });

    const history = await w.client.query(api.outbound.creatorCollaborationHistory, { slug: w.slug, prospectId: creator.id });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ status: "content_published", basis: "owner_reported", basisLabel: "Owner reported; not independently verified" });
    expect(history[1]).toMatchObject({ status: "agreed", agreedValueMinor: 25_000, actualCostMinor: 20_000, currency: "USD", basis: "owner_reported", metric: { value: 0.04, denominator: 1_000, eligible: 1_500, exposed: 1_000 } });
    const campaign = await t.run((ctx) => ctx.db.query("outboundCampaigns").first());
    const context = await t.query(internal.outbound.campaignContext, { campaignId: campaign!._id });
    expect(context?.collaborationHistory[0]).toMatchObject({ creator: creator.company, status: "content_published", basis: "owner_reported" });
    expect(await t.run((ctx) => ctx.db.query("outboundSends").collect())).toHaveLength(0);

    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    const strategyRun = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).order("desc").collect()).find((run) => run.kind === "strategy"));
    expect(strategyRun).toBeTruthy();
    const strategyContext = await t.query(internal.jobWrites.jobContext, { runId: strategyRun!._id });
    expect(strategyContext?.creatorOutcomeText).toContain(creator.company);
    expect(strategyContext?.creatorOutcomeText).toContain("denominator");

    const other = await workspace(t, "creator-collaboration-other@example.com");
    await makePaid(t, other.orgId);
    await other.client.mutation(api.orgs.generatePlan, { slug: other.slug });
    const otherStrategyRun = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", other.orgId)).order("desc").collect()).find((run) => run.kind === "strategy"));
    const otherStrategyContext = await t.query(internal.jobWrites.jobContext, { runId: otherStrategyRun!._id });
    expect(otherStrategyContext?.creatorOutcomeText).toBe("");

    await expect(other.client.query(api.outbound.creatorCollaborationHistory, { slug: other.slug, prospectId: creator.id })).rejects.toThrow();
    await expect(other.client.mutation(api.outbound.recordCreatorCollaboration, { slug: other.slug, prospectId: creator.id, status: "interested" })).rejects.toThrow();

    await w.client.mutation(api.outbound.start, { slug: w.slug, kind: "customers", count: 5 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    view = await w.client.query(api.outbound.get, { slug: w.slug });
    expect(view.campaign?.kind).toBe("customers");
    await expect(w.client.mutation(api.outbound.recordCreatorCollaboration, { slug: w.slug, prospectId: view.prospects[0].id, status: "interested" })).rejects.toThrow(/only available for creator targets/);
  });
});
