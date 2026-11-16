import { expect, test } from "@playwright/test";
import { approvalHash, canonicalJson, sha256Hex } from "../shared/policy";
import { campaignApprovalScope } from "../shared/policy/campaignScope";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { cli, rows, append } = localDemoFixtures(envFile);
const copyRow = ({ _id: _i, _creationTime: _c, ...data }: Record<string, unknown>) => data;

test("campaign approval, cancellation and interrupted-write states @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures");
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const demoSlug = await openDemo(page);
  const original = (await rows("organizations")).find(r => r.slug === demoSlug);
  if (!original || original.kind !== "demo") throw new Error("Demo workspace required");
  const member = (await rows("memberships")).find(r => r.orgId === original._id);
  const policy = (await rows("autonomyPolicies")).find(r => r.orgId === original._id && r.active);
  if (!member || !policy) throw new Error("Demo owner and policy required");
  const slug = `ad-approval-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Campaign approval fixture", kind: "demo", currency: "USD" }]);
  const org = (await rows("organizations")).find(r => r.slug === slug)!;
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  await append("autonomyPolicies", [{ ...copyRow(policy), orgId: org._id, mode: "review", version: 1 }]);
  const now = Date.now();
  await append("connections", [{ orgId: org._id, provider: "meta_ads", status: "connected", externalAccountId: "demo_account", scopes: [], isFixture: true, createdBy: member.userId, createdAt: now, updatedAt: now }]);
  const connection = (await rows("connections")).find(r => r.orgId === org._id)!;
  const base = { orgId: org._id, channel: "meta_ad", status: "needs_approval", dailyBudgetMinor: 1000, budgetEnvelopeMinor: 10000, currency: "USD", startDate: "2026-11-17", endDate: "2026-11-26", targetCostPerConversionMinor: 2000, reviewAfterDays: 7, stopRules: [], connectionId: connection._id, createdAt: now, updatedAt: now };
  await append("campaigns", [
    { ...base, name: "Ready fixture" }, { ...base, name: "Queued fixture" },
    { ...base, name: "Blocked start fixture", status: "created_paused", externalId: "demo_blocked" },
    { ...base, name: "Interrupted fixture" }, { ...base, name: "Queued start fixture", status: "created_paused", externalId: "demo_existing" },
  ]);
  const campaigns = (await rows("campaigns")).filter(r => r.orgId === org._id);
  for (const c of campaigns.filter(r => r.name !== "Ready fixture")) {
    const action = c.externalId ? "activate" : "create_paused";
    const scope = campaignApprovalScope(c as unknown as Parameters<typeof campaignApprovalScope>[0], "demo_account");
    const contentHash = await sha256Hex(canonicalJson({ name: String(c.name), channel: "meta_ad", action, stopRules: [] }));
    const binding = { orgId: String(org._id), subjectType: "campaign_activation", subjectId: String(c._id), actionKind: action, contentHash, scope, policyVersion: 1, expiresAt: now + 86_400_000 };
    await append("approvals", [{ ...binding, title: String(c.name), costEstimateMicros: 0, approvalHash: await approvalHash(binding), status: "approved", decidedBy: member.userId, decidedAt: now, createdAt: now, ...(c.name === "Interrupted fixture" ? { executionStartedAt: now - 6 * 60_000 } : {}), ...(c.name === "Blocked start fixture" ? { status: "invalidated", executionStartedAt: now - 1000, executionFinishedAt: now, executionOutcome: "failed", invalidatedReason: "The Meta campaign spend cap differs from the approved total. ClimbOS has not changed it." } : {}) }]);
  }
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`/app/${slug}/content?tab=ads`);
  await page.getByRole("tab", { name: "Ads", exact: true }).click();
  const card = (name: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card("Blocked start fixture").getByText("Last request did not complete", { exact: true })).toBeVisible();
  await expect(card("Blocked start fixture").getByText(/spend cap differs from the approved total/)).toBeVisible();
  await expect(card("Blocked start fixture").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await expect(card("Queued fixture").getByText("Approval queued", { exact: true })).toBeVisible();
  await expect(card("Queued fixture").getByText("Approved, queued", { exact: true })).toBeVisible();
  await expect(card("Queued fixture").getByRole("button", { name: "Create paused", exact: true })).toBeDisabled();
  await card("Queued fixture").getByRole("button", { name: "Don't create", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Don't create", exact: true }).click();
  await expect(card("Queued fixture").getByText("Not created", { exact: true })).toBeVisible();
  await card("Queued start fixture").getByRole("button", { name: "Cancel start", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel start", exact: true }).click();
  await expect(card("Queued start fixture").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  for (const name of ["Queued fixture", "Queued start fixture"]) {
    const c = campaigns.find(r => r.name === name)!;
    const a = (await rows("approvals")).find(r => r.subjectId === c._id)!;
    expect(a.status).toBe("invalidated");
    await cli(["run", "ads:executeCampaignWrite", JSON.stringify({ campaignId: c._id, approvalId: a._id })]);
  }
  await expect(card("Interrupted fixture").getByText(/only reads status/)).toBeVisible();
  await expect(card("Interrupted fixture").getByText("Result pending", { exact: true })).toBeVisible();
  await expect(card("Interrupted fixture").getByRole("button", { name: "Create paused", exact: true })).toBeDisabled();
  await expect(card("Interrupted fixture").getByRole("button", { name: "Don't create", exact: true })).toBeDisabled();
  await card("Interrupted fixture").getByRole("button", { name: "Check provider result", exact: true }).click();
  await expect(card("Interrupted fixture").getByText(/Demo campaigns have no live provider result/)).toBeVisible();
  const interrupted = campaigns.find(r => r.name === "Interrupted fixture")!;
  expect((await rows("actionReceipts")).filter(r => r.campaignId === interrupted._id)).toHaveLength(0);
  expect((await rows("approvals")).find(r => r.subjectId === interrupted._id)?.executionFinishedAt).toBeUndefined();
  await card("Ready fixture").getByRole("button", { name: "Create paused", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Create paused", exact: true }).click();
  await expect(card("Ready fixture").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await card("Ready fixture").getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("alertdialog").getByText(/checks the current provider account and budget/)).toBeVisible();
  await expect(page.getByRole("alertdialog").getByText(/Check ad-set schedules/)).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start at $10.00/day", exact: true }).click();
  await expect(card("Ready fixture").getByText("Running", { exact: true })).toBeVisible();
  const receipts = (await rows("actionReceipts")).filter(r => r.orgId === org._id);
  expect(receipts.filter(r => r.status === "fixture_verified")).toHaveLength(2);
  expect(receipts.every(r => ["fixture_verified", "failed"].includes(String(r.status)))).toBe(true);
  const approvals = (await rows("approvals")).filter(r => r.orgId === org._id && r.status === "consumed");
  expect(approvals).toHaveLength(2);
  for (const a of approvals) {
    expect(a.scope).toMatchObject({ externalAccountId: "demo_account", totalSpendLimitMinor: 10000, targetCostPerConversionMinor: 2000, reviewAfterDays: 7 });
    expect(typeof a.executionStartedAt).toBe("number");
    expect(typeof a.executionFinishedAt).toBe("number");
  }
  expect(approvals.find(a => a.actionKind === "activate")?.scope).toHaveProperty("externalCampaignId");
  await expectAccessible(page, "campaign approval states");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("campaign-approval-states.png"), fullPage: true });
  expect(errors).toEqual([]);
});
