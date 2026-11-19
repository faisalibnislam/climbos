import { test, expect } from "@playwright/test";
import { openDemo, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { cli, rows } = localDemoFixtures(envFile);

test("owner defines a product measurement and sees incomplete evidence stay pending @mobile", async ({ page, baseURL, request }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(180000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page), org = (await rows("organizations")).find(r => r.slug === slug)!;
  const member = (await rows("memberships")).find(r => r.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|funnel-fixture`, tokenIdentifier: "test|funnel-fixture" });
  await cli(["run", "marketing:importContacts", JSON.stringify({ slug, csv: "email,segment\nfunnel@example.com,measurement-test" }), "--identity", identity]);
  const source = JSON.parse(await cli(["run", "productTracking:create", JSON.stringify({ slug, name: "Measurement server", scope: "Export product", mappings: [{ event: "signup", state: "started", criterion: "Account created" }, { event: "export", state: "activated", criterion: "Real export completed" }] }), "--identity", identity]));
  const before = await Promise.all(["approvals", "actionReceipts", "workflowRuns", "consentRecords", "emailLog"].map(async table => (await rows(table)).filter(r => r.orgId === org._id)));
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const event = { email: "funnel@example.com", event: "signup", eventId: "entry-1", occurredAt: new Date(Date.now() - 1000).toISOString() };
  expect((await request.post("http://127.0.0.1:3321/product-events", { headers: { authorization: `Bearer ${source.token}` }, data: event })).status()).toBe(200);
  await page.goto(`/app/${slug}/customers`); await page.getByRole("tab", { name: "Product tracking", exact: true }).click();
  await page.getByRole("button", { name: "Define a measurement", exact: true }).click();
  const form = page.getByRole("form", { name: "Define product measurement" });
  await form.getByLabel("Measurement name", { exact: true }).fill("Useful export journey");
  await form.getByLabel("Measurement source", { exact: true }).click(); await page.getByRole("option", { name: "Measurement server · Export product", exact: true }).click();
  for (const [field, option] of [["Entry event", "signup — Account created"], ["First value event", "export — Real export completed"], ["Repeat value event", "export — Real export completed"]]) { await form.getByLabel(field, { exact: true }).click(); await page.getByRole("option", { name: option, exact: true }).click(); }
  for (const [field, value] of [["Days allowed to reach first value", "3"], ["Repeat value window starts on day", "7"], ["Repeat value window ends before day", "14"], ["UTC dates to include", "30"]]) await form.getByLabel(field, { exact: true }).fill(value);
  await form.getByRole("button", { name: "Save measurement", exact: true }).click();
  const report = page.getByRole("region", { name: "Product measurements" });
  await expect(report.getByText("Useful export journey", { exact: true })).toBeVisible();
  await expect(report.getByText(/1 recorded entrants\. First value: Not mature yet/)).toBeVisible();
  await expect(report.getByText("Not mature yet · 1 pending", { exact: true })).toHaveCount(2);
  await report.getByText("Definitions and limitations", { exact: true }).click();
  await expect(report.getByText(/not verified churn or failure/)).toBeVisible();
  await expectAccessible(page, "Product event measurements"); await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("product-measurement.png"), fullPage: true });
  await report.getByRole("button", { name: "Remove definition Useful export journey", exact: true }).click();
  await expect(report.getByText("No measurement defined. Product activity and retention rates remain unknown.", { exact: true })).toBeVisible();
  expect(await Promise.all(["approvals", "actionReceipts", "workflowRuns", "consentRecords", "emailLog"].map(async table => (await rows(table)).filter(r => r.orgId === org._id)))).toEqual(before);
  expect(errors).toEqual([]);
});
