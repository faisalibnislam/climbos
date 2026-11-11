import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
afterEach(() => vi.unstubAllGlobals());
describe("demo landing drafts", () => {
  it("uses a fixture writer even without a global fake-model switch or provider key", async () => {
    const t = setup();
    const user = await asNewUser(t, "demo-page@example.com");
    const { slug } = await user.client.mutation(api.demo.createDemoWorkspace, {});
    delete process.env.CLIMBOS_FAKE_LLM;
    const network = vi.fn(() => { throw new Error("Demo must not use a network model"); });
    vi.stubGlobal("fetch", network);
    const pageId = await user.client.mutation(api.landing.create, { slug, brief: "A synthetic utility demonstration for local testing" });
    const context = (await t.query(internal.landing.writeContext, { pageId }))!;
    expect(context.run?.isFixture).toBe(true);
    await t.action(internal.landing.write, { pageId, runId: context.run!._id });
    const page = (await user.client.query(api.landing.list, { slug })).pages.find((p) => p.id === pageId)!;
    expect(page.status).toBe("draft");
    expect(page.content?.headline).toBeTruthy();
    expect(network).not.toHaveBeenCalled();
  });
});
