import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("content languages", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("sets the workspace language and translates a draft into a new draft", async () => {
    const t = setup();
    const owner = await asNewUser(t, "lang@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Lang Co" });
    expect(await owner.client.query(api.translate.language, { slug })).toBe("English");
    await expect(owner.client.mutation(api.translate.setLanguage, { slug, language: "Klingon" })).rejects.toThrow(/list/);
    await owner.client.mutation(api.translate.setLanguage, { slug, language: "Spanish" });
    expect(await owner.client.query(api.translate.language, { slug })).toBe("Spanish");

    const text = "We moved our bakery to sourdough only. Customers wanted bread that keeps longer and tastes better. Every loaf now ferments for 24 hours before it is baked.";
    await owner.client.mutation(api.repurpose.start, { slug, text, formats: ["linkedin"] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [first] = await t.run(async (ctx) => ctx.db.query("artifacts").collect());
    await owner.client.mutation(api.translate.start, { slug, artifactId: first._id, language: "German" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const arts = await t.run(async (ctx) => ctx.db.query("artifacts").collect());
    expect(arts).toHaveLength(2);
    expect(arts[1].title).toContain("(German)");
    expect(arts[1].channel).toBe("linkedin");
  });
});
