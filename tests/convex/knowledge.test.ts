import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("governed knowledge refresh", () => {
  it("limits requests to staff with feature power and only queues a registry source", async () => {
    const t = setup();
    const customer = await asNewUser(t, "customer@example.com");
    await expect(customer.client.query(api.knowledge.listSources, {})).rejects.toThrow(/Not found/);
    await expect(customer.client.mutation(api.knowledge.requestRefresh, { registryId: "SRC-001" })).rejects.toThrow(/Not found/);

    const ops = await asNewUser(t, "ops@example.com");
    await expect(ops.client.mutation(api.knowledge.requestRefresh, { registryId: "not-a-source" })).rejects.toThrow(/source registry/);
    const id = await ops.client.mutation(api.knowledge.requestRefresh, { registryId: "SRC-001" });
    await expect(ops.client.mutation(api.knowledge.requestRefresh, { registryId: "SRC-001" })).rejects.toThrow(/already queued/);
    expect(await ops.client.query(api.knowledge.listSources, {})).toMatchObject([
      { id, registryId: "SRC-001", status: "queued", accessReview: "not_reviewed", checkedAt: null },
    ]);
    expect(await ops.client.query(api.knowledge.listProposals, {})).toEqual([]);
  });

  it("does not grant source-refresh power to support staff", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.setStaff, { email: "support@example.com", role: "support" });
    const support = await asNewUser(t, "support@example.com");
    await expect(support.client.mutation(api.knowledge.requestRefresh, { registryId: "SRC-001" })).rejects.toThrow(/staff role/);
    await expect(support.client.query(api.knowledge.listSources, {})).resolves.toEqual([]);
  });

  it("queues only due direct-page sources and atomically claims each scheduled check", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const sourceId = await ops.client.mutation(api.knowledge.requestRefresh, { registryId: "SRC-004" });
    const now = Date.parse("2026-10-27T00:00:00.000Z");
    await t.run((ctx) => ctx.db.patch(sourceId, {
      status: "unchanged", checkedAt: now - 8 * 24 * 60 * 60 * 1000, nextCheckAt: now - 1,
      contentHash: "sha256:reviewed", contentText: "Reviewed source baseline", version: 1,
    }));

    await expect(t.query(internal.knowledge.dueRefreshes, { now, limit: 5 })).resolves.toEqual([sourceId]);
    await expect(t.mutation(internal.knowledge.queueDueRefresh, { sourceId, now })).resolves.toBe(sourceId);
    await expect(t.mutation(internal.knowledge.queueDueRefresh, { sourceId, now })).resolves.toBeNull();
    await expect(t.query(internal.knowledge.dueRefreshes, { now, limit: 5 })).resolves.toEqual([]);
  });
});
