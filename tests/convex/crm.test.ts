import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("mini-CRM", () => {
  it("adds people, moves them forward and counts won deals as revenue", async () => {
    const t = setup();
    const owner = await asNewUser(t, "crm@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "CRM Co" });
    await expect(owner.client.mutation(api.crm.create, { slug, name: " " })).rejects.toThrow(/Add a name/);
    const id = await owner.client.mutation(api.crm.create, { slug, name: "Ana Lopez", company: "Lopez Dental", email: "ana@lopez.example", value: 1200 });
    await owner.client.mutation(api.crm.update, { slug, id, note: "Wants a quote by Friday" });
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
