import { describe, expect, it } from "vitest";
import { campaignApprovalScope } from "../../shared/policy/campaignScope";
import { approvalHash, checkApprovalForExecution } from "../../shared/policy";

describe("paid campaign approval scope", () => {
  const campaign = {
    connectionId: "connection-1",
    destinationUrl: "https://example.com/offer",
    dailyBudgetMinor: 2500,
    currency: "USD",
    startDate: "2026-10-25",
    endDate: "2026-11-01",
    targetCostPerConversionMinor: 5000,
    reviewAfterDays: 7,
  };

  it("binds the selected provider account and rejects a changed account before execution", async () => {
    const scope = campaignApprovalScope(campaign, "1234567890");
    const currentScope = campaignApprovalScope(campaign, "9876543210");
    const binding = {
      orgId: "org-1",
      subjectType: "campaign_activation",
      subjectId: "campaign-1",
      actionKind: "activate",
      contentHash: "approved-content",
      scope,
      policyVersion: 1,
      expiresAt: 50_000,
    };
    const check = await checkApprovalForExecution({
      approval: { status: "approved", approvalHash: await approvalHash(binding), expiresAt: 50_000, scope, contentHash: "approved-content", policyVersion: 1 },
      current: { ...binding, scope: currentScope },
      now: 1,
      emergencyStop: false,
      capabilityReady: true,
    });
    expect(scope.externalAccountId).toBe("1234567890");
    expect(check).toMatchObject({ ok: false, reason: "wrong_account" });
  });

  it("keeps fixture approvals scoped to their synthetic account", () => {
    expect(campaignApprovalScope(campaign, "demo_google_ads").externalAccountId).toBe("demo_google_ads");
  });
});
