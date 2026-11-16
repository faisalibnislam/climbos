import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
const copyRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_id" && key !== "_creationTime"));

test("research shows source-matched and unchecked language without publishing @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires explicitly configured isolated loopback fixtures");
  test.setTimeout(150_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const demoSlug = await openDemo(page);
  const original = (await rows("organizations")).find(row => row.slug === demoSlug);
  if (!original || original.kind !== "demo") throw new Error("Isolated demo required");
  const member = (await rows("memberships")).find(row => row.orgId === original._id);
  const business = (await rows("businesses")).find(row => row.orgId === original._id);
  const goal = (await rows("goals")).find(row => row.orgId === original._id && row.status === "active");
  const plan = (await rows("strategies")).find(row => row.orgId === original._id);
  if (!member || !business || !goal || !plan) throw new Error("Demo records required");
  const slug = `language-evidence-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Language evidence fixture" }]);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  const insights = business.insights as Record<string, unknown>;
  await append("businesses", [{ ...copyRow(business), orgId: org._id, insights: { ...insights, expert: { alternatives: [], objections: [], gaps: [], positioningStatement: "Synthetic research only", confidenceNotes: "Not real customer data", vocPhrases: [
    { phrase: "Synthetic matched phrase about chasing a brief", theme: "Handoff", sourceUrl: "https://reviews.example/item?page=2", sourceReadAt: Date.parse("2026-11-14T10:00:00Z"), evidenceStatus: "text_matched" },
    { phrase: "Legacy candidate without source text", theme: "Workflow", sourceUrl: "https://reviews.example/legacy" },
  ], vocReview: { candidateCount: 4, matchedCount: 1, notMatchedCount: 1, uncheckedCount: 1, businessSiteCount: 1 } } } }]);
  const savedBusiness = (await rows("businesses")).find(row => row.orgId === org._id)!;
  await append("goals", [{ ...copyRow(goal), orgId: org._id }]);
  const savedGoal = (await rows("goals")).find(row => row.orgId === org._id)!;
  await append("strategies", [{ ...copyRow(plan), orgId: org._id, businessId: savedBusiness._id, goalId: savedGoal._id, runId: undefined }]);
  const snapshot = async () => Promise.all(["artifacts", "approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await snapshot();
  await page.goto(`/app/${slug}/plan`);
  await page.getByRole("tab", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Open research and plan details", exact: true }).click();
  await page.locator("summary").filter({ hasText: "What we found" }).click();
  const summary = page.locator("summary").filter({ hasText: "Customer language" });
  await summary.click();
  const panel = summary.locator("..");
  await expect(panel.getByText("Text matched", { exact: true })).toBeVisible();
  await expect(panel.getByText("Not checked", { exact: true })).toBeVisible();
  await expect(panel).toContainText("Source read 2026-11-14 (UTC)");
  await expect(panel).toContainText("does not verify the writer is a customer");
  await expect(panel.getByRole("link", { name: "Source", exact: false }).first()).toHaveAttribute("href", "https://reviews.example/item?page=2");
  await expect(panel).toContainText("These counts describe candidates, not customers");
  await panel.getByRole("link", { name: "Source", exact: false }).last().click({ trial: true });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "Customer-language research");
  await panel.screenshot({ path: testInfo.outputPath("customer-language.png") });
  expect(await snapshot()).toEqual(before);
});
