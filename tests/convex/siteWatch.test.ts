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
});
