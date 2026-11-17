import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

const capture = vi.hoisted(() => ({ calls: [] as { messages: { content: unknown }[] }[] }));
vi.mock("../../shared/ai/turn", async original => ({ ...await original<typeof import("../../shared/ai/turn")>(), modelTurn: vi.fn(async args => {
  capture.calls.push(args);
  return { ok: false, usage: { calls: 0 }, costMicros: 0 };
}) }));
afterEach(() => { capture.calls = []; vi.unstubAllEnvs(); });

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "brand-writer@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Specific brand" });
  await makePaid(t, orgId, 50_000_000);
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.insert("brandProfiles", { orgId, businessId: business._id, voice: "Dry, precise and welcoming", toneWords: ["observant", "clever"], colors: ["#123456"], doNots: ["Never imply the customer is foolish", "Avoid pressure-based closings"], approvedExamples: ["An owner-approved style example. ".repeat(23) + "END_OF_APPROVED_EXAMPLE"], ownerConfirmedAt: Date.now(), ownerConfirmedBy: owner.userId, socialHumor: "cheeky", socialTrendPolicy: "evergreen_first", voiceLearningEnabled: true, learnedRules: [{ text: "Prefer a useful observation to a rhetorical question", at: Date.now() }], updatedAt: Date.now() });
  });
  return { t, owner, slug, orgId };
}

it.each(["repurpose", "landing"] as const)("carries complete relevant brand guidance into the actual %s writer", async path => {
  const f = await fixture();
  if (path === "repurpose") await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, text: "A practical guide to preparing a workshop. Start with the question you want answered, collect a real example and leave time to review the result.", formats: ["linkedin"] });
  else await f.owner.client.mutation(api.landing.create, { slug: f.slug, brief: "Prepare a private landing page draft for our workshop planning guide" });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(capture.calls).toHaveLength(1);
  const input = JSON.stringify(capture.calls[0].messages);
  expect(input).toContain("Dry, precise and welcoming");
  expect(input).toContain("observant");
  expect(input).toContain("Never imply the customer is foolish");
  expect(input).toContain("Avoid pressure-based closings");
  expect(input).toContain("END_OF_APPROVED_EXAMPLE");
  expect(input).toContain("INFERRED EDIT PREFERENCES");
  expect(input).toContain("Prefer a useful observation");
  if (path === "repurpose") expect(input).toContain("humor=cheeky; trend use=evergreen_first");
  else expect(input).not.toContain("SOCIAL STYLE PREFERENCES");
  for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it("omits stale learned rules after voice-learning consent is off and isolates another workspace's profile", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { const brand = (await ctx.db.query("brandProfiles").collect())[0]; await ctx.db.patch(brand._id, { voiceLearningEnabled: false }); });
  const other = await asNewUser(f.t, "other-brand-writer@example.com");
  const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Different voice" });
  await f.t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", otherOrg.orgId)).first())!;
    await ctx.db.insert("brandProfiles", { orgId: otherOrg.orgId, businessId: business._id, voice: "FOREIGN_BRAND_MARKER", toneWords: [], colors: [], doNots: [], updatedAt: Date.now() });
  });
  await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, text: "A practical guide to preparing a workshop. Start with the question you want answered, collect a real example and leave time to review the result.", formats: ["email"] });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const input = JSON.stringify(capture.calls[0].messages);
  expect(input).toContain("Avoid pressure-based closings");
  expect(input).not.toContain("Prefer a useful observation");
  expect(input).not.toContain("FOREIGN_BRAND_MARKER");
  expect(input).not.toContain("SOCIAL STYLE PREFERENCES");
});
