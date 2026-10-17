import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CLIMB_TOOLS, safeAppPath, type Caller } from "../../convex/lib/climbTools";
import { asNewUser, setup, type T } from "./helpers";

/**
 * Climb AI: every tool runs against the real functions it wraps (so shapes and
 * permissions stay honest), the agent loop answers and meters, and
 * consequential actions only happen after the owner confirms.
 */

async function demo(t: T, email: string) {
  const u = await asNewUser(t, email, { anonymous: true });
  const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
  await t.finishAllScheduledFunctions(() => undefined);
  const caller = { query: (fn: unknown, args: unknown) => (u.client.query as (f: unknown, a: unknown) => Promise<unknown>)(fn, args), mutation: (fn: unknown, args: unknown) => (u.client.mutation as (f: unknown, a: unknown) => Promise<unknown>)(fn, args) } as unknown as Caller;
  return { ...u, slug, caller };
}

describe("Climb AI tools", () => {
  beforeEach(() => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("every read tool returns real data from the functions it wraps", async () => {
    const t = setup();
    const w = await demo(t, "climb-read@example.com");
    for (const tool of CLIMB_TOOLS.filter((x) => x.risk === "read" && x.name !== "get_job" && x.name !== "get_draft")) {
      const out = await tool.run!(w.caller, w.slug, tool.input.parse({}) as never);
      expect(out, tool.name).toBeTruthy();
    }
    const drafts = (await CLIMB_TOOLS.find((x) => x.name === "list_drafts")!.run!(w.caller, w.slug, {} as never)) as { id: string; title: string }[];
    expect(drafts.length).toBeGreaterThan(0);
    const draft = (await CLIMB_TOOLS.find((x) => x.name === "get_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id } as never)) as { title: string; body: string };
    expect(draft.title).toBe(drafts[0].title);
    expect(draft.body.length).toBeGreaterThan(10);
  });

  it("draft tools prepare work; edits keep the other fields", async () => {
    const t = setup();
    const w = await demo(t, "climb-draft@example.com");
    const made = (await CLIMB_TOOLS.find((x) => x.name === "create_posts")!.run!(w.caller, w.slug, { channel: "linkedin", quantity: 1, brief: "Our Dec 20 holiday deadline" } as never)) as { runId: string };
    expect(made.runId).toBeTruthy();
    const drafts = (await CLIMB_TOOLS.find((x) => x.name === "list_drafts")!.run!(w.caller, w.slug, { status: "in_review" } as never)) as { id: string }[];
    const before = (await CLIMB_TOOLS.find((x) => x.name === "get_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id } as never)) as { hashtags: string[]; version: number };
    await CLIMB_TOOLS.find((x) => x.name === "edit_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id, body: "A shorter, sharper version." } as never);
    const after = (await CLIMB_TOOLS.find((x) => x.name === "get_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id } as never)) as { body: string; hashtags: string[]; version: number };
    expect(after.body).toBe("A shorter, sharper version.");
    expect(after.hashtags).toEqual(before.hashtags);
    expect(after.version).toBe(before.version + 1);
  });

  it("only opens real ClimbOS screens", () => {
    expect(safeAppPath("plan")).toBe("plan");
    expect(safeAppPath("/app/acme/content/abc123")).toBe("content/abc123");
    expect(safeAppPath("https://evil.example")).toBeNull();
    expect(safeAppPath("../../admin")).toBeNull();
  });

  it("answers in the panel, meters the run, and confirmations act only on tap", async () => {
    const t = setup();
    const w = await demo(t, "climb-loop@example.com");
    const { messageId, runId } = await w.client.mutation(api.climb.send, { slug: w.slug, text: "What's waiting for me?", screen: { path: `/app/${w.slug}/today`, title: "Today" } });
    await w.client.action(api.climb.respond, { slug: w.slug, messageId, runId });
    const thread = await w.client.query(api.climb.thread, { slug: w.slug });
    expect(thread.at(-1)?.role).toBe("assistant");
    const run = await t.run(async (ctx) => ctx.db.get(runId as Id<"workflowRuns">));
    expect(run?.status).toBe("verified");

    // A proposed approval waits; confirming runs it as the owner.
    const drafts = (await CLIMB_TOOLS.find((x) => x.name === "list_drafts")!.run!(w.caller, w.slug, { status: "in_review" } as never)) as { id: string }[];
    const orgUser = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", w.slug)).unique())!;
      return { orgId: org._id };
    });
    const actionId = await t.mutation(internal.climb.write, { orgId: orgUser.orgId, userId: w.userId, role: "action", text: "Approve a draft", status: "done", action: { tool: "approve_draft", input: JSON.stringify({ artifactId: drafts[0].id }), title: "Approve a draft", summary: "Approve it", status: "pending" } });
    let draft = (await CLIMB_TOOLS.find((x) => x.name === "get_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id } as never)) as { status: string };
    expect(draft.status).toBe("in_review");
    const res = await w.client.action(api.climb.confirm, { slug: w.slug, messageId: actionId });
    expect(res.ok).toBe(true);
    draft = (await CLIMB_TOOLS.find((x) => x.name === "get_draft")!.run!(w.caller, w.slug, { artifactId: drafts[0].id } as never)) as { status: string };
    expect(draft.status).not.toBe("in_review");
    expect((await w.client.action(api.climb.confirm, { slug: w.slug, messageId: actionId })).ok).toBe(false); // once only

    // Someone else can't confirm another person's action.
    const other = await asNewUser(t, "intruder@example.com");
    const res2 = await other.client.action(api.climb.confirm, { slug: w.slug, messageId: actionId });
    expect(res2.ok).toBe(false);
  });
});
