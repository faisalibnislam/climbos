import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../shared/policy";
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
  async function assignVisitors(t: ReturnType<typeof setup>, slug: string, targets: { A: number; B: number }) {
    const visitors: Record<"A" | "B", { key: string; testId: Id<"abTests"> }[]> = { A: [], B: [] };
    for (let i = 0; (visitors.A.length < targets.A || visitors.B.length < targets.B) && i < 5000; i++) {
      const key = `ab-test-visitor-${String(i).padStart(8, "0")}`;
      const result = await t.mutation(api.landing.assignLanding, { slug, visitorKey: key });
      if (result.variant && result.testId && visitors[result.variant].length < targets[result.variant]) {
        visitors[result.variant].push({ key, testId: result.testId });
      }
    }
    if (visitors.A.length !== targets.A || visitors.B.length !== targets.B) throw new Error("Could not create the requested balanced assignment sample.");
    return visitors;
  }

  async function exposeVisitors(t: ReturnType<typeof setup>, slug: string, visitors: { key: string; testId: Id<"abTests"> }[]) {
    for (const visitor of visitors) await t.mutation(api.landing.viewed, { slug, visitorKey: visitor.key, testId: visitor.testId, countView: false });
  }

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
    await expect(owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: "Another message", outcomeWindowDays: 31 })).rejects.toThrow(/0 to 30/);
    await owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: "Double your leads in 30 days" });
    expect((await t.query(api.landing.publicPage, { slug: page.slug }))?.test?.b.headline).toBe("Double your leads in 30 days");
    const visitors = await assignVisitors(t, page.slug, { A: 500, B: 500 });
    // Assignment does not count as a trial. Only a rendered version is an exposure.
    expect((await owner.client.query(api.abtests.forTarget, { slug, targetId: id }))[0].stats).toMatchObject([
      { key: "A", assigned: expect.any(Number), exposed: 0, trials: 0 },
      { key: "B", assigned: expect.any(Number), exposed: 0, trials: 0 },
    ]);
    await exposeVisitors(t, page.slug, visitors.A.slice(0, 1));
    await exposeVisitors(t, page.slug, visitors.A.slice(0, 1)); // Repeated renders from the same assignment are one exposure.
    await t.mutation(api.landing.submit, { slug: page.slug, name: "A1", email: "a1@x.example", visitorKey: visitors.A[0].key, testId: visitors.A[0].testId });
    await t.mutation(api.landing.submit, { slug: page.slug, name: "A1", email: "a1@x.example", visitorKey: visitors.A[0].key, testId: visitors.A[0].testId });
    await exposeVisitors(t, page.slug, visitors.B.slice(0, 18));
    for (let i = 0; i < 17; i++) await t.mutation(api.landing.submit, { slug: page.slug, name: `B${i}`, email: `b${i}@x.example`, visitorKey: visitors.B[i].key, testId: visitors.B[i].testId });
    await exposeVisitors(t, page.slug, visitors.A.slice(1));
    await exposeVisitors(t, page.slug, visitors.B.slice(18));
    const [maturing] = await owner.client.query(api.abtests.forTarget, { slug, targetId: id });
    expect(maturing).toMatchObject({ status: "maturing", outcomeWindowDays: 1, winner: null, confidence: 0 });
    await expect(owner.client.mutation(api.abtests.startLanding, { slug, pageId: id, headline: "A second test" })).rejects.toThrow(/already active/);
    await t.mutation(internal.abtests.finalize, { testId: maturing.id });
    expect((await owner.client.query(api.abtests.forTarget, { slug, targetId: id }))[0].status).toBe("maturing");
    // One delayed lead inside the declared window still contributes before the decision is read.
    await t.mutation(api.landing.submit, { slug: page.slug, name: "B17", email: "b17@x.example", visitorKey: visitors.B[17].key, testId: visitors.B[17].testId });
    expect((await owner.client.query(api.abtests.forTarget, { slug, targetId: id }))[0].stats[1]).toMatchObject({ wins: 18 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [test] = await owner.client.query(api.abtests.forTarget, { slug, targetId: id });
    expect(test).toMatchObject({ status: "done", winner: "B" });
    expect(test.stats).toMatchObject([
      { key: "A", assigned: expect.any(Number), exposed: 500, trials: 500, wins: 1 },
      { key: "B", assigned: expect.any(Number), exposed: 500, trials: 500, wins: 18 },
    ]);
    // A conversion after the window is retained on its assignment but doesn't change the frozen decision.
    await t.mutation(api.landing.submit, { slug: page.slug, name: "B18", email: "b18@x.example", visitorKey: visitors.B[18].key, testId: visitors.B[18].testId });
    expect((await owner.client.query(api.abtests.forTarget, { slug, targetId: id }))[0].stats[1]).toMatchObject({ wins: 18 });
    const lateHash = await sha256Hex(`abTestAssignment:v1|${test.id}|${visitors.B[18].key}`);
    const late = await t.run(async (ctx) => ctx.db.query("abTestAssignments").withIndex("by_test_subject", (q) => q.eq("testId", test.id).eq("subjectHash", lateHash)).first());
    expect(late?.outcomeAt).toBeTypeOf("number");
    expect((await owner.client.query(api.landing.list, { slug })).pages[0].content?.headline).toBe("Double your leads in 30 days");
    expect((await t.query(api.landing.publicPage, { slug: page.slug }))?.test).toBeNull();
  }, 15_000);

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
    let visitorKey = "";
    let testId: Id<"abTests"> | null = null;
    for (let i = 0; i < 10 && !visitorKey; i++) {
      const key = `srm-test-visitor-${i.toString().padStart(8, "0")}`;
      const assigned = await t.mutation(api.landing.assignLanding, { slug: page.slug, visitorKey: key });
      if (assigned.variant === "A" && assigned.testId) { visitorKey = key; testId = assigned.testId; }
    }
    expect(visitorKey).toBeTruthy();
    await t.run(async (ctx) => ctx.db.patch(started.id, {
      stats: [{ key: "A", assigned: 900, exposed: 899, trials: 899, wins: 1 }, { key: "B", assigned: 100, exposed: 100, trials: 100, wins: 50 }],
    }));
    await t.mutation(api.landing.viewed, { slug: page.slug, visitorKey, testId: testId! });

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
