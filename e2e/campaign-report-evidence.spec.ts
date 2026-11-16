import { expect, test } from "@playwright/test";
import { campaignReportWindow } from "../shared/acquisition/campaignReport";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
const copyRow = ({ _id: _i, _creationTime: _c, ...data }: Record<string, unknown>) => data;

test("shows validated report context and requires legacy evidence refresh @mobile", async ({ page, baseURL }, testInfo) => {
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
  const slug = `ad-report-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Campaign report fixture", currency: "USD" }]);
  const org = (await rows("organizations")).find(r => r.slug === slug)!;
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  await append("autonomyPolicies", [{ ...copyRow(policy), orgId: org._id, currency: "USD", mode: "review" }]);
  const now = Date.now();
  await append("connections", [{ orgId: org._id, provider: "google_ads", status: "connected", externalAccountId: "1234567890", scopes: [], isFixture: true, createdBy: member.userId, createdAt: now, updatedAt: now }]);
  const connection = (await rows("connections")).find(r => r.orgId === org._id)!;
  const startDate = new Date(now - 6 * 86_400_000).toISOString().slice(0, 10);
  const endDate = new Date(now + 2 * 86_400_000).toISOString().slice(0, 10);
  const base = { orgId: org._id, channel: "google_search_ad", status: "active", dailyBudgetMinor: 1000, budgetEnvelopeMinor: 9000, budgetUnitVersion: "currency-minor-v1", currency: "USD", startDate, endDate, stopRules: [], connectionId: connection._id, targetCostPerConversionMinor: 100, reviewAfterDays: 7, createdAt: now, updatedAt: now };
  await append("campaigns", [{ ...base, name: "Current report fixture", externalId: "42" }, { ...base, name: "Legacy report fixture", externalId: "43" }]);
  const campaigns = (await rows("campaigns")).filter(r => r.orgId === org._id);
  const window = campaignReportWindow({ startDate, endDate }, "Pacific/Honolulu", now);
  for (const campaign of campaigns) {
    await append("campaignPerformance", [{ orgId: org._id, campaignId: campaign._id, connectionId: connection._id, source: "google_ads", status: "ready", ...window, currency: "USD", spendMinor: campaign.externalId === "42" ? 123 : 999999, clicks: 4, impressions: 100, conversions: 2, syncedAt: now,
      ...(campaign.externalId === "42" ? { requestedAt: now, timeZone: "Pacific/Honolulu", externalAccountId: "1234567890", externalCampaignId: "42", validationVersion: 1, rowCount: 1 } : {}),
    }]);
  }
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`/app/${slug}/content?tab=ads`);
  await page.getByRole("tab", { name: "Ads", exact: true }).click();
  const card = (name: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const current = card("Current report fixture");
  await expect(current.getByText("$1.23", { exact: true })).toBeVisible();
  await expect(current.getByText("$0.62", { exact: true })).toBeVisible();
  await expect(current.getByText(/ad account timezone: Pacific\/Honolulu/)).toBeVisible();
  await expect(current.getByText(/1 daily row returned/)).toBeVisible();
  const legacy = card("Legacy report fixture");
  await expect(legacy.getByText("Refresh campaign evidence", { exact: true })).toBeVisible();
  await expect(legacy.getByText(/older report/)).toBeVisible();
  await expect(legacy.getByText("$9,999.99", { exact: true })).toHaveCount(0);
  await expect(legacy.getByRole("button", { name: "Refresh results", exact: true })).toBeVisible();
  expect((await rows("campaignPerformance")).find(r => r.orgId === org._id && r.spendMinor === 999999)).toBeTruthy();
  expect((await rows("actionReceipts")).filter(r => r.orgId === org._id)).toHaveLength(0);
  await expectAccessible(page, "campaign report evidence");
  await expectNoHorizontalScroll(page);
  await current.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("campaign-report-evidence.png"), fullPage: true });
  expect(errors).toEqual([]);
});
