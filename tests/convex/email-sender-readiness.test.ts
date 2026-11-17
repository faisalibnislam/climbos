import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

const state = vi.hoisted(() => ({ calls: 0, afterRead: null as null | (() => Promise<void>) }));
vi.mock("../../shared/integrations/resendMarketing", async original => ({
  ...await original<typeof import("../../shared/integrations/resendMarketing")>(),
  checkSenderDomain: vi.fn(async () => { state.calls++; await state.afterRead?.(); return { domain: "example.com", state: "verified", checkedAt: Date.now(), sourceUrl: "https://api.resend.com/domains/fixture", message: "Provider reports domain setup verified." }; }),
}));
afterEach(() => { state.calls = 0; state.afterRead = null; });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "sender-owner@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Sender setup" });
  const connect = () => t.mutation(internal.connections.storeConnection, { orgId, userId: owner.userId, provider: "email_resend", secret: JSON.stringify({ apiKey: "re_fixture" }), secretKind: "api_key", scopes: [] });
  const connectionId = await connect();
  return { t, owner, orgId, slug, connectionId, connect };
}
it("stores a minimal observation and audit without approvals, scheduling, or recipient changes", async () => {
  const f = await fixture();
  const report = await f.owner.client.action(api.marketing.checkSender, { slug: f.slug, from: "Owner <hello@example.com>" });
  expect(report.state).toBe("verified");
  expect((await f.owner.client.query(api.marketing.audience, { slug: f.slug })).senderReadiness).toEqual(report);
  const rows = await f.t.run(async ctx => ({ approvals: await ctx.db.query("approvals").collect(), contacts: await ctx.db.query("contacts").collect(), scheduled: await ctx.db.system.query("_scheduled_functions").collect(), audit: await ctx.db.query("auditEvents").collect() }));
  expect(rows.approvals).toEqual([]); expect(rows.contacts).toEqual([]);
  expect(rows.scheduled.some(row => row.name.includes("marketing"))).toBe(false);
  expect(rows.audit.filter(row => row.action === "email.sender_checked")).toHaveLength(1);
  expect(JSON.stringify(report)).not.toContain("re_fixture");
});
it("refuses another tenant and viewers before querying the provider", async () => {
  const f = await fixture(), outsider = await asNewUser(f.t, "sender-outsider@example.com");
  await expect(outsider.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: outsider.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  await expect(outsider.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" })).rejects.toThrow();
  expect(state.calls).toBe(0);
});
it.each(["rotation", "disconnect", "membership"])("refuses a report if %s changes during its read", async change => {
  const f = await fixture();
  state.afterRead = async () => {
    if (change === "rotation") await f.connect();
    else if (change === "disconnect") await f.t.run(ctx => ctx.db.patch(f.connectionId, { status: "revoked" }));
    else await f.t.run(async ctx => { const m = (await ctx.db.query("memberships").collect()).find(m => m.orgId === f.orgId && m.userId === f.owner.userId)!; await ctx.db.patch(m._id, { role: "viewer" }); });
  };
  await expect(f.owner.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" })).rejects.toThrow();
  expect((await f.t.run(ctx => ctx.db.get(f.connectionId)))?.emailSenderReadiness).toBeUndefined();
});
it("hides observations after credential rotation or disconnect", async () => {
  const f = await fixture();
  await f.owner.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" });
  await f.connect();
  expect((await f.owner.client.query(api.marketing.audience, { slug: f.slug })).senderReadiness).toBeNull();
  await f.owner.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" });
  await f.t.run(ctx => ctx.db.patch(f.connectionId, { status: "revoked" }));
  expect((await f.owner.client.query(api.marketing.audience, { slug: f.slug })).senderReadiness).toBeNull();
});
it("allows a reviewer to inspect sender setup without granting send approval", async () => {
  const f = await fixture(), reviewer = await asNewUser(f.t, "sender-reviewer@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: reviewer.userId, role: "reviewer", status: "active", createdAt: Date.now() }));
  expect((await reviewer.client.action(api.marketing.checkSender, { slug: f.slug, from: "hello@example.com" })).state).toBe("verified");
  expect(await f.t.run(ctx => ctx.db.query("approvals").collect())).toEqual([]);
});
