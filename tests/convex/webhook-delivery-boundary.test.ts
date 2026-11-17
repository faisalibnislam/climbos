import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signWebhook } from "../../shared/webhooks";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
const NOW = Date.UTC(2026, 10, 17, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); dns.lookup.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]); });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "hooks-boundary@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Hooks boundary" });
  const endpoint = await owner.client.mutation(api.webhooks.create, { slug: w.slug, url: "https://hooks.example.com/events", events: ["lead.created"] });
  const id = await t.run(ctx => ctx.db.insert("webhookDeliveries", { orgId: w.orgId, endpointId: endpoint.id, event: "lead.created", payload: JSON.stringify({ event: "lead.created", createdAt: new Date(NOW).toISOString(), data: { name: "Synthetic lead" } }), status: "pending", attempts: 0, nextAt: NOW, createdAt: NOW }));
  return { t, owner, ...w, endpointId: endpoint.id, secret: endpoint.secret, id };
}
it("does not claim an external delivery while its workspace is paused", async () => {
  const f = await fixture();
  await f.owner.client.mutation(api.workspace.pauseAll, { slug: f.slug });
  expect(await f.t.mutation(internal.webhooks.claimDue, {})).toEqual([]);
});
it("rejects a cross-tenant endpoint reference instead of sending another workspace's data", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other-hooks@example.com");
  const w = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other hooks" });
  const endpoint = await other.client.mutation(api.webhooks.create, { slug: w.slug, url: "https://other.example.com/hook", events: ["lead.created"] });
  await f.t.run(ctx => ctx.db.patch(f.id, { endpointId: endpoint.id }));
  expect((await other.client.query(api.webhooks.list, { slug: w.slug })).endpoints[0].recent).toEqual([]);
  expect(await f.t.mutation(internal.webhooks.claimDue, {})).toEqual([]);
});
it("does not accept inherited object properties as subscribed events", async () => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.webhooks.create, { slug: f.slug, url: "https://hooks.example.com/other", events: ["constructor"] })).rejects.toThrow();
});
it("fences a late response from an expired attempt and keeps a signed stable delivery id", async () => {
  const f = await fixture();
  const [first] = await f.t.mutation(internal.webhooks.claimDue, {});
  const original = await f.t.mutation(internal.webhooks.authorizeDispatch, first);
  expect(JSON.parse(original!.payload).deliveryId).toBe(f.id);
  expect(await f.t.mutation(internal.webhooks.authorizeDispatch, first)).toBeNull();
  vi.setSystemTime(NOW + 121_000);
  const [second] = await f.t.mutation(internal.webhooks.claimDue, {});
  expect(second.claimToken).not.toBe(first.claimToken);
  await f.t.mutation(internal.webhooks.record, { id: f.id, claimToken: first.claimToken, code: 200, ok: true });
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "sending", attempts: 2, claimToken: second.claimToken });
  const current = await f.t.mutation(internal.webhooks.authorizeDispatch, second);
  expect(current!.payload).toBe(original!.payload);
  await f.t.mutation(internal.webhooks.record, { id: f.id, claimToken: second.claimToken, code: 200, ok: true });
  await f.t.mutation(internal.webhooks.record, { id: f.id, claimToken: first.claimToken, code: 500, ok: false });
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "delivered", attempts: 2 });
  expect((await f.t.run(ctx => ctx.db.get(f.endpointId)))?.failures).toBe(0);
});
it.each(["paused", "disabled", "url", "payload", "subscription", "fleet", "suspended"])("rechecks %s after claim before authorizing the external request", async fault => {
  const f = await fixture(); const [claim] = await f.t.mutation(internal.webhooks.claimDue, {});
  await f.t.run(async ctx => {
    if (fault === "paused") await ctx.db.patch(f.orgId, { emergencyStop: { active: true, at: NOW, by: f.owner.userId, reason: "Owner pause" } });
    if (fault === "suspended") await ctx.db.patch(f.orgId, { suspendedAt: NOW });
    if (fault === "disabled") await ctx.db.patch(f.endpointId, { active: false });
    if (fault === "url") await ctx.db.patch(f.endpointId, { url: "https://changed.example.com/path" });
    if (fault === "subscription") await ctx.db.patch(f.endpointId, { events: ["booking.created"] });
    if (fault === "payload") await ctx.db.patch(f.id, { payload: JSON.stringify({ event: "lead.created", data: { changed: true } }) });
    if (fault === "fleet") await ctx.db.insert("fleetControls", { key: "global", emergencyStop: true, circuits: [], previewDailyBudgetMicros: 0, updatedAt: NOW });
  });
  expect(await f.t.mutation(internal.webhooks.authorizeDispatch, claim)).toBeNull();
  const row = await f.t.run(ctx => ctx.db.get(f.id));
  expect(row?.dispatchStartedAt).toBeUndefined();
});
it("bounds retries even when every worker disappears without recording a response", async () => {
  const f = await fixture();
  for (let i = 0; i < 6; i++) {
    vi.setSystemTime(NOW + i * 121_000);
    expect(await f.t.mutation(internal.webhooks.claimDue, {})).toHaveLength(1);
  }
  vi.setSystemTime(NOW + 6 * 121_000);
  expect(await f.t.mutation(internal.webhooks.claimDue, {})).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "failed", attempts: 6 });
});
it("rejects overlong destination URLs instead of silently changing them", async () => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.webhooks.create, { slug: f.slug, url: `https://hooks.example.com/${"a".repeat(1000)}`, events: ["lead.created"] })).rejects.toThrow();
});

it("signs the stable delivery id, preserves payload across retries and does not follow redirects", async () => {
  const f = await fixture(); vi.stubEnv("CLIMBOS_FAKE_WEBHOOKS", "");
  const send = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response("", { status: 200 }));
  vi.stubGlobal("fetch", send);
  await f.t.action(internal.webhooks.deliverDue, {});
  vi.setSystemTime(NOW + 60_001);
  await f.t.action(internal.webhooks.deliverDue, {});
  expect(send).toHaveBeenCalledTimes(2);
  const first = send.mock.calls[0][1] as RequestInit;
  const second = send.mock.calls[1][1] as RequestInit;
  expect(first.redirect).toBe("manual"); expect(second.body).toBe(first.body);
  expect(JSON.parse(first.body as string).deliveryId).toBe(f.id);
  const headers = first.headers as Record<string, string>;
  expect(headers["X-ClimbOS-Delivery-Id"]).toBe(f.id);
  expect(headers["X-ClimbOS-Signature"]).toBe(`v1=${await signWebhook(f.secret, Number(headers["X-ClimbOS-Timestamp"]), first.body as string)}`);
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "delivered", attempts: 2 });
});
it.each([{ records: [] }, { records: [{ address: "127.0.0.1", family: 4 }] }, { records: [{ address: "8.8.8.8", family: 4 }, { address: "10.1.2.3", family: 4 }] }])("does not POST when DNS is empty, private or mixed (%j)", async ({ records }) => {
  const f = await fixture(); vi.stubEnv("CLIMBOS_FAKE_WEBHOOKS", "");
  dns.lookup.mockResolvedValueOnce(records);
  const send = vi.fn(); vi.stubGlobal("fetch", send);
  await f.t.action(internal.webhooks.deliverDue, {});
  expect(send).not.toHaveBeenCalled();
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.lastError).toContain("No request started");
});
it("rechecks workspace pause after DNS and before fetch", async () => {
  const f = await fixture(); vi.stubEnv("CLIMBOS_FAKE_WEBHOOKS", "");
  dns.lookup.mockImplementationOnce(async () => {
    await f.owner.client.mutation(api.workspace.pauseAll, { slug: f.slug });
    return [{ address: "8.8.8.8", family: 4 }];
  });
  const send = vi.fn(); vi.stubGlobal("fetch", send);
  await f.t.action(internal.webhooks.deliverDue, {});
  expect(send).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "pending", attempts: 0 });
});
it("denies other tenants and viewers control over a destination", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "foreign-controller@example.com"), viewer = await asNewUser(f.t, "read-only@example.com");
  const w = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other controller" });
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  await expect(other.client.mutation(api.webhooks.setActive, { slug: w.slug, id: f.endpointId, active: false })).rejects.toThrow();
  await expect(other.client.mutation(api.webhooks.test, { slug: w.slug, id: f.endpointId })).rejects.toThrow();
  await expect(other.client.mutation(api.webhooks.remove, { slug: w.slug, id: f.endpointId })).rejects.toThrow();
  await expect(viewer.client.mutation(api.webhooks.test, { slug: f.slug, id: f.endpointId })).rejects.toThrow();
  await expect(f.t.mutation(api.webhooks.test, { slug: f.slug, id: f.endpointId })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("webhookDeliveries").collect())).toHaveLength(1);
});
it("refuses a requested test while paused and does not report contradictory HTTP success", async () => {
  const f = await fixture(); const [claim] = await f.t.mutation(internal.webhooks.claimDue, {});
  await f.t.mutation(internal.webhooks.authorizeDispatch, claim);
  await f.t.mutation(internal.webhooks.record, { id: claim.id, claimToken: claim.claimToken, code: 500, ok: true });
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.status).toBe("sending");
  await f.owner.client.mutation(api.workspace.pauseAll, { slug: f.slug });
  await expect(f.owner.client.mutation(api.webhooks.test, { slug: f.slug, id: f.endpointId })).rejects.toThrow(/resume/);
  expect(await f.t.run(ctx => ctx.db.query("webhookDeliveries").collect())).toHaveLength(1);
});

it.each(["sending", "pending"] as const)("does not automatically replay a legacy %s attempt without a signed identity", async status => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.id, { status, attempts: status === "pending" ? 1 : 0 }));
  expect(await f.t.mutation(internal.webhooks.claimDue, {})).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "failed" });
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.lastError).toContain("No automatic replay");
});
