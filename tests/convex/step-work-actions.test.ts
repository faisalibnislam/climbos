import { beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { ZERO_USAGE } from "../../shared/ai/types";
import { stepWorkFixture, usefulStepResult } from "../fixtures/stepWork";
const mocked = vi.hoisted(() => ({ turn: vi.fn(), research: vi.fn() }));
vi.mock("../../shared/ai/turn", () => ({ modelTurn: mocked.turn }));
vi.mock("../../convex/ai/research", () => ({ researchWebsite: mocked.research }));
beforeEach(() => { mocked.turn.mockReset(); mocked.research.mockReset(); });
it("researches, reads real source text and saves usable step work without marking anything done", async () => {
  const { t, owner, slug, strategyId, stepKey } = await stepWorkFixture();
  const first = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "actual-worker-path" });
  const url = "https://business.example/", page = "A clear intake for your next client project. Keep the request details together.";
  const success = { ok: true, text: "Research the supplied product page.", appended: [], sources: [{ url }], usage: { ...ZERO_USAGE }, costMicros: 0, actualModelId: "test-only", stopReason: "end_turn" };
  mocked.turn.mockResolvedValueOnce({ ...success, output: "Use the actual product page." }).mockResolvedValueOnce({ ...success, output: { ...usefulStepResult, evidence: [{ url, quote: "A clear intake for your next client project.", claim: "The site describes intake for client projects." }] } });
  mocked.research.mockResolvedValue({ pages: [{ url, title: "Product", text: page, status: "ok" }] });
  await t.action(internal.stepWorkActions.prepare, { workId: first.workId });
  const saved = await owner.client.query(api.stepWork.view, { slug, strategyId, stepKey });
  expect(saved?.status).toBe("ready");
  expect(saved?.result?.drafts[0].body).toBe(usefulStepResult.drafts[0].body);
  expect(saved?.sources[0].url).toBe(url);
  expect(mocked.research).toHaveBeenCalledWith(url, 0, { allowPaidFetch: false });
  expect(mocked.turn.mock.calls[1][0].messages[0].content).toContain(page);
  expect(mocked.turn.mock.calls[0][0].webSearch.maxUses).toBe(2);
  await t.action(internal.stepWorkActions.prepare, { workId: first.workId });
  expect(mocked.turn).toHaveBeenCalledTimes(2);
  expect(await t.run(ctx => ctx.db.query("planTaskProgress").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
});
it("does not call a model after access is revoked", async () => {
  const { t, owner, slug, strategyId, stepKey, orgId } = await stepWorkFixture();
  const first = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "revoked-worker-path" });
  await t.run(async ctx => { const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", orgId).eq("userId", owner.userId)).unique())!; await ctx.db.patch(member._id, { status: "removed" }); });
  await t.action(internal.stepWorkActions.prepare, { workId: first.workId });
  expect(mocked.turn).not.toHaveBeenCalled();
  expect((await t.run(ctx => ctx.db.get(first.workId)))?.status).toBe("failed");
});
it("follows observed public contact links instead of asking the owner to check them", async () => {
  const { t, owner, slug, strategyId, stepKey } = await stepWorkFixture();
  await t.run(async ctx => { const plan = (await ctx.db.get(strategyId))!; await ctx.db.patch(strategyId, { expert: { ...plan.expert!, phases: plan.expert!.phases.map((phase, i) => i ? phase : { ...phase, focus: "Find educators and check their contact routes" }) } }); });
  const first = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "automatic-contact-followup" });
  const url = "https://business.example/", contact = "https://business.example/contact";
  const success = { ok: true, text: `Read ${url}`, appended: [], sources: [{ url }], usage: { ...ZERO_USAGE }, costMicros: 0, actualModelId: "test-only", stopReason: "end_turn" };
  mocked.turn.mockResolvedValueOnce({ ...success, output: "Read the public contact route." }).mockResolvedValueOnce({ ...success, output: { ...usefulStepResult, evidence: [{ url: contact, quote: "Resource suggestions can use our contact form.", claim: "The page states a route for resource suggestions." }] } });
  mocked.research.mockImplementation(async (readUrl: string) => ({ pages: [{ url: readUrl, text: readUrl === contact ? "Resource suggestions can use our contact form." : "Freelance business education.", status: "ok", internalLinks: readUrl === url ? [contact] : [] }] }));
  await t.action(internal.stepWorkActions.prepare, { workId: first.workId });
  expect(mocked.research).toHaveBeenCalledWith(contact, 0, { allowPaidFetch: false });
  expect((await owner.client.query(api.stepWork.view, { slug, strategyId, stepKey }))?.sources.some(source => source.url === contact)).toBe(true);
});

it("retains usable work after a bounded repair fails source checks on another draft", async () => {
  const { t, owner, slug, strategyId, stepKey } = await stepWorkFixture();
  const work = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "partial-result-worker" });
  const result = { ...usefulStepResult, drafts: [...usefulStepResult.drafts, { ...usefulStepResult.drafts[0], body: usefulStepResult.drafts[0].body + " See https://invented.example/" }] };
  const success = { ok: true, text: "Use the existing business context.", appended: [], sources: [], usage: { ...ZERO_USAGE }, costMicros: 0, actualModelId: "test-only", stopReason: "end_turn" };
  mocked.turn.mockResolvedValueOnce({ ...success, output: "No new evidence." }).mockResolvedValue({ ...success, output: result });
  mocked.research.mockResolvedValue({ pages: [] });
  await t.action(internal.stepWorkActions.prepare, { workId: work.workId });
  const saved = await owner.client.query(api.stepWork.view, { slug, strategyId, stepKey });
  expect(saved?.status).toBe("ready");
  expect(saved?.result?.drafts).toEqual(usefulStepResult.drafts);
  expect(saved?.result?.limitations?.length).toBeGreaterThan(0);
  expect((await t.run(ctx => ctx.db.get(work.workId)))?.validationNotes).toContain("Unverified draft link: https://invented.example/");
  expect(mocked.turn).toHaveBeenCalledTimes(3);
  expect(await t.run(ctx => ctx.db.query("planTaskProgress").collect())).toEqual([]);
});

it("reads a named product's observed page instead of asking its owner to check it", async () => {
  const { t, owner, slug, strategyId, stepKey } = await stepWorkFixture();
  await t.run(async ctx => { const plan = (await ctx.db.get(strategyId))!; await ctx.db.patch(strategyId, { expert: { ...plan.expert!, phases: plan.expert!.phases.map((phase,i) => i ? phase : { ...phase, focus: "Check the File Slim app and prepare a real guide" }) } }); });
  const work = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "observed-product-read" });
  const url = "https://business.example/", product = "https://business.example/apps/file-slim";
  const success = { ok: true, text: "Research the product on the business site.", appended: [], sources: [], usage: { ...ZERO_USAGE }, costMicros: 0, actualModelId: "test-only", stopReason: "end_turn" };
  mocked.turn.mockResolvedValueOnce({ ...success, output: "Use observed product links." }).mockResolvedValueOnce({ ...success, output: { ...usefulStepResult, evidence: [{ url: product, quote: "File Slim compresses photos.", claim: "The product page states its purpose." }] } });
  mocked.research.mockImplementation(async (readUrl:string) => ({ pages: [{ url:readUrl,text:readUrl===product ? "File Slim compresses photos." : "Useful Mac tools.",status:"ok",internalLinks:readUrl.replace(/\/$/, "")===url.replace(/\/$/, "")?[product]:[] }] }));
  await t.action(internal.stepWorkActions.prepare, { workId:work.workId });
  expect(mocked.research).toHaveBeenCalledWith(product,0,{allowPaidFetch:false});
  expect((await owner.client.query(api.stepWork.view,{slug,strategyId,stepKey}))?.status).toBe("ready");
  expect(mocked.turn.mock.calls[1][0].messages[0].content).toContain("File Slim compresses photos.");
});
