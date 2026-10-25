import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

/** Admin panel: staff roles, comps, credits, live locks and the read-only support view. */

async function customer(t: T, email = "cust@example.com") {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Cust Co" });
  const accountId = (await t.run(async (ctx) => (await ctx.db.get(orgId as Id<"organizations">))!.accountId))!;
  return { ...owner, slug, orgId: orgId as Id<"organizations">, accountId };
}

describe("admin panel", () => {
  it("non-staff see nothing; the OPS_EMAILS owner can add admins and support", async () => {
    const t = setup();
    const c = await customer(t);
    expect(await c.client.query(api.admin.me, {})).toBeNull();
    await expect(c.client.query(api.admin.searchAccounts, {})).rejects.toThrow(/Not found/);
    const ops = await asNewUser(t, "ops@example.com");
    expect(await ops.client.query(api.admin.me, {})).toMatchObject({ role: "owner" });
    await ops.client.mutation(api.admin.setStaff, { email: "help@example.com", role: "support" });
    const help = await asNewUser(t, "help@example.com");
    expect(await help.client.query(api.admin.me, {})).toMatchObject({ role: "support" });
    // Support can't change staff or money settings, and grants are capped.
    await expect(help.client.mutation(api.admin.setStaff, { email: "x@example.com", role: "admin" })).rejects.toThrow(/staff role/);
    await expect(help.client.mutation(api.admin.grantCredits, { accountId: c.accountId, credits: 900, reason: "x" })).rejects.toThrow(/up to 500/);
    await help.client.mutation(api.admin.grantCredits, { accountId: c.accountId, credits: 300, reason: "goodwill" });
    expect((await c.client.query(api.workspace.credits, { slug: c.slug })).available).toBe(350);
    const rows = await ops.client.query(api.admin.searchAccounts, { q: "cust" });
    expect(rows[0]).toMatchObject({ ownerEmail: "cust@example.com", credits: 350 });
  });

  it("a comp unlocks the package with its monthly credits and renews until it ends", async () => {
    const t = setup();
    const c = await customer(t, "comp@example.com");
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.compPackage, { accountId: c.accountId, planKey: "pro", months: 2, reason: "owner testing" });
    const bal = await c.client.query(api.workspace.credits, { slug: c.slug });
    expect(bal.paid).toBe(true);
    expect(bal.monthly.total).toBe(3_000);
    expect(await c.client.query(api.workspace.aiMode, { slug: c.slug })).toMatchObject({ expertUnlocked: true, mode: "expert" });
    // A month later, the comp rolls into a fresh month of credits.
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("subscriptions").collect())[0];
      await ctx.db.patch(s._id, { currentPeriodEnd: Date.now() - 1000 });
    });
    expect(await t.mutation(internal.admin.renewComps, {})).toBe(1);
  });

  it("an active comp can be upgraded in place: Pro credits this month, new length from today, audited", async () => {
    const t = setup();
    const c = await customer(t, "upgrade@example.com");
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.compPackage, { accountId: c.accountId, planKey: "starter", months: 1, reason: "trial" });
    expect((await c.client.query(api.workspace.credits, { slug: c.slug })).monthly.total).toBe(1_100);
    const sub = await t.run(async (ctx) => (await ctx.db.query("subscriptions").collect())[0]);
    await ops.client.mutation(api.admin.changeComp, { subscriptionId: sub._id, planKey: "pro", months: 6, reason: "owner testing" });
    expect((await c.client.query(api.workspace.credits, { slug: c.slug })).monthly.total).toBe(3_000);
    const after = await t.run(async (ctx) => (await ctx.db.get(sub._id))!);
    expect(after.planKey).toBe("pro");
    expect(after.comp!.until).toBeGreaterThan(Date.now() + 170 * 86_400_000);
    // A downgrade keeps this month's credits (applies at renewal); customers can't call it.
    await ops.client.mutation(api.admin.changeComp, { subscriptionId: sub._id, planKey: "starter", months: 6, reason: "back to starter" });
    expect((await c.client.query(api.workspace.credits, { slug: c.slug })).monthly.total).toBe(3_000);
    await expect(c.client.mutation(api.admin.changeComp, { subscriptionId: sub._id, planKey: "pro", months: 6, reason: "x" })).rejects.toThrow(/Not found/);
    const detail = await ops.client.query(api.admin.accountDetail, { accountId: c.accountId });
    expect(detail!.audit.some((a: { action: string }) => a.action === "admin.comp_changed")).toBe(true);
  });

  it("onboarding step 1 unlocks Expert for an account with a comped package (new workspaces join that account)", async () => {
    const t = setup();
    const c = await customer(t, "step1@example.com");
    expect(await c.client.query(api.orgs.newWorkspaceAiMode, {})).toMatchObject({
      expertUnlocked: false,
      estimates: { onboarding_research: { basic: expect.any(Number), expert: expect.any(Number) } },
    });
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.compPackage, { accountId: c.accountId, planKey: "pro", months: 1, reason: "owner" });
    expect(await c.client.query(api.orgs.newWorkspaceAiMode, {})).toMatchObject({
      expertUnlocked: true,
      estimates: { onboarding_research: { basic: expect.any(Number), expert: expect.any(Number) } },
    });
  });

  it("live feature locks: setting autopilot free unlocks it for free accounts; admins can't change money settings", async () => {
    const t = setup();
    const c = await customer(t, "lock@example.com");
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.setStaff, { email: "adm@example.com", role: "admin" });
    const adm = await asNewUser(t, "adm@example.com");
    const { config } = await adm.client.query(api.admin.config, {});
    await adm.client.mutation(api.admin.setConfig, { value: JSON.stringify({ ...config, features: { ...config.features, autopilot: "free" } }) });
    await c.client.mutation(api.autopilot.save, { slug: c.slug, enabled: true, mode: "always_ask", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await expect(adm.client.mutation(api.admin.setConfig, { value: JSON.stringify({ ...config, freeCredits: 999 }) })).rejects.toThrow(/staff role/);
    await ops.client.mutation(api.admin.setConfig, { value: JSON.stringify({ ...config, freeCredits: 120 }) });
    const n = await customer(t, "new@example.com");
    expect((await n.client.query(api.workspace.credits, { slug: n.slug })).available).toBe(120);
  });

  it("support's view-as is read-only and shows in the workspace's activity", async () => {
    const t = setup();
    const c = await customer(t, "view@example.com");
    const ops = await asNewUser(t, "ops@example.com");
    await expect(ops.client.query(api.workspace.credits, { slug: c.slug })).rejects.toThrow(/couldn't find/);
    await ops.client.mutation(api.admin.startViewAs, { orgId: c.orgId, reason: "ticket 12" });
    await expect(ops.client.query(api.workspace.credits, { slug: c.slug })).resolves.toBeTruthy();
    await expect(ops.client.mutation(api.workspace.setAiMode, { slug: c.slug, mode: "basic" })).rejects.toThrow(/read-only|can't/);
    const events = await t.run(async (ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", c.orgId)).collect());
    expect(events.some((e) => e.action === "support.viewed")).toBe(true);
  });
});
