import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { encodeToolOutput, toolByName, type Caller } from "../../convex/lib/climbTools";

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "transcript-owner@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Conversation evidence" });
  const id = await owner.client.mutation(api.crm.create, { slug: w.slug, name: "Buyer", stage: "talking" });
  const input = { slug: w.slug, id, expectedRevision: 0, title: "Discovery conversation", sourceLabel: "Owner prepared from permissioned notes", text: "Buyer: We need an easier export. Seller: Which part is difficult? Buyer: I have not tested your product yet.", permissionConfirmed: true, permissionBasis: "Participants agreed to business analysis" };
  const caller = { query: (fn: unknown, args: unknown) => (owner.client.query as (f: unknown, a: unknown) => Promise<unknown>)(fn, args), mutation: async () => { throw new Error("Read cannot mutate"); } } as unknown as Caller;
  return { t, owner, ...w, id, input, caller };
}

it("persists permissioned text separately and transports exact versioned evidence through the existing tool", async () => {
  const f = await fixture(), tool = toolByName("get_pipeline")!;
  expect(tool.risk).toBe("read");
  const before = await f.t.run(async ctx => ({ approvals: await ctx.db.query("approvals").collect(), receipts: await ctx.db.query("actionReceipts").collect(), runs: await ctx.db.query("workflowRuns").collect() }));
  await f.owner.client.mutation(api.crm.addTranscript, f.input);
  const list = await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id });
  expect(list).toMatchObject({ revision: 1, evidenceKind: "owner_supplied_transcript", page: null, items: [{ index: 1, occurredOn: null }] });
  const raw = await tool.run!(f.caller, f.slug, { view: "transcripts", dealId: f.id, expectedVersion: list.version, transcriptIndex: 1 });
  const decoded = JSON.parse(encodeToolOutput(raw, 7800, tool.output));
  expect(decoded.page.text).toBe(f.input.text); expect(decoded.page.nextOffset).toBeNull();
  expect(decoded.limitations).toContain("not independently verified");
  expect(decoded.canEdit).toBeUndefined(); expect(JSON.stringify(decoded)).not.toContain(f.owner.userId);
  expect((await f.t.run(ctx => ctx.db.get(f.id)))!).toMatchObject({ stage: "talking", notes: [] });
  expect(await f.t.run(async ctx => ({ approvals: await ctx.db.query("approvals").collect(), receipts: await ctx.db.query("actionReceipts").collect(), runs: await ctx.db.query("workflowRuns").collect() }))).toEqual(before);
});

it("pages Unicode without splitting speakers' text and refuses a mixed record version", async () => {
  const f = await fixture(), text = "Buyer: " + "😀".repeat(1700) + " I have no budget agreement.";
  await f.owner.client.mutation(api.crm.addTranscript, { ...f.input, text });
  const list = await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id });
  const first = await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id, transcriptIndex: 1, expectedVersion: list.version });
  expect(first.page?.nextOffset).toBe(1500); expect(first.page?.text).not.toContain("�");
  const last = await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id, transcriptIndex: 1, offset: 1500, expectedVersion: list.version });
  expect(first.page!.text + last.page!.text).toBe(text);
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, note: "New conflicting context" });
  await expect(f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id, transcriptIndex: 1, expectedVersion: list.version })).rejects.toThrow(/changed/);
});

it.each(["no permission", "no basis", "short text", "large text", "future date", "invalid date", "stale revision", "binary"])("rejects unsupported import: %s", async kind => {
  const f = await fixture();
  const patch = kind === "no permission" ? { permissionConfirmed: false } : kind === "no basis" ? { permissionBasis: "" } : kind === "short text" ? { text: "hello" } : kind === "large text" ? { text: "x".repeat(16001) } : kind === "future date" ? { occurredOn: "2999-01-01" } : kind === "invalid date" ? { occurredOn: "2026-02-30" } : kind === "binary" ? { text: f.input.text + "\0" } : { expectedRevision: 1 };
  await expect(f.owner.client.mutation(api.crm.addTranscript, { ...f.input, ...patch })).rejects.toThrow();
  expect((await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id })).items).toEqual([]);
});

it("bounds storage without silently replacing originals, rejects duplicate imports and supports exact removal", async () => {
  const f = await fixture();
  for (let i = 0; i < 6; i++) await f.owner.client.mutation(api.crm.addTranscript, { ...f.input, expectedRevision: i, text: `${f.input.text} Part ${i}` });
  await expect(f.owner.client.mutation(api.crm.addTranscript, { ...f.input, expectedRevision: 6 })).rejects.toThrow(/six transcripts/);
  await expect(f.owner.client.mutation(api.crm.removeTranscript, { slug: f.slug, id: f.id, index: 1, expectedRevision: 5 })).rejects.toThrow(/changed/);
  await f.owner.client.mutation(api.crm.removeTranscript, { slug: f.slug, id: f.id, index: 1, expectedRevision: 6 });
  expect((await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id })).items.map(i => i.index)).toEqual([2, 3, 4, 5, 6]);
  await expect(f.owner.client.mutation(api.crm.addTranscript, { ...f.input, expectedRevision: 7, text: `${f.input.text} Part 1` })).rejects.toThrow(/already saved/);
  await f.owner.client.mutation(api.crm.remove, { slug: f.slug, id: f.id });
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toBeNull();
  await expect(f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id })).rejects.toThrow();
});

it("enforces tenant and editor access for import/removal and tenant access for text", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "foreign-transcript@example.com");
  await f.owner.client.mutation(api.crm.addTranscript, f.input);
  const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Another conversation workspace" });
  await expect(other.client.query(api.crm.transcripts, { slug: otherOrg.slug, id: f.id })).rejects.toThrow();
  await expect(other.client.mutation(api.crm.addTranscript, { ...f.input, slug: otherOrg.slug, expectedRevision: 1 })).rejects.toThrow();
  await expect(other.client.query(api.crm.transcripts, { slug: f.slug, id: f.id })).rejects.toThrow();
  await expect(other.client.mutation(api.crm.addTranscript, { ...f.input, expectedRevision: 1 })).rejects.toThrow();
  await expect(other.client.mutation(api.crm.removeTranscript, { slug: f.slug, id: f.id, index: 1, expectedRevision: 1 })).rejects.toThrow();
  await f.t.run(async ctx => { const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(m._id, { role: "viewer" }); });
  expect((await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id })).canEdit).toBe(false);
  await expect(f.owner.client.mutation(api.crm.addTranscript, { ...f.input, expectedRevision: 1 })).rejects.toThrow();
  await expect(f.owner.client.mutation(api.crm.removeTranscript, { slug: f.slug, id: f.id, index: 1, expectedRevision: 1 })).rejects.toThrow();
});

it("rejects missing snapshot and invalid text cursors through queries and the tool", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.crm.addTranscript, f.input);
  const list = await f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id });
  await expect(f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id, transcriptIndex: 1 })).rejects.toThrow(/list/);
  for (const offset of [-1, 1.5, 1, 999999]) await expect(f.owner.client.query(api.crm.transcripts, { slug: f.slug, id: f.id, transcriptIndex: 1, offset, expectedVersion: list.version })).rejects.toThrow();
  const tool = toolByName("get_pipeline")!;
  for (const input of [{ view: "notes", transcriptIndex: 1, dealId: f.id }, { view: "transcripts", dealId: f.id, beforeNote: 1 }, { view: "transcripts" }]) await expect(tool.run!(f.caller, f.slug, input)).rejects.toThrow();
});

it("includes permissioned source text in the bounded workspace export and removes it with the deal", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.crm.addTranscript, f.input);
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.dealTranscripts[0]).toMatchObject({ text: f.input.text, permissionConfirmed: true, permissionBasis: f.input.permissionBasis });
  await f.owner.client.mutation(api.crm.remove, { slug: f.slug, id: f.id });
  expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId })).dealTranscripts).toEqual([]);
  const audits = await f.t.run(ctx => ctx.db.query("auditEvents").collect());
  expect(JSON.stringify(audits)).not.toContain(f.input.text);
});

it("exports a disclosed bounded set and keeps transcript bodies out of ordinary deal records", async () => {
  const f = await fixture(); await f.owner.client.mutation(api.crm.addTranscript, f.input);
  await f.t.run(async ctx => {
    const original = (await ctx.db.query("dealTranscripts").first())!;
    const { _id: _id, _creationTime: _time, ...fields } = original;
    for (let i = 0; i < 20; i++) await ctx.db.insert("dealTranscripts", { ...fields, index: i + 2 });
  });
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.dealTranscripts).toHaveLength(20); expect(exported.dealTranscriptsLimited).toBe(true);
  expect(JSON.stringify(await f.t.run(ctx => ctx.db.get(f.id)))).not.toContain(f.input.text);
  await expect(f.owner.client.mutation(api.crm.remove, { slug: f.slug, id: f.id })).rejects.toThrow(/complete transcript set/);
  expect(await f.t.run(ctx => ctx.db.get(f.id))).not.toBeNull();
  expect(await f.t.run(ctx => ctx.db.query("dealTranscripts").collect())).toHaveLength(21);
});

it("finds recurring topics without counting duplicate imports or exposing the text in the overview", async () => {
  const f = await fixture();
  const second = await f.owner.client.mutation(api.crm.create, { slug: f.slug, name: "Second deal" });
  const other = await asNewUser(f.t, "other-topics@example.com");
  const separate = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Separate" });
  const report = () => f.owner.client.query(api.crm.recurringConversationTopics, { slug: f.slug });
  await f.owner.client.mutation(api.crm.addTranscript, f.input);
  await f.owner.client.mutation(api.crm.addTranscript, { ...f.input, id: second });
  expect(await report()).toMatchObject({ topics: [], distinctTranscripts: 1 });
  await f.owner.client.mutation(api.crm.addTranscript, { ...f.input, id: second, expectedRevision: 1, text: "Seller: Did you need another export? Buyer: No, our export already works." });
  const result = await report();
  expect(result.topics).toContainEqual(expect.objectContaining({ key: "product_gap", count: 2 }));
  expect(JSON.stringify(result)).not.toContain("Buyer:");
  await expect(other.client.query(api.crm.recurringConversationTopics, { slug: f.slug })).rejects.toThrow();
  expect(await other.client.query(api.crm.recurringConversationTopics, { slug: separate.slug })).toMatchObject({ topics: [] });
  await f.owner.client.mutation(api.crm.removeTranscript, { slug: f.slug, id: second, expectedRevision: 2, index: 2 });
  expect((await report()).topics).toEqual([]);
});
