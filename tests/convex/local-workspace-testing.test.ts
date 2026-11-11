import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

it("removes only the authorized local owner's workspace count limit without refilling their wallet", async () => {
  vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH", "true");
  vi.stubEnv("SITE_URL", "http://127.0.0.1:3430");
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const t = setup();
  const owner = await asNewUser(t, "local-count@example.com");
  const args = { businessName: "Isolated local count test" };
  const first = await owner.client.mutation(api.orgs.createWorkspace, args);
  await expect(owner.client.mutation(api.orgs.createWorkspace, args)).rejects.toThrow(/one workspace/);
  await expect(t.mutation(internal.localResearch.enableWorkspaceTesting, { ownerEmail: "local-count@example.com" })).rejects.toThrow(/existing owner-authorized/);
  const before = await t.run(async ctx => {
    const period = (await ctx.db.query("usagePeriods").collect())[0];
    await ctx.db.patch(period._id, { walletCapMicros: 6_000_000, walletSpentMicros: 123_000, walletReservedMicros: 45_000 });
    return (await ctx.db.get(period._id))!;
  });
  expect(await t.mutation(internal.localResearch.enableWorkspaceTesting, { ownerEmail: "local-count@example.com" })).toEqual({ enabled: true, aiBudgetChanged: false });
  const second = await owner.client.mutation(api.orgs.createWorkspace, args);
  expect(second.orgId).not.toBe(first.orgId);
  expect((await owner.client.query(api.workspace.credits, { slug: second.slug })).isLocalEvaluation).toBe(true);
  await t.run(async ctx => {
    const org1 = await ctx.db.get(first.orgId), org2 = await ctx.db.get(second.orgId);
    expect(org2?.accountId).toBe(org1?.accountId);
    expect(await ctx.db.query("usagePeriods").collect()).toEqual([before]);
    expect(await ctx.db.query("subscriptions").collect()).toHaveLength(0);
    expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(0);
  });
  const other = await asNewUser(t, "other-count@example.com");
  await other.client.mutation(api.orgs.createWorkspace, args);
  await expect(other.client.mutation(api.orgs.createWorkspace, args)).rejects.toThrow(/one workspace/);
  vi.stubEnv("SITE_URL", "https://climbos.app");
  await expect(owner.client.mutation(api.orgs.createWorkspace, args)).rejects.toThrow(/one workspace/);
  await expect(t.mutation(internal.localResearch.enableWorkspaceTesting, { ownerEmail: "local-count@example.com" })).rejects.toThrow(/loopback/);
});
