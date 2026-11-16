import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

test("design queue reaches older audits, groups repeats and saves exact-finding corrections @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires an explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Only a demo workspace may receive these fixtures");
  const now = Date.now();
  await append("workflowRuns", Array.from({ length: 13 }, (_, i) => ({
    orgId: org._id, kind: "conversion_audit", title: `Synthetic queue audit ${i}`, status: i > 2 ? "failed" : "verified", input: "{}",
    ...(i < 3 ? { output: JSON.stringify({ designCritic: { coverage: "text_only", findings: [{ lens: "usability", region: "Contact form", sourceUrl: i === 2 ? "https://example.com/booking" : "https://example.com/contact", observation: ["Missing input label", "Label still missing", "Booking needs a label"][i], evidence: "Synthetic label check", classification: "automated_check", automatedCheckIds: ["label"], confidence: "low", whyItMatters: "Customers need to understand the field", businessOrUserGoal: "Complete qualified inquiries", proposedChange: "Review an accessible label", directions: [{ id: "quick", name: "Label the input", responseLevel: "quick_fix", effort: "Confirm with the page maintainer", assumptions: ["Template access"], risks: ["Check nearby layout"] }, { id: "bold", name: "Guided inquiry", responseLevel: "bold_alternative", effort: "Unknown; scope first" }] }] } }) } : {}),
    roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: true, createdAt: now - (13 - i) * 86_400_000, updatedAt: now,
  })));
  const snapshot = async () => Promise.all(["workflowRuns", "approvals", "actionReceipts", "landingPages"].map(async table => (await rows(table)).filter(row => row.orgId === org._id).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const before = await snapshot();
  await page.goto(`/app/${slug}/work`);
  await page.getByRole("tab", { name: "Design opportunities", exact: true }).click();
  const queue = page.getByRole("region", { name: "Design opportunities", exact: true });
  await expect(queue.getByText("No usable design findings in the records loaded so far. Load older audits below.")).toBeVisible();
  await queue.getByRole("button", { name: "Load older design audits" }).click();
  await expect(queue.getByRole("article")).toHaveCount(2);
  const repeated = queue.getByRole("article").filter({ has: page.getByText("Label still missing", { exact: true }) });
  await repeated.getByText("1 earlier matching observation · not extra evidence", { exact: true }).click();
  await expect(repeated.getByText("Missing input label", { exact: true })).toBeVisible();
  await repeated.getByText("Options, effort and dependencies", { exact: true }).first().click();
  await expect(repeated.getByText("Guided inquiry · bold alternative", { exact: true }).first()).toBeVisible();
  await repeated.getByText("Review or correct this finding", { exact: true }).click();
  await repeated.getByRole("combobox", { name: "Your review of this finding" }).click();
  await page.getByRole("option", { name: "I corrected the finding", exact: true }).click();
  await repeated.getByRole("textbox", { name: "Correction or context" }).fill("The current mobile label is visible. Keep the older capture for context.");
  await repeated.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(repeated.getByText("Owner marked corrected", { exact: true }).first()).toBeVisible();
  const saved = (await rows("designFindingReviews")).filter(row => row.orgId === org._id);
  expect(saved).toHaveLength(1);
  const exactAudit = (await rows("workflowRuns")).find(row => row.orgId === org._id && row.title === "Synthetic queue audit 1")!;
  expect(saved[0]).toMatchObject({ runId: exactAudit._id, findingIndex: 0, status: "corrected" });
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "design opportunity queue");
  await page.screenshot({ path: testInfo.outputPath("design-opportunities.png"), fullPage: true });
  expect(await snapshot()).toEqual(before);
  await repeated.getByRole("link", { name: "Open exact audit finding", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/work/${exactAudit._id}#design-finding-0$`));
  const finding = page.locator("#design-finding-0");
  await expect(finding.getByText("Owner marked corrected", { exact: true })).toBeVisible();
  await finding.getByRole("textbox", { name: "Note or correction" }).fill("Confirmed in the exact audit review too.");
  await finding.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(finding.getByText("Confirmed in the exact audit review too.", { exact: true })).toBeVisible();
  expect((await rows("designFindingReviewEvents")).filter(row => row.orgId === org._id)).toHaveLength(2);
  expect(await snapshot()).toEqual(before);
  expect(errors).toEqual([]);
});
