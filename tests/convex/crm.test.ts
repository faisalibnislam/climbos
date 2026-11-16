import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
import { encodeToolOutput, toolByName } from "../../convex/lib/climbTools";

describe("mini-CRM", () => {
  it.each([["JPY", 1200, 1200], ["KWD", 12.345, 12345], ["USD", 12.34, 1234]])("preserves %s units from entry through recorded-sale events", async (currency, amount, minor) => {
    const t = setup(); const owner = await asNewUser(t, `crm-${currency}@example.com`);
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Currency Co" });
    await t.run(async ctx => {
      await ctx.db.patch(orgId, { currency });
      const b = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first();
      if (b) await ctx.db.patch(b._id, { currency });
    });
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: amount });
    await owner.client.mutation(api.crm.update, { slug, id, stage: "won" });
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ value: minor, currency });
    const tool = toolByName("get_pipeline")!;
    const output = await tool.run!({ query: async () => owner.client.query(api.crm.list, { slug }), mutation: async () => { throw new Error("Read-only tool must not mutate"); } } as never, slug, {});
    expect(JSON.parse(encodeToolOutput(output, 7800, tool.output))).toMatchObject({ valueUnit: "major_currency_units", evidenceKind: "owner_reported", totals: { wonValue: amount }, deals: [expect.objectContaining({ value: amount, currency })] });
    expect(await t.run(ctx => ctx.db.query("revenueEvents").first())).toMatchObject({ amountMinor: minor, currency });
    await owner.client.mutation(api.crm.update, { slug, id, value: amount * 2 });
    expect(await t.run(ctx => ctx.db.query("revenueEvents").first())).toMatchObject({ amountMinor: minor * 2, currency });
  });

  it("does not sum unlike currencies or replace unknown values with zero", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-unknown@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Unknown Co" });
    const first = await owner.client.mutation(api.crm.create, { slug, name: "USD buyer", value: 100 });
    await owner.client.mutation(api.crm.create, { slug, name: "Unknown buyer" });
    expect((await owner.client.query(api.crm.list, { slug })).totals.pipelineValue).toBeNull();
    await t.run(ctx => ctx.db.patch(first, { currency: "EUR" }));
    const list = await owner.client.query(api.crm.list, { slug });
    expect(list.totals.pipelineValue).toBeNull();
    expect(list.totals.pipeline.byCurrency).toEqual(expect.arrayContaining([expect.objectContaining({ currency: "EUR", recordedMinor: 10000 }), expect.objectContaining({ currency: "USD", missing: 1, recordedMinor: null })]));
  });

  it.each([-1, 1.005, Number.MAX_VALUE])("rejects invalid money without changing a deal (%s)", async value => {
    const t = setup(); const owner = await asNewUser(t, "crm-invalid@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Money Co" });
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: 10 });
    await expect(owner.client.mutation(api.crm.update, { slug, id, value })).rejects.toThrow();
    expect((await owner.client.query(api.crm.list, { slug })).deals[0].value).toBe(1000);
  });

  it("requires confirmation of legacy non-two-decimal amounts", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-legacy@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Legacy Co" });
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: 10 });
    await t.run(ctx => ctx.db.patch(id, { currency: "JPY", valueVersion: undefined }));
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ value: null, valueNeedsReview: true });
    await expect(owner.client.mutation(api.crm.update, { slug, id, stage: "won" })).rejects.toThrow(/confirm/i);
    await owner.client.mutation(api.crm.update, { slug, id, value: 10, stage: "won" });
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ value: 10, valueNeedsReview: false });
  });

  it("preserves unknown and zero sale values in queued webhook payloads", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-events@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Events Co" });
    await makePaid(t, orgId);
    await owner.client.mutation(api.webhooks.create, { slug, url: "https://hooks.zapier.com/hooks/catch/1/test", events: ["deal.won"] });
    for (const value of [undefined, 0, 12.345]) {
      await t.run(async ctx => {
        const b = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first();
        if (b) await ctx.db.patch(b._id, { currency: "KWD" });
        await ctx.db.patch(orgId, { currency: "KWD" });
      });
      const id = await owner.client.mutation(api.crm.create, { slug, name: `Buyer ${value}`, value });
      await owner.client.mutation(api.crm.update, { slug, id, stage: "won" });
    }
    const payloads = await t.run(async ctx => (await ctx.db.query("webhookDeliveries").collect()).map(row => JSON.parse(row.payload).data));
    expect(payloads.map(p => p.value)).toEqual([null, 0, 12.345]);
    expect(payloads.every(p => p.currency === "KWD" && p.evidenceKind === "owner_reported")).toBe(true);
    // No delivery worker is run; no external requests are made.
  });

  it("detects a changed entry currency and keeps values tenant- and role-scoped", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-currency-owner@example.com");
    const viewer = await asNewUser(t, "crm-currency-viewer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Currency Co" });
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: 10, expectedCurrency: "JPY" })).rejects.toThrow(/currency changed/);
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: 0 });
    await expect(viewer.client.mutation(api.crm.update, { slug, id, value: 100 })).rejects.toThrow();
    await expect(owner.client.mutation(api.crm.update, { slug, id, value: 10, expectedCurrency: "JPY" })).rejects.toThrow(/currency changed/);
    expect((await owner.client.query(api.crm.list, { slug })).deals[0].value).toBe(0);
    await owner.client.mutation(api.crm.update, { slug, id, value: 12 });
    expect(await t.run(ctx => ctx.db.query("auditEvents").filter(q => q.eq(q.field("action"), "crm.value")).collect())).toHaveLength(1);
  });

  it("discloses truncated pipeline reads and withholds a whole-pipeline value", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-large@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Large Co" });
    await t.run(async ctx => {
      for (let i = 0; i < 501; i++) await ctx.db.insert("deals", { orgId, name: `Buyer ${i}`, stage: "lead", source: "manual", valueMinor: 100, currency: "USD", notes: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    expect(await owner.client.query(api.crm.list, { slug })).toMatchObject({ hasMore: true, totals: { pipelineValue: null, pipeline: { partial: true, byCurrency: [{ currency: "USD", known: 500, recordedMinor: 50000 }] } } });
  });

  it("records a newly entered won deal with a stable close time and synthetic demo provenance", async () => {
    const t = setup(); const owner = await asNewUser(t, "crm-demo@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Demo Co" });
    await t.run(ctx => ctx.db.patch(orgId, { kind: "demo" }));
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Buyer", value: 10, stage: "won" });
    const d = await t.run(ctx => ctx.db.get(id));
    expect(await t.run(ctx => ctx.db.query("revenueEvents").first())).toMatchObject({ amountMinor: 1000, occurredAt: d!.wonAt, isFixture: true });
  });
  it("adds people, moves them forward and counts won deals as revenue", async () => {
    const t = setup();
    const owner = await asNewUser(t, "crm@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "CRM Co" });
    await expect(owner.client.mutation(api.crm.create, { slug, name: " " })).rejects.toThrow(/Add a name/);
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Ana Lopez", company: "Lopez Dental", email: "ana@lopez.example", value: 1200 });
    await owner.client.mutation(api.crm.update, { slug, id, note: "Wants a quote by Friday" });
    await expect(owner.client.mutation(api.crm.update, { slug, id, email: "not an email" })).rejects.toThrow(/doesn't look right/);
    await expect(owner.client.mutation(api.crm.update, { slug, id, value: Number.NaN })).rejects.toThrow(/as a number/);
    await owner.client.mutation(api.crm.update, { slug, id, stage: "won" });
    const list = await owner.client.query(api.crm.list, { slug });
    expect(list.deals[0]).toMatchObject({ stage: "won", value: 120000 });
    expect(list.totals.wonValue).toBe(120000);
    const revenue = () => t.run(async (ctx) => (await ctx.db.query("revenueEvents").collect()).filter((r) => r.source === "crm"));
    expect(await revenue()).toHaveLength(1);
    expect((await revenue())[0].amountMinor).toBe(120000);
    // Moving it back out of "won" removes the revenue; removing the deal too.
    await owner.client.mutation(api.crm.update, { slug, id, stage: "talking" });
    expect(await revenue()).toHaveLength(0);
    await owner.client.mutation(api.crm.update, { slug, id, stage: "won" });
    await owner.client.mutation(api.crm.remove, { slug, id });
    expect(await revenue()).toHaveLength(0);
  });

  it("keeps workspaces apart", async () => {
    const t = setup();
    const a = await asNewUser(t, "a@example.com");
    const b = await asNewUser(t, "b@example.com");
    const wa = await a.client.mutation(api.orgs.createWorkspace, { businessName: "A Co" });
    const wb = await b.client.mutation(api.orgs.createWorkspace, { businessName: "B Co" });
    const id = await a.client.mutation(api.crm.create, { slug: wa.slug, name: "Secret lead" });
    await expect(b.client.mutation(api.crm.update, { slug: wb.slug, id, stage: "won" })).rejects.toThrow();
    expect((await b.client.query(api.crm.list, { slug: wb.slug })).deals).toHaveLength(0);
  });
});
