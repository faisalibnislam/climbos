import { describe, expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";
import { api } from "../../convex/_generated/api";

/** REQ-ENG-01: engine flags are per workspace, staff-set (internal only), known names only, audited. */
describe("engine flags", () => {
  it("opts one workspace in and out; unknown flags are rejected", async () => {
    const t = setup();
    const u = await asNewUser(t, "flags@example.com");
    const { orgId } = await u.client.mutation(api.orgs.createWorkspace, { businessName: "Flag Co" });
    const id = orgId as Id<"organizations">;
    expect(await t.mutation(internal.engineFlags.setEngineFlag, { orgId: id, flag: "decision_contract", on: true })).toEqual(["decision_contract"]);
    expect((await t.run((ctx) => ctx.db.get(id)))?.engineFlags).toEqual(["decision_contract"]);
    await expect(t.mutation(internal.engineFlags.setEngineFlag, { orgId: id, flag: "anything", on: true })).rejects.toThrow(/Unknown engine flag/);
    expect(await t.mutation(internal.engineFlags.setEngineFlag, { orgId: id, flag: "decision_contract", on: false })).toEqual([]);
    const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.filter((a) => a.action === "engine.flag")).toHaveLength(2);
  });
});
