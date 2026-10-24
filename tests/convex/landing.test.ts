import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("landing pages", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("writes, edits, publishes; the form makes a lead in Pipeline and Inbox; free has one live page", async () => {
    const t = setup();
    const owner = await asNewUser(t, "landing@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Landing Co" });
    const id = await owner.client.mutation(api.landing.create, { slug, brief: "Free 15-minute audit" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let page = (await owner.client.query(api.landing.list, { slug })).pages[0];
    expect(page.status).toBe("draft");
    expect(page.content?.headline).toBeTruthy();
    expect(await t.query(api.landing.publicPage, { slug: page.slug })).toBeNull();

    await owner.client.mutation(api.landing.update, { slug, id, content: { ...page.content!, headline: "Get your free audit" } });
    await owner.client.mutation(api.landing.setLive, { slug, id, live: true });
    const pub = await t.query(api.landing.publicPage, { slug: page.slug });
    expect(pub?.content.headline).toBe("Get your free audit");
    expect(pub?.badge).toBe(true);

    await t.mutation(api.landing.viewed, { slug: page.slug });
    await expect(t.mutation(api.landing.submit, { slug: page.slug, name: "Ana", email: "nope" })).rejects.toThrow(/valid email/);
    await t.mutation(api.landing.submit, { slug: page.slug, name: "Ana", email: "ana@x.example", message: "Interested" });
    page = (await owner.client.query(api.landing.list, { slug })).pages[0];
    expect(page).toMatchObject({ views: 1, leads: 1 });
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ email: "ana@x.example", stage: "lead" });
    expect((await owner.client.query(api.inbox.list, { slug, box: "open" }))[0]).toMatchObject({ kind: "form", canReply: true });

    const second = await owner.client.mutation(api.landing.create, { slug, brief: "Second offer" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(owner.client.mutation(api.landing.setLive, { slug, id: second, live: true })).rejects.toThrow(/1 live page/);
  });
});

describe("landing A/B test", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("splits views, counts leads per version and applies a clear B win", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ab@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "AB Co" });
    const id = await owner.client.mutation(api.landing.create, { slug, brief: "Free audit" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await owner.client.mutation(api.landing.setLive, { slug, id, live: true });
    const page = (await owner.client.query(api.landing.list, { slug })).pages[0];
    await expect(owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: page.content!.headline })).rejects.toThrow(/different/);
    await owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: "Double your leads in 30 days" });
    expect((await t.query(api.landing.publicPage, { slug: page.slug }))?.test?.b.headline).toBe("Double your leads in 30 days");
    await t.mutation(api.landing.submit, { slug: page.slug, name: "A1", email: "a1@x.example", variant: "A" });
    for (let i = 0; i < 18; i++) await t.mutation(api.landing.submit, { slug: page.slug, name: `B${i}`, email: `b${i}@x.example`, variant: "B" });
    for (let i = 0; i < 110; i++) {
      await t.mutation(api.landing.viewed, { slug: page.slug, variant: "A" });
      await t.mutation(api.landing.viewed, { slug: page.slug, variant: "B" });
    }
    // Decision books: a clear early lead is not read; the test runs to its planned end (1,000 views).
    expect((await owner.client.query(api.abtests.forTarget, { slug, targetId: id }))[0]).toMatchObject({ status: "running" });
    for (let i = 110; i < 500; i++) {
      await t.mutation(api.landing.viewed, { slug: page.slug, variant: "A" });
      await t.mutation(api.landing.viewed, { slug: page.slug, variant: "B" });
    }
    const [test] = await owner.client.query(api.abtests.forTarget, { slug, targetId: id });
    expect(test).toMatchObject({ status: "done", winner: "B" });
    expect((await owner.client.query(api.landing.list, { slug })).pages[0].content?.headline).toBe("Double your leads in 30 days");
    expect((await t.query(api.landing.publicPage, { slug: page.slug }))?.test).toBeNull();
  });

  it("persists a sample-ratio mismatch as invalid with no winner or challenger rollout", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ab-invalid@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Invalid Split Co" });
    const pageId = await owner.client.mutation(api.landing.create, { slug, brief: "Free audit" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await owner.client.mutation(api.landing.setLive, { slug, id: pageId, live: true });
    const page = (await owner.client.query(api.landing.list, { slug })).pages[0];
    const originalHeadline = page.content!.headline;
    await owner.client.mutation(api.abtests.startLanding, { slug, pageId, headline: "A challenger headline" });
    const [started] = await owner.client.query(api.abtests.forTarget, { slug, targetId: pageId });

    // Put the run one view short of its fixed horizon with an already broken 90/10 split.
    await t.run(async (ctx) => ctx.db.patch(started.id, {
      stats: [{ key: "A", trials: 899, wins: 1 }, { key: "B", trials: 100, wins: 50 }],
    }));
    await t.mutation(api.landing.viewed, { slug: page.slug, variant: "A" });

    const [finished] = await owner.client.query(api.abtests.forTarget, { slug, targetId: pageId });
    expect(finished).toMatchObject({ status: "invalid", winner: null, confidence: 0 });
    expect(finished.note).toMatch(/Invalid test/);
    expect((await owner.client.query(api.landing.list, { slug })).pages[0].content?.headline).toBe(originalHeadline);
  });

  it("a page that didn't finish can be written again; deleting a page ends its running test", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ab-retry@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Retry Co" });
    process.env.CLIMBOS_FAKE_LLM = "fail";
    const id = await owner.client.mutation(api.landing.create, { slug, brief: "Free audit" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let list = await owner.client.query(api.landing.list, { slug });
    expect(list.pages[0].status).toBe("failed");
    expect(list).toMatchObject({ canEdit: true, canPublish: true });

    process.env.CLIMBOS_FAKE_LLM = "ship";
    await owner.client.mutation(api.landing.retry, { slug, id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    list = await owner.client.query(api.landing.list, { slug });
    expect(list.pages[0].status).toBe("draft");
    await expect(owner.client.mutation(api.landing.retry, { slug, id })).rejects.toThrow(/didn't finish/);

    await owner.client.mutation(api.landing.setLive, { slug, id, live: true });
    await owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: "A brand new headline" });
    await owner.client.mutation(api.landing.remove, { slug, id });
    const tests = await t.run(async (ctx) => ctx.db.query("abTests").collect());
    expect(tests[0]).toMatchObject({ status: "stopped" });
  });
});
