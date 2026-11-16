import { expect, test } from "@playwright/test";
import { demoBusinessModelCheck } from "../shared/agents/businessModel";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

test("business model view keeps the latest decision for every alternative after a long history @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Business model fixtures require a new demo workspace");
  const member = (await rows("memberships")).find(row => row.orgId === org._id && row.role === "owner");
  if (!member) throw new Error("Demo owner required");
  const now = Date.now();
  const check = demoBusinessModelCheck("Synthetic model history");
  await append("workflowRuns", [{ orgId: org._id, kind: "business_model_check", title: "Synthetic model history check", status: "verified", input: "{}", output: JSON.stringify(check), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: true, createdAt: now, updatedAt: now }]);
  const run = (await rows("workflowRuns")).find(row => row.orgId === org._id && row.title === "Synthetic model history check");
  if (!run) throw new Error("Synthetic run missing");
  const base = { orgId: org._id, runId: run._id, testState: "observed", outcomeEvidence: "owner_reported", ownerDecision: "keep_testing", createdBy: member.userId, createdAt: now - 10_000 };
  await append("businessModelTests", [
    ...["deciding", "grounded", "adjacent", "bold"].map(target => ({ ...base, target, outcomeNote: `Retain ${target} evidence` })),
    ...Array.from({ length: 205 }, (_, i) => ({ ...base, target: "adjacent", ownerDecision: "drop_alternative", outcomeNote: `Adjacent update ${i}`, createdAt: now - 9_000 + i })),
  ]);
  const snapshot = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns", "businessModelTests"].map(async table => (await rows(table)).filter(row => row.orgId === org._id).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const before = await snapshot();
  await page.goto(`/app/${slug}/business-model`);
  for (const option of check.alternatives) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: option.name, exact: true }) });
    await expect(card.getByRole("textbox", { name: "What happened" })).toHaveValue(option.mode === "adjacent" ? "Adjacent update 204" : `Retain ${option.mode} evidence`);
    await expect(card.getByRole("combobox", { name: "Your decision" })).toHaveText(option.mode === "adjacent" ? "Drop this alternative" : "Keep testing");
  }
  await expect(page.getByText("Bold · may have no precedent", { exact: true })).toBeVisible();
  await expectAccessible(page, "business model latest decisions");
  await expectNoHorizontalScroll(page);
  await page.getByText("Bold · may have no precedent", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("business-model-latest.png"), fullPage: false });
  expect(await snapshot()).toEqual(before);
  expect(errors).toEqual([]);
});
