import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function addAudit(t: ReturnType<typeof setup>, orgId: string, createdAt: number, region: string) {
  return await t.run(async (ctx) => ctx.db.insert("workflowRuns", {
    orgId: orgId as never, kind: "conversion_audit", title: "Website review", status: "verified", input: "{}",
    output: JSON.stringify({ designCritic: { findings: [{ lens: "conversion_trust", region, sourceUrl: "https://www.example.com/pricing/", observation: "Proof is below the fold." }] } }),
    roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test",
    budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt, updatedAt: createdAt, finishedAt: createdAt,
  }));
}

describe("design finding decisions across audits", () => {
  it("shows an earlier dismissal on the matching finding of a later audit and passes it to the next audit, within the workspace only", async () => {
    const t = setup();
    const owner = await asNewUser(t, "decisions-owner@example.com");
    const other = await asNewUser(t, "decisions-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Decisions Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const now = Date.now();
    const first = await addAudit(t, orgId, now - 30 * 86_400_000, "Pricing hero");
    await owner.client.mutation(api.designCritic.setFeedback, { slug, runId: first, findingIndex: 0, status: "dismissed", note: "We keep proof lower on purpose." });
    const second = await addAudit(t, orgId, now, "pricing  hero");

    expect(await owner.client.query(api.designCritic.priorDecisions, { slug, runId: second })).toEqual([{ findingIndex: 0, status: "dismissed", decidedAt: expect.any(Number), note: "We keep proof lower on purpose." }]);
    // The earlier audit has no earlier decisions of its own.
    expect(await owner.client.query(api.designCritic.priorDecisions, { slug, runId: first })).toEqual([]);
    await expect(other.client.query(api.designCritic.priorDecisions, { slug: otherSlug, runId: second })).rejects.toThrow();

    // A new audit run receives the decision and the owner's note.
    const auditRun = await t.run(async (ctx) => ctx.db.insert("workflowRuns", { ...(await ctx.db.get(second))!, _id: undefined, _creationTime: undefined, status: "executing", output: undefined, createdAt: now + 1 } as never));
    const context = await t.query(internal.jobWrites.jobContext, { runId: auditRun });
    expect(context?.priorDesignDecisionsText).toContain("[dismissed] conversion_trust");
    expect(context?.priorDesignDecisionNotes).toEqual(["conversion_trust · Pricing hero: We keep proof lower on purpose."]);
  });
});
