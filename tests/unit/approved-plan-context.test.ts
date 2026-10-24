import { describe, expect, it } from "vitest";
import { approvedPlanContext } from "../../shared/agents/approvedPlanContext";

describe("approved plan agent context", () => {
  it("carries the saved version, snapshot fingerprint, and measured play contract", () => {
    const context = approvedPlanContext({
      status: "approved",
      version: 4,
      summary: "Reach local clinics",
      positioning: "Scheduling for small clinics",
      audiences: ["Independent clinics"],
      expert: {
        snapshot: { snapshotId: "sha256:abc" },
        diagnosis: "Lead response time is the bottleneck",
        plays: [{ name: "Reply faster", oneLiner: "Offer same-day callbacks", actionContract: { intendedEffect: "Increase booked visits", measurement: { metric: "booked visits", baseline: "8 per month", target: "12 per month", windowDays: 60, source: "CRM" } } }],
      },
    });
    expect(context).toContain("Plan version: 4; context snapshot: sha256:abc");
    expect(context).toContain("Diagnosis: Lead response time is the bottleneck");
    expect(context).toContain("Measure: booked visits; 8 per month; 12 per month; 60 days; CRM");
  });

  it("does not carry draft or pending plans into agent content context", () => {
    expect(approvedPlanContext({ status: "needs_approval", version: 2, summary: "draft" })).toBe("");
  });

  it("bounds untrusted plan text", () => {
    const context = approvedPlanContext({ status: "approved", version: 1, summary: "x".repeat(20_000) });
    expect(context.length).toBeLessThanOrEqual(5_000);
  });
});
