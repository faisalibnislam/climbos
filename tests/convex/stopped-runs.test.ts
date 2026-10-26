import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";
import { RUN_FAILURE_COPY, runMessage } from "../../shared/progress";

async function addRun(t: T, orgId: Id<"organizations">, fields: { kind: string; status: string; createdAt: number; resumeWith?: { fn: string; args: string }; userMessage?: string }) {
  return t.run(async (ctx) =>
    ctx.db.insert("workflowRuns", {
      orgId,
      kind: fields.kind as never,
      title: fields.kind === "onboarding_research" ? "Understand your business" : "Build your growth plan",
      status: fields.status as never,
      input: "{}",
      roles: [],
      estimateMicros: 30_000,
      actualMicros: 12_000,
      rateVersionId: "test",
      entitlementVersionId: "test",
      routingVersionId: "test",
      budget: { modelSteps: 0, researchTools: 0, repairs: 0 },
      used: { modelSteps: 0, researchTools: 0, repairs: 0 },
      isFixture: false,
      createdAt: fields.createdAt,
      updatedAt: fields.createdAt,
      ...(fields.resumeWith ? { resumeWith: fields.resumeWith } : {}),
      ...(fields.userMessage ? { userMessage: fields.userMessage } : {}),
    }),
  );
}

describe("stopped jobs in Recent work", () => {
  it("marks failures replaced by newer work, offers Try again only when the job can continue, and dismisses", async () => {
    const t = setup();
    const owner = await asNewUser(t, "stopped@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Stopped Co" });
    const org = orgId as Id<"organizations">;
    const now = Date.now();
    const research = await addRun(t, org, { kind: "onboarding_research", status: "failed", createdAt: now - 5_000, resumeWith: { fn: "onboardingResearch", args: "{}" }, userMessage: "The AI's answer didn't pass our quality checks. Nothing was saved." });
    const oldPlan = await addRun(t, org, { kind: "strategy", status: "failed", createdAt: now - 4_000, resumeWith: { fn: "buildStrategy", args: "{}" } });
    await addRun(t, org, { kind: "strategy", status: "verified", createdAt: now - 3_000 });
    const notResumable = await addRun(t, org, { kind: "onboarding_research", status: "failed", createdAt: now - 6_000 });

    const rows = await owner.client.query(api.workspace.runs, { slug });
    const byId = (id: Id<"workflowRuns">) => rows.find((r) => r.id === id)!;
    expect(byId(oldPlan)).toMatchObject({ replaced: true, canRetry: false });
    expect(byId(research)).toMatchObject({ replaced: false, canRetry: true, retryMicros: 18_000 });
    expect(byId(notResumable)).toMatchObject({ replaced: false, canRetry: false });

    await owner.client.mutation(api.workspace.dismissRun, { slug, runId: research });
    const after = await owner.client.query(api.workspace.runs, { slug });
    expect(after.some((r) => r.id === research)).toBe(false);
    const audit = await t.run(async (ctx) => (await ctx.db.query("auditEvents").collect()).filter((e) => e.action === "run.dismissed"));
    expect(audit).toHaveLength(1);

    const verified = rows.find((r) => r.status === "verified")!;
    await expect(owner.client.mutation(api.workspace.dismissRun, { slug, runId: verified.id })).rejects.toThrow(/stopped/);
  });

  it("shows older stored failure text in the current plain wording", () => {
    expect(runMessage("The AI's answer didn't pass our quality checks. Nothing was saved.")).toBe(RUN_FAILURE_COPY.invalidOutput);
    expect(runMessage("Something specific happened.")).toBe("Something specific happened.");
    expect(runMessage(null)).toBeNull();
  });
});
