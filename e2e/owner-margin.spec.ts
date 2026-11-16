import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
const copyRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_id" && key !== "_creationTime"));

test("owners can save zero and negative margins through both plan forms @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(90_000); page.setDefaultTimeout(15_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const demoSlug = await openDemo(page);
  const original = (await rows("organizations")).find(row => row.slug === demoSlug);
  if (!original || original.kind !== "demo") throw new Error("Isolated demo required");
  const member = (await rows("memberships")).find(row => row.orgId === original._id);
  const business = (await rows("businesses")).find(row => row.orgId === original._id);
  const goal = (await rows("goals")).find(row => row.orgId === original._id && row.status === "active");
  const plan = (await rows("strategies")).find(row => row.orgId === original._id);
  if (!member || !business || !goal || !plan) throw new Error("Demo records required");
  const slug = `margins-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Synthetic customer economics" }]);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  await append("businesses", [{ ...copyRow(business), orgId: org._id, unitEconomics: { updatedAt: Date.now() } }]);
  const savedBusiness = (await rows("businesses")).find(row => row.orgId === org._id)!;
  await append("goals", [{ ...copyRow(goal), orgId: org._id }]);
  const savedGoal = (await rows("goals")).find(row => row.orgId === org._id)!;
  const expert = plan.expert as Record<string, unknown>;
  await append("strategies", [{ ...copyRow(plan), orgId: org._id, businessId: savedBusiness._id, goalId: savedGoal._id, runId: undefined, approvalId: undefined, status: "approved", expert: { ...expert,
    economics: { revenuePerCustomerMonthUsd: 20, grossMargin: null, monthlyChurn: null, basis: "Synthetic test inputs; missing owner numbers remain unknown", assumed: ["margin", "churn"] },
    plays: [{ ...(expert.plays as Record<string, unknown>[])[0], horizonDays: 90, unit: "paying customers", model: { weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 100, ownerHoursPerWeek: 0 } }],
  } }]);
  const effects = async () => Promise.all(["artifacts", "approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects();
  const open = async () => {
    await page.goto(`/app/${slug}/plan`);
    await page.getByRole("tab", { name: "Research", exact: true }).click();
    await page.getByRole("button", { name: "Open research and plan details", exact: true }).click();
    await page.locator("summary").filter({ hasText: "Other ideas, numbers and questions" }).click();
  };
  await open();
  const sharpen = page.getByRole("heading", { name: "Sharpen this plan" }).locator("../..");
  await sharpen.getByLabel(/Margin after delivery/).fill("-50–0");
  await sharpen.getByRole("button", { name: "Update", exact: true }).click();
  const economics = async () => (await rows("businesses")).find(row => row._id === savedBusiness._id)!.unitEconomics as Record<string, unknown>;
  await expect.poll(economics).toMatchObject({ grossMargin: -0.25, ranges: { margin: { low: -0.5, high: 0 } } });
  await open();
  const numbers = page.getByRole("region", { name: "Add a few numbers", exact: true });
  const margin = numbers.getByRole("textbox", { name: /What share do you keep after delivery costs/ });
  const churn = numbers.getByRole("textbox", { name: /Of 100 customers/ });
  await expect(margin).toHaveValue("-25");
  await margin.fill("0"); await churn.fill("0");
  await numbers.getByRole("button", { name: "Save numbers", exact: true }).click();
  await expect.poll(economics).toMatchObject({ grossMargin: 0, monthlyChurn: 0 });
  expect(await economics()).not.toHaveProperty("ranges.margin");
  await open();
  await expect(margin).toHaveValue("0"); await expect(churn).toHaveValue("0");
  await margin.fill("-200");
  await numbers.getByRole("button", { name: "Save numbers", exact: true }).click();
  await expect.poll(economics).toMatchObject({ grossMargin: -2, monthlyChurn: 0 });
  await open(); await expect(margin).toHaveValue("-200");
  await expectNoHorizontalScroll(page); await expectAccessible(page, "Owner margin inputs");
  await numbers.screenshot({ path: testInfo.outputPath("owner-margin.png") });
  expect(await effects()).toEqual(before);
});
