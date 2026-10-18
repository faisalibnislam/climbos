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
