import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
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
});
