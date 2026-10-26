import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("make it happen", () => {
  beforeEach(() => { process.env.CLIMBOS_FAKE_LLM = "ship"; });
  afterEach(() => { delete process.env.CLIMBOS_FAKE_LLM; });

  it("shows the cost, starts first drafts with a reservation, adds to-dos, and stays in its workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "mih-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Make Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const view = await owner.client.query(api.acquisition.view, { slug });
    const li = view!.channels.find((c) => /LinkedIn company page/i.test(c.name))!;
    const preview = await owner.client.query(api.acquisition.makeItHappenPreview, { slug, channelId: li.id });
    expect(preview.maxCostMicros).toBeGreaterThan(0);
    expect(preview.todos.length).toBe(1);
    const r = await owner.client.mutation(api.acquisition.makeItHappen, { slug, channelId: li.id });
    expect(r.runId).toBeTruthy();
    const run = await t.run(async (ctx) => ctx.db.get(r.runId!));
    expect(run).toMatchObject({ orgId, kind: "content_social" });
    const cards = await t.run(async (ctx) => ctx.db.query("actionCards").withIndex("by_org_status", (q) => q.eq("orgId", orgId as never).eq("status", "proposed")).collect());
    expect(cards.some((c) => /Connect your LinkedIn company page account/.test(c.title))).toBe(true);

    // The channel shows its own job, and the top-bar watcher sees it working.
    const runs = await owner.client.query(api.acquisition.makeItHappenRuns, { slug });
    expect(runs[li.id]).toMatchObject({ id: r.runId });
    expect(Object.keys(runs)).toEqual([li.id]);
    const work = await owner.client.query(api.workspace.activeWork, { slug });
    expect(work.active.some((a) => a.id === r.runId)).toBe(true);
    await t.run(async (ctx) => ctx.db.patch(r.runId!, { status: "failed", updatedAt: Date.now() }));
    expect((await owner.client.query(api.workspace.activeWork, { slug })).justStopped.map((x) => x.id)).toEqual([r.runId]);

    const other = await asNewUser(t, "mih-other@example.com");
    await expect(other.client.mutation(api.acquisition.makeItHappen, { slug, channelId: li.id })).rejects.toThrow();
    await expect(other.client.query(api.acquisition.makeItHappenRuns, { slug })).rejects.toThrow();
    await expect(owner.client.mutation(api.acquisition.makeItHappen, { slug, channelId: "NOPE" })).rejects.toThrow(/channel list/);
  });
});
