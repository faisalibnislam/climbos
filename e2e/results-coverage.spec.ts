import { expect, test } from "@playwright/test";
import { addDays } from "../shared/forecasting/series";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
const copyRow = ({ _id: _i, _creationTime: _c, ...data }: Record<string, unknown>) => data;

test("Results and Home preserve coverage and withhold incompatible totals @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the isolated local fixture backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const originalSlug = await openDemo(page);
  const original = (await rows("organizations")).find(row => row.slug === originalSlug);
  if (!original || original.kind !== "demo") throw new Error("Reporting fixtures require a demo workspace");
  const member = (await rows("memberships")).find(row => row.orgId === original._id && row.role === "owner" && row.status === "active");
  if (!member) throw new Error("Demo owner membership missing");
  const slug = `coverage-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Coverage fixture", kind: "demo" }]);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Isolated reporting workspace missing");
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: String(org.timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const point = (metricKey: string, value: number, source = "fixture-analytics") => ({ orgId: org._id, metricKey, date: addDays(today, -1), value, source, kind: "observed", isFixture: true, ingestedAt: Date.now(), workspaceTimezone: org.timezone, workspaceCurrency: org.currency });
  await append("metricDaily", [point("visits", 200), point("signups", 10), point("revenue", -1000, "billing")]);
  const effects = async () => Promise.all(["workflowRuns", "approvals", "actionReceipts", "forecastRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/results`);
  await expect(page.getByRole("heading", { name: "Visits, sign-ups and customers", exact: true })).toBeVisible();
  await expect(page.getByText("Recorded subtotal from 1 of 30 days. Missing days remain unknown.").first()).toBeVisible();
  await expect(page.getByText(/not a linked conversion funnel/)).toBeVisible();
  await expect(page.getByText(/5% from step/)).toHaveCount(0);
  await expectAccessible(page, "partial Results coverage");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("partial-results.png"), fullPage: true });

  // A second source on the same date must not become a 300-visit total or a ratio.
  await append("metricDaily", [point("visits", 100, "overlapping-fixture-import")]);
  await expect(page.getByText(/Total unavailable: duplicate or overlapping/).first()).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await page.goto(`/app/${slug}/today`);
  await page.getByRole("tab", { name: "Results", exact: true }).click();
  const home = page.locator("section").filter({ has: page.getByRole("heading", { name: "Last 30 days", exact: true }) });
  await expect(home.getByText(/Total unavailable: duplicate or overlapping/)).toBeVisible();
  await expect(home.getByText("—", { exact: true })).toBeVisible();
  await expect(home.getByText(/Recorded subtotal from 1 of 30 days/)).toBeVisible();
  await expectAccessible(page, "Home coverage");
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
  expect(await effects()).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath("home-coverage.png"), fullPage: true });
});
