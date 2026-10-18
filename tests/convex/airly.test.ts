import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { planMarkdown, planTasks } from "../../shared/airly/plan";
import { asNewUser, setup } from "./helpers";

describe("Airly apps", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_AIRLY = "1";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_AIRLY;
  });

  it("checks token formats, imports Formkit responses and Meetrao bookings once", async () => {
    const t = setup();
    const owner = await asNewUser(t, "airly@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Airly Co" });
    expect(await owner.client.action(api.airlyActions.connect, { slug, app: "formkit", token: "nope" })).toMatchObject({ ok: false });
    expect(await owner.client.action(api.airlyActions.connect, { slug, app: "formkit", token: `fk_live_${"a".repeat(48)}` })).toMatchObject({ ok: true });
    expect(await owner.client.action(api.airlyActions.connect, { slug, app: "meetrao", token: `mk_live_${"b".repeat(48)}` })).toMatchObject({ ok: true });
    expect(await owner.client.action(api.airlyActions.connect, { slug, app: "taskeni", token: "tk_abcdefghijkl" })).toMatchObject({ ok: false });
    expect(await owner.client.action(api.airlyActions.connect, { slug, app: "taskeni", token: "tk_abcdefghijkl", base: "https://happy-cat-123.convex.site/api/v1" })).toMatchObject({ ok: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const inbox = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(inbox.map((m) => m.kind).sort()).toEqual(["booking", "form"]);
    const deals = (await owner.client.query(api.crm.list, { slug })).deals;
    expect(deals.map((d) => d.stage).sort()).toEqual(["booked", "lead"]);
    // A second sync doesn't duplicate.
    const { internal } = await import("../../convex/_generated/api");
    await t.action(internal.airlyActions.syncAll, {});
    expect((await owner.client.query(api.inbox.list, { slug, box: "open" })).length).toBe(2);
    const overview = await owner.client.query(api.airly.overview, { slug });
    expect(overview.find((a) => a.app === "formkit")?.link?.imported).toBe(1);
    expect(overview.find((a) => a.app === "taskeni")?.link?.settings.board).toBe("bd1");
  });

  it("turns a plan into Taskeni to-dos and a Folevi note", () => {
    const plan = { summary: "Win dentists", positioning: "Fastest forms", measurementPlan: "Weekly", channels: [{ name: "Outreach", why: "Direct", status: "active", deliverables: ["300 emails"], measurement: "Replies" }], expert: { diagnosis: "x", northStar: { metric: "Paid accounts", baseline: "0", target: "20" }, phases: [], weekOneChecklist: ["Connect mailbox"], risks: [] } };
    expect(planTasks(plan).map((x) => x.title)).toEqual(["Connect mailbox", "Outreach: 300 emails"]);
    expect(planMarkdown(plan, "Formkit")).toContain("- [ ] Connect mailbox");
  });
});
