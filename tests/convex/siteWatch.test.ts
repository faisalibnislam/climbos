import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("site watch (keeps researching the business)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_SITE_TEXT;
  });

  it("first read is a free baseline; a real change proposes facts to confirm", async () => {
    const t = setup();
    const owner = await asNewUser(t, "site@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations"> });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))?.siteCheckedAt).toBeTruthy();
    expect(await t.run(async (ctx) => (await ctx.db.query("workflowRuns").collect()).filter((r) => r.kind === "site_watch").length)).toBe(0);

    process.env.CLIMBOS_FAKE_SITE_TEXT = "Plans from $14/mo\nNew: team plan for agencies with 10 seats included";
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations"> });
    const f = await owner.client.query(api.siteWatch.facts, { slug });
    const pending = f!.facts.filter((x) => x.state === "needs_review" && x.provenance === "researched");
    expect(pending.length).toBeGreaterThan(0);
    await owner.client.mutation(api.siteWatch.confirmUpdate, { slug, factId: pending[0].id });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))!.facts.find((x) => x.id === pending[0].id)?.state).toBe("confirmed");
    expect((await owner.client.query(api.team.myNotices, {})).items.some((n) => /website changed/.test(n.text))).toBe(true);
  });

  it("surfaces conflicting confirmed prices with links to the facts that disagree", async () => {
    const t = setup();
    const owner = await asNewUser(t, "conflict@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    const firstId = await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "The Pro plan costs $19 per month." });
    const secondId = await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "The Pro plan costs $24 per month." });

    const facts = await owner.client.query(api.siteWatch.facts, { slug });
    expect(facts?.conflicts).toEqual([expect.objectContaining({
      subject: "Pro price per month",
      values: ["$19", "$24"],
      factIds: expect.arrayContaining([firstId, secondId]),
      facts: expect.arrayContaining([
        expect.objectContaining({ id: firstId, statement: "The Pro plan costs $19 per month." }),
        expect.objectContaining({ id: secondId, statement: "The Pro plan costs $24 per month." }),
      ]),
    })]);
  });

  it("queues a permission-checked, bounded homepage readiness scan", async () => {
    const t = setup();
    const owner = await asNewUser(t, "readiness@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Site Co", website: "https://site.example" });
    expect(await owner.client.query(api.siteWatch.searchReadiness, { slug })).toEqual({ website: "https://site.example", scan: null });
    await owner.client.mutation(api.siteWatch.scanSearchReadiness, { slug });
    const result = await owner.client.query(api.siteWatch.searchReadiness, { slug });
    expect(result?.scan).toEqual(expect.objectContaining({ status: "queued", startedAt: expect.any(Number) }));
    const viewer = await asNewUser(t, "readiness-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.query(api.siteWatch.searchReadiness, { slug })).resolves.toMatchObject({ website: "https://site.example" });
    await expect(viewer.client.mutation(api.siteWatch.scanSearchReadiness, { slug })).rejects.toThrow(/role \(viewer\) can't/);
  });
});
