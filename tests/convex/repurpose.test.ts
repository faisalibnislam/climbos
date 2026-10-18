import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("repurposing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("turns pasted text into drafts in review, one per requested format", async () => {
    const t = setup();
    const owner = await asNewUser(t, "repurpose@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Repurpose Co" });
    await expect(owner.client.mutation(api.repurpose.start, { slug, text: "too short", formats: ["linkedin"] })).rejects.toThrow(/few sentences/);
    await expect(owner.client.mutation(api.repurpose.start, { slug, url: "http://insecure.example", formats: ["linkedin"] })).rejects.toThrow(/https/);
    const text = "We moved our bakery to sourdough only. Customers told us they wanted bread that keeps longer and tastes better. It took us six months to get the starter right, and now every loaf is fermented for 24 hours.";
    await owner.client.mutation(api.repurpose.start, { slug, text, formats: ["linkedin"] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const arts = await t.run(async (ctx) => (await ctx.db.query("artifacts").collect()).filter((a) => a.status === "in_review"));
    expect(arts).toHaveLength(1);
    expect(arts[0].channel).toBe("linkedin");
  });
});
