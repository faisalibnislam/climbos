import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { publicHttpsUrl } from "../../convex/webhooks";
import { taskeniBase } from "../../convex/airlyActions";
import { sha256Hex } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Platform fixes: webhook queue, integrations, teams, deletion, staff and security checks. */

const DAY = 86_400_000;

async function owned(t: T, email = "owner@example.com", businessName = "Ops Co") {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName });
  const accountId = (await t.run(async (ctx) => (await ctx.db.get(orgId as Id<"organizations">))!.accountId))!;
  return { ...owner, slug, orgId: orgId as Id<"organizations">, accountId };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const k of ["CLIMBOS_FAKE_WEBHOOKS", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"]) delete process.env[k];
});

describe("outgoing webhooks", () => {
  it("rejects private and IP-literal hosts", () => {
    expect(publicHttpsUrl("https://hooks.zapier.com/hooks/catch/1/abc")).toBe(true);
    for (const bad of ["http://hooks.zapier.com/x", "https://10.0.0.5/x", "https://192.168.1.2/x", "https://[::1]/x", "https://100.64.1.1/x", "https://localhost/x", "https://metadata.google.internal/x", "https://user:pw@hooks.example.com/x"]) {
      expect(publicHttpsUrl(bad)).toBe(false);
    }
  });

  it("closes rows of switched-off endpoints so they never block the queue, and claims rows once", async () => {
    const t = setup();
    const o = await owned(t);
    const { id: dead } = await o.client.mutation(api.webhooks.create, { slug: o.slug, url: "https://dead.example.com/hook", events: ["lead.created"] });
    const { id: live } = await o.client.mutation(api.webhooks.create, { slug: o.slug, url: "https://live.example.com/hook", events: ["lead.created"] });
    await o.client.mutation(api.webhooks.setActive, { slug: o.slug, id: dead, active: false });
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) await ctx.db.insert("webhookDeliveries", { orgId: o.orgId, endpointId: dead, event: "lead.created", payload: "{}", status: "pending", attempts: 0, nextAt: now - 10_000 + i, createdAt: now });
      await ctx.db.insert("webhookDeliveries", { orgId: o.orgId, endpointId: live, event: "lead.created", payload: "{}", status: "pending", attempts: 0, nextAt: now - 1, createdAt: now });
    });
    expect(await t.mutation(internal.webhooks.claimDue, {})).toHaveLength(0);
    const claimed = await t.mutation(internal.webhooks.claimDue, {});
    expect(claimed.map((c) => c.url)).toEqual(["https://live.example.com/hook"]);
    // A second deliverer (cron or another event) gets nothing while the lease holds.
    expect(await t.mutation(internal.webhooks.claimDue, {})).toHaveLength(0);
    await t.mutation(internal.webhooks.record, { id: claimed[0].id, code: 200, ok: true });
    await t.mutation(internal.webhooks.record, { id: claimed[0].id, code: 200, ok: true });
    const rows = await t.run(async (ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(rows.filter((r) => r.status === "pending" || r.status === "sending")).toHaveLength(0);
    expect(rows.find((r) => r.endpointId === live)).toMatchObject({ status: "delivered", attempts: 1 });
  });

  it("switching an endpoint off drops its pending deliveries", async () => {
    const t = setup();
    const o = await owned(t);
    const { id } = await o.client.mutation(api.webhooks.create, { slug: o.slug, url: "https://hooks.example.com/x", events: ["lead.created"] });
    await t.run(async (ctx) => {
      await ctx.db.insert("webhookDeliveries", { orgId: o.orgId, endpointId: id, event: "lead.created", payload: "{}", status: "pending", attempts: 0, nextAt: Date.now() + DAY, createdAt: Date.now() });
    });
    await o.client.mutation(api.webhooks.setActive, { slug: o.slug, id, active: false });
    const rows = await t.run(async (ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(rows[0].status).toBe("failed");
  });
});

describe("Airly links", () => {
  it("only accepts Taskeni's own hosts or its Convex deployment", () => {
    expect(taskeniBase("https://happy-cat-123.convex.site/api/v1")).toBe("https://happy-cat-123.convex.site/api/v1");
    expect(taskeniBase("https://app.taskeni.app/api/v1/")).toBe("https://app.taskeni.app/api/v1");
    for (const bad of ["https://evil.example.com/api/v1", "http://happy-cat-123.convex.site/api/v1", "https://10.0.0.1/api/v1", "https://app.taskeni.app:8443/api/v1", "https://app.taskeni.app/api/v2"]) expect(taskeniBase(bad)).toBeNull();
  });

  it("a transient error backs off and keeps the link; a rejected token stops it", async () => {
    const t = setup();
    const o = await owned(t);
    let status = 200;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (status === 200 ? new Response(JSON.stringify({ data: [] }), { status }) : new Response(JSON.stringify({ error: "nope" }), { status }))),
    );
    expect(await o.client.action(api.airlyActions.connect, { slug: o.slug, app: "formkit", token: `fk_live_${"a".repeat(48)}` })).toMatchObject({ ok: true });
    const link = async () => (await t.run(async (ctx) => ctx.db.query("airlyLinks").collect()))[0];
    status = 503;
    await t.action(internal.airlyActions.syncOne, { id: (await link())._id });
    expect(await link()).toMatchObject({ status: "connected", failures: 1 });
    expect((await link()).retryAt!).toBeGreaterThan(Date.now());
    // In backoff: skipped by the 15-minute sync.
    expect(await t.query(internal.airly.syncTargets, {})).toHaveLength(0);
    status = 401;
    await t.action(internal.airlyActions.syncOne, { id: (await link())._id });
    expect((await link()).status).toBe("error");
  });
});

describe("teams", () => {
  it("expired invites don't hold seats, one person invited twice is one seat, and cleanup closes expired invites", async () => {
    const t = setup();
    const o = await owned(t);
    const now = Date.now();
    await t.run(async (ctx) => {
      const { _id, _creationTime, ...rest } = (await ctx.db.get(o.orgId))!;
      void _id;
      void _creationTime;
      const second = await ctx.db.insert("organizations", { ...rest, slug: "ops-co-2", name: "Ops Co 2" });
      for (const orgId of [o.orgId, second]) await ctx.db.insert("memberships", { orgId, role: "editor", status: "invited", invitedEmail: "pat@example.com", inviteExpiresAt: now + DAY, createdAt: now });
      await ctx.db.insert("memberships", { orgId: o.orgId, role: "editor", status: "invited", invitedEmail: "old@example.com", inviteExpiresAt: now - DAY, createdAt: now - 8 * DAY });
      await ctx.db.insert("memberships", { orgId: o.orgId, role: "editor", status: "invited", invitedEmail: "owner@example.com", inviteExpiresAt: now + DAY, createdAt: now });
    });
    const seats = await t.run(async (ctx) => {
      const { seatState } = await import("../../convex/lib/accounts");
      return (await seatState(ctx, (await ctx.db.get(o.orgId))!)).used;
    });
    expect(seats).toBe(2); // the owner + pat
    await t.mutation(internal.team.cleanup, {});
    const old = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((m) => m.invitedEmail === "old@example.com"));
    expect(old?.status).toBe("removed");
  });

  it("only the account owner sets a workspace's credit cap", async () => {
    const t = setup();
    const o = await owned(t);
    const coOwner = await asNewUser(t, "client-owner@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", { orgId: o.orgId, userId: coOwner.userId, role: "owner", status: "active", createdAt: Date.now() });
    });
    await expect(coOwner.client.mutation(api.team.setWorkspaceCap, { slug: o.slug, orgId: o.orgId, credits: 10 })).rejects.toThrow(/account owner/);
    await o.client.mutation(api.team.setWorkspaceCap, { slug: o.slug, orgId: o.orgId, credits: 10 });
  });
});

describe("workspace deletion", () => {
  it("purges integrations, keys, sales data and media, and ends the package with the last workspace", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const t = setup();
    const o = await owned(t, "del@example.com", "Delete Me");
    await makePaid(t, o.orgId);
    await o.client.mutation(api.webhooks.create, { slug: o.slug, url: "https://hooks.example.com/x", events: ["lead.created"] });
    await o.client.mutation(api.agentTokens.create, { slug: o.slug, name: "Agent", scopes: [], days: 30 });
    await o.client.mutation(api.crm.create, { slug: o.slug, name: "Ana", email: "ana@x.example" });
    await t.run(async (ctx) => {
      await ctx.db.insert("airlyLinks", { orgId: o.orgId, app: "formkit", tokenCiphertext: "x", tokenIv: "x", tokenKeyId: "k1", status: "connected", imported: 0, createdBy: o.userId, createdAt: Date.now() });
    });
    expect((await o.client.query(api.settings.deletionImpact, { slug: o.slug })).packageEnds).toBe(true);
    const res = await o.client.mutation(api.settings.deleteWorkspace, { slug: o.slug, confirmName: "Delete Me" });
    expect(res.billing).toBe("canceling");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => ({
      airly: (await ctx.db.query("airlyLinks").withIndex("by_org", (q) => q.eq("orgId", o.orgId)).collect()).length,
      hooks: (await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", o.orgId)).collect()).length,
      tokens: (await ctx.db.query("agentTokens").withIndex("by_org", (q) => q.eq("orgId", o.orgId)).collect()).length,
      deals: (await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", o.orgId)).collect()).length,
      request: (await ctx.db.query("privacyRequests").withIndex("by_org", (q) => q.eq("orgId", o.orgId)).collect())[0]?.status,
    }));
    expect(left).toEqual({ airly: 0, hooks: 0, tokens: 0, deals: 0, request: "done" });
  });

  it("staff deletion stops work and purges too", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const t = setup();
    const o = await owned(t, "staffdel@example.com", "Staff Del");
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.deleteWorkspace, { orgId: o.orgId, confirmSlug: o.slug });
    const org = await t.run(async (ctx) => ctx.db.get(o.orgId));
    expect(org?.emergencyStop?.active).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const businesses = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", o.orgId)).collect());
    expect(businesses).toHaveLength(0);
  });
});

describe("connections", () => {
  it("flags each newly expiring token once, whatever the expired history", async () => {
    const t = setup();
    const o = await owned(t);
    const now = Date.now();
    await t.run(async (ctx) => {
      const base = { orgId: o.orgId, scopes: [], isFixture: false, createdBy: o.userId, createdAt: now, updatedAt: now };
      for (let i = 0; i < 250; i++) await ctx.db.insert("connections", { ...base, provider: "instagram", status: "expired", expiresAt: now - (i + 1) * DAY });
      await ctx.db.insert("connections", { ...base, provider: "instagram", status: "connected", expiresAt: now + DAY });
      // Google tokens renew from a refresh token: not marked expired here.
      await ctx.db.insert("connections", { ...base, provider: "ga4", status: "connected", expiresAt: now - 60_000 });
    });
    expect(await t.mutation(internal.maintenance.checkExpiry, {})).toBe(1);
    expect(await t.mutation(internal.maintenance.checkExpiry, {})).toBe(0);
    const ga4 = await t.run(async (ctx) => (await ctx.db.query("connections").collect()).find((c) => c.provider === "ga4"));
    expect(ga4?.status).toBe("connected");
  });

  it("the OAuth callback only completes for the signed-in user who started it", async () => {
    const t = setup();
    process.env.GOOGLE_OAUTH_CLIENT_ID = "g-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "g-secret";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const o = await owned(t);
    const { url } = await o.client.mutation(api.connections.startOAuth, { slug: o.slug, provider: "ga4" });
    const state = new URL(url).searchParams.get("state")!;
    const attacker = await asNewUser(t, "attacker@example.com");
    const res = await attacker.client.action(api.connectionActions.completeOAuth, { serverSecret: "test-server-secret", state, code: "attacker-code" });
    expect(res).toMatchObject({ ok: false, slug: "" });
    expect(fetchMock).not.toHaveBeenCalled();
    // Signed out: refused too.
    const { url: url2 } = await o.client.mutation(api.connections.startOAuth, { slug: o.slug, provider: "ga4" });
    expect(await t.action(api.connectionActions.completeOAuth, { serverSecret: "test-server-secret", state: new URL(url2).searchParams.get("state")!, code: "c" })).toMatchObject({ ok: false });
  });

  it("GA4 sync renews an expired Google token first; a refused refresh asks the owner to reconnect", async () => {
    const t = setup();
    process.env.GOOGLE_OAUTH_CLIENT_ID = "g-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "g-secret";
    const o = await owned(t);
    const urls: string[] = [];
    let refreshOk = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (String(url).includes("oauth2.googleapis.com/token")) {
          return refreshOk ? new Response(JSON.stringify({ access_token: "fresh", expires_in: 3600, token_type: "Bearer" }), { status: 200 }) : new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
        }
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      }),
    );
    const connectionId = await t.mutation(internal.connections.storeConnection, { orgId: o.orgId, userId: o.userId, provider: "ga4", secret: JSON.stringify({ accessToken: "stale", refreshToken: "rt" }), secretKind: "oauth", scopes: [], expiresAt: Date.now() - 60_000, externalAccountId: "properties/1" });
    await t.action(internal.connectionActions.syncGa4, { orgId: o.orgId });
    expect(urls[0]).toContain("oauth2.googleapis.com/token");
    const secret = await t.query(internal.connections.getSecret, { connectionId });
    expect(JSON.parse(secret!.value)).toMatchObject({ accessToken: "fresh", refreshToken: "rt" });
    await t.run(async (ctx) => {
      await ctx.db.patch(connectionId, { expiresAt: Date.now() - 1 });
    });
    refreshOk = false;
    await t.action(internal.connectionActions.syncGa4, { orgId: o.orgId });
    expect((await t.run(async (ctx) => ctx.db.get(connectionId)))?.status).toBe("expired");
  });

  it("GA4 sync stores explicit AI assistant referrals but excludes Google organic and tagged email", async () => {
    const t = setup();
    const o = await owned(t);
    const date = new Date(Date.now() - 3 * DAY).toISOString().slice(0, 10);
    await t.mutation(internal.connections.storeConnection, {
      orgId: o.orgId,
      userId: o.userId,
      provider: "ga4",
      secret: JSON.stringify({ accessToken: "google-token" }),
      secretKind: "oauth",
      scopes: [],
      externalAccountId: "properties/1",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      dimensionHeaders: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }, { name: "purchaseRevenue" }],
      rowCount: 3,
      rows: [
        { dimensionValues: [{ value: date.replaceAll("-", "") }, { value: "chatgpt.com" }, { value: "referral" }], metricValues: [{ value: "8" }, { value: "7" }, { value: "2" }, { value: "0" }] },
        { dimensionValues: [{ value: date.replaceAll("-", "") }, { value: "google" }, { value: "organic" }], metricValues: [{ value: "40" }, { value: "35" }, { value: "4" }, { value: "0" }] },
        { dimensionValues: [{ value: date.replaceAll("-", "") }, { value: "chatgpt.com" }, { value: "email" }], metricValues: [{ value: "3" }, { value: "3" }, { value: "1" }, { value: "0" }] },
      ],
    }), { status: 200 })));

    await t.action(internal.connectionActions.syncGa4, { orgId: o.orgId });
    const rows = await t.run(async (ctx) => ctx.db.query("metricDaily").withIndex("by_org_metric_date", (q) => q.eq("orgId", o.orgId).eq("metricKey", "ai_referral_sessions").eq("date", date)).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 8, channel: "AI referral / ChatGPT", source: "ga4", kind: "observed" });
    const keyEvents = await t.run(async (ctx) => ctx.db.query("metricDaily").withIndex("by_org_metric_date", (q) => q.eq("orgId", o.orgId).eq("metricKey", "ai_referral_key_events").eq("date", date)).collect());
    expect(keyEvents).toHaveLength(1);
    expect(keyEvents[0]?.value).toBe(2);
  });

  it("Search Console sync stores dated query and page observations for the selected property", async () => {
    const t = setup();
    const o = await owned(t);
    const property = "https://example.com/";
    const connectionId = await t.mutation(internal.connections.storeConnection, {
      orgId: o.orgId,
      userId: o.userId,
      provider: "search_console",
      secret: JSON.stringify({ accessToken: "google-token" }),
      secretKind: "oauth",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      externalAccountId: property,
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [
      { keys: ["best climbing shoes", "https://example.com/shoes"], clicks: 12, impressions: 150, ctr: 0.08, position: 4.2 },
      { keys: ["best climbing shoes", "https://example.com/best-shoes"], clicks: 3, impressions: 25, ctr: 0.12, position: 6.1 },
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await t.action(internal.connectionActions.syncSearchConsole, { orgId: o.orgId });

    const observations = await o.client.query(api.searchConsole.observations, { slug: o.slug });
    expect(observations).toMatchObject({
      property,
      dataState: "final",
      truncated: false,
      rows: [
        { query: "best climbing shoes", page: "https://example.com/shoes", clicks: 12, impressions: 150, ctr: 0.08, position: 4.2 },
        { query: "best climbing shoes", page: "https://example.com/best-shoes", clicks: 3, impressions: 25, ctr: 0.12, position: 6.1 },
      ],
    });
    expect(observations!.queryOverlaps).toMatchObject([
      { query: "best climbing shoes", pageCount: 2, pages: [{ page: "https://example.com/shoes" }, { page: "https://example.com/best-shoes" }] },
    ]);
    expect(observations!.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(observations!.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(observations!.note).toContain("not universal search volume");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(encodeURIComponent(property));
    expect(JSON.parse(String(request.body))).toMatchObject({ dimensions: ["query", "page"], dataState: "final" });
    expect((await t.query(internal.connections.connectionFor, { orgId: o.orgId, provider: "search_console" }))!.lastSyncAt).toBeGreaterThan(0);
    expect(await t.query(internal.connections.getSecret, { connectionId })).not.toBeNull();
  });

  it("Search Console observations and property selection stay scoped to the owning workspace", async () => {
    const t = setup();
    const owner = await owned(t, "search-owner@example.com", "Owner Business");
    const other = await owned(t, "search-other@example.com", "Other Business");
    const connectionId = await t.mutation(internal.connections.storeConnection, {
      orgId: owner.orgId,
      userId: owner.userId,
      provider: "search_console",
      secret: JSON.stringify({ accessToken: "google-token" }),
      secretKind: "oauth",
      scopes: [],
    });
    const snapshotId = await t.mutation(internal.searchConsole.startSnapshot, {
      orgId: owner.orgId,
      connectionId,
      property: "https://example.com/",
      startDate: "2026-07-01",
      endDate: "2026-09-29",
    });
    await t.mutation(internal.searchConsole.writeSnapshotRows, {
      snapshotId,
      rows: [{ query: "climbing shoes", page: "https://example.com/shoes", clicks: 1, impressions: 2, ctr: 0.5, position: 3 }],
    });
    await t.mutation(internal.searchConsole.finishSnapshot, { snapshotId, status: "complete", rowCount: 1, truncated: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ siteEntry: [{ siteUrl: "https://example.com/", permissionLevel: "siteOwner" }] }), { status: 200 })));

    expect(await other.client.query(api.searchConsole.observations, { slug: other.slug })).toBeNull();
    expect((await owner.client.query(api.searchConsole.observations, { slug: owner.slug }))?.rows).toMatchObject([{ query: "climbing shoes" }]);
    const history = await owner.client.query(api.searchConsole.history, { slug: owner.slug });
    expect(history).toMatchObject([{ id: snapshotId, property: "https://example.com/", rowCount: 1 }]);
    expect(await other.client.query(api.searchConsole.snapshot, { slug: other.slug, snapshotId })).toBeNull();
    expect((await owner.client.query(api.searchConsole.snapshot, { slug: owner.slug, snapshotId }))?.rows).toMatchObject([{ query: "climbing shoes" }]);
    await expect(owner.client.action(api.connectionActions.selectSearchConsoleSite, { slug: owner.slug, siteUrl: "https://not-authorized.example/" })).rejects.toThrow("Choose a property returned by the connected Search Console account.");
    await expect(owner.client.action(api.connectionActions.selectSearchConsoleSite, { slug: owner.slug, siteUrl: "https://example.com/" })).resolves.toMatchObject({ ok: true, siteUrl: "https://example.com/" });
    expect((await t.query(internal.connections.connectionFor, { orgId: owner.orgId, provider: "search_console" }))!.externalAccountId).toBe("https://example.com/");
    expect((await owner.client.query(api.connections.list, { slug: owner.slug })).items.find((item) => item.provider === "search_console")?.connection).toMatchObject({ externalAccountId: "https://example.com/" });
    expect((await t.query(internal.connections.connectionFor, { orgId: other.orgId, provider: "search_console" }))).toBeNull();
    expect(await t.query(internal.connections.getSecret, { connectionId })).not.toBeNull();
  });

  it("a quick reconnect after disconnecting keeps the new token", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const t = setup();
    const o = await owned(t);
    const store = (token: string) => t.mutation(internal.connections.storeConnection, { orgId: o.orgId, userId: o.userId, provider: "linkedin", secret: JSON.stringify({ accessToken: token }), secretKind: "oauth", scopes: [] });
    const connectionId = await store("old-token");
    await o.client.mutation(api.connections.disconnect, { slug: o.slug, provider: "linkedin" });
    await store("new-token");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const secret = await t.query(internal.connections.getSecret, { connectionId });
    expect(JSON.parse(secret!.value).accessToken).toBe("new-token");
  });
});

describe("access checks", () => {
  it("a one-tap email link stops working once the person loses access", async () => {
    const t = setup();
    const u = await asNewUser(t, "demo-user@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const orgId = await t.run(async (ctx) => (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!._id);
    const token = "ab".repeat(24);
    await t.run(async (ctx) => {
      const a = (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", orgId)).collect()).find((x) => x.status === "in_review")!;
      await ctx.db.insert("actionTokens", { tokenHash: await sha256Hex(token), orgId, userId: u.userId, kind: "approve_post", subjectId: a._id, expiresAt: Date.now() + DAY, createdAt: Date.now() });
      const m = (await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", u.userId)).unique())!;
      await ctx.db.patch(m._id, { role: "viewer" });
    });
    expect(await t.mutation(api.emailActions.consume, { token })).toMatchObject({ ok: false, message: expect.stringMatching(/no longer have access/) });
  });

  it("a removed staff member's view-as session stops working", async () => {
    const t = setup();
    const o = await owned(t);
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.setStaff, { email: "help@example.com", role: "support" });
    const help = await asNewUser(t, "help@example.com");
    await help.client.mutation(api.admin.startViewAs, { orgId: o.orgId, reason: "ticket" });
    await expect(help.client.query(api.workspace.credits, { slug: o.slug })).resolves.toBeTruthy();
    await ops.client.mutation(api.admin.setStaff, { email: "help@example.com", role: "remove" });
    await expect(help.client.query(api.workspace.credits, { slug: o.slug })).rejects.toThrow(/couldn't find/);
  });

  it("Climb AI only answers a message for the member who sent it", async () => {
    const t = setup();
    const o = await owned(t);
    const other = await owned(t, "other@example.com", "Other Co");
    // Someone else's ids are ignored (no step runs, nothing is written).
    const fake = await t.run(async (ctx) => {
      const now = Date.now();
      const runId = await ctx.db.insert("workflowRuns", { orgId: o.orgId, kind: "climb", title: "Climb", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
      const messageId = await ctx.db.insert("climbMessages", { orgId: o.orgId, userId: o.userId, role: "user", text: "hi", status: "done", createdAt: now });
      return { runId, messageId };
    });
    await expect(other.client.action(api.climb.respond, { slug: o.slug, ...fake })).rejects.toThrow(/couldn't find/);
    await other.client.action(api.climb.respond, { slug: other.slug, ...fake });
    const steps = await t.run(async (ctx) => ctx.db.query("workflowSteps").collect());
    expect(steps).toHaveLength(0);
  });

  it("agent tokens stop when the package lapses; batches are capped", async () => {
    const t = setup();
    const o = await owned(t);
    await makePaid(t, o.orgId);
    const { token } = await o.client.mutation(api.agentTokens.create, { slug: o.slug, name: "Agent", scopes: [], days: 30 });
    const rpc = (body: unknown) => t.fetch("/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const batch = Array.from({ length: 21 }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "ping" }));
    expect((await rpc(batch)).status).toBe(400);
    expect((await rpc(batch.slice(0, 20))).status).toBe(200);
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("subscriptions").collect())[0];
      await ctx.db.patch(s._id, { status: "canceled", endedAt: Date.now() - 1000, currentPeriodEnd: Date.now() - 1000 });
    });
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(402);
  });
});

describe("status page", () => {
  it("one or two down samples show a day as degraded; three make it down", async () => {
    const t = setup();
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const sample = (ai: "ok" | "down", i: number) => ({ at: now - i * 60_000, day, components: [{ key: "ai", status: ai }] });
    await t.run(async (ctx) => {
      for (let i = 0; i < 2; i++) await ctx.db.insert("statusSamples", sample("down", i + 1));
    });
    const today = async () => (await t.query(api.status.overview, {})).components.find((c) => c.key === "ai")!.history[29];
    expect(await today()).toBe("degraded");
    await t.run(async (ctx) => {
      await ctx.db.insert("statusSamples", sample("down", 5));
    });
    expect(await today()).toBe("down");
  });
});

describe("Search Console URL inspection", () => {
  it("limits inspection to one owner-triggered URL inside the selected tenant property", async () => {
    const t = setup();
    const owner = await owned(t, "url-inspection-owner@example.com", "Search Company");
    const connectionId = await t.mutation(internal.connections.storeConnection, {
      orgId: owner.orgId,
      userId: owner.userId,
      provider: "search_console",
      secret: JSON.stringify({ accessToken: "google-token" }),
      secretKind: "oauth",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    await t.mutation(internal.connections.selectSearchConsoleSite, {
      orgId: owner.orgId, connectionId, siteUrl: "sc-domain:example.com", accountLabel: "sc-domain:example.com",
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ inspectionResult: {
      indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", robotsTxtState: "ALLOWED", indexingState: "INDEXING_ALLOWED", pageFetchState: "SUCCESSFUL" },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await owner.client.action(api.connectionActions.inspectSearchConsoleUrl, { slug: owner.slug, pageUrl: "https://www.example.com/pricing" });
    expect(result).toMatchObject({ property: "sc-domain:example.com", inspectionUrl: "https://www.example.com/pricing", verdict: "PASS", pageFetchState: "SUCCESSFUL" });
    await expect(owner.client.action(api.connectionActions.inspectSearchConsoleUrl, { slug: owner.slug, pageUrl: "https://other.example/pricing" })).rejects.toThrow(/inside the Search Console property/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
