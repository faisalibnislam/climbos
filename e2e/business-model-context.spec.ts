import { expect, test } from "@playwright/test";
import { MODEL_EVIDENCE_GROUPS } from "../shared/agents/businessModelFreshness";
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
  check.currentModel.evidenceRefs = ["fact:0"];
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
  await expect(page.getByText("Review this saved judgment", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business model described in this report", exact: true })).toBeVisible();
  await page.getByText("Business fact 1 · original text unavailable", { exact: true }).click();
  await expect(page.getByText("This older report did not retain the original fact text. Current business facts may differ.", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="#sources-heading"]')).toHaveCount(0);
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
  // A reactive new check must not inherit an unsaved note for a different hypothesis.
  const oldBold = page.getByRole("article").filter({ has: page.getByRole("heading", { name: check.alternatives.find(a => a.mode === "bold")!.name, exact: true }) });
  await oldBold.getByRole("textbox", { name: "What happened" }).fill("Unsaved note for the earlier idea");
  const nextCheck = demoBusinessModelCheck("New synthetic model");
  nextCheck.currentModel.evidenceRefs = ["fact:0"];
  nextCheck.alternatives[0].unitEconomicsInputs = [{ input: "Recorded current plan price", value: "$49", basis: "owner_report", evidenceRefs: ["fact:0"] }];
  const sourceSnapshot = { businessModelEvidence: { version: 1, capturedAt: now, contextHash: "a".repeat(64), hashes: Object.fromEntries(MODEL_EVIDENCE_GROUPS.map(key => [key, "a".repeat(64)])), facts: [{ statement: "Original owner price was $49; this report does not establish current pricing.", basis: "owner_reported" }] } };
  nextCheck.alternatives.find(a => a.mode === "bold")!.name = "New partner-led model";
  const { _id: _oldId, _creationTime: _oldCreation, ...copy } = run;
  await append("workflowRuns", [{ ...copy, title: "New synthetic model check", input: JSON.stringify(sourceSnapshot), output: JSON.stringify(nextCheck), createdAt: Date.now() + 1, updatedAt: Date.now() + 1 }]);
  const next = (await rows("workflowRuns")).find(row => row.orgId === org._id && row.title === "New synthetic model check")!;
  const newBold = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "New partner-led model", exact: true }) });
  await expect(newBold.getByRole("combobox", { name: "Test status", exact: true })).toHaveText("Not started");
  await page.getByText("Business fact 1 · owner-reported", { exact: true }).first().click();
  await expect(page.getByText("Original owner price was $49; this report does not establish current pricing.", { exact: true }).first()).toBeVisible();
  await expect(page.locator('a[href="#sources-heading"]')).toHaveCount(0);
  await page.getByText("Business fact 1 · owner-reported", { exact: true }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("business-model-original-source.png"), fullPage: false });
  await expect(newBold.getByRole("textbox", { name: "What happened" })).toHaveCount(0);
  await newBold.getByRole("combobox", { name: "Test status", exact: true }).click();
  await page.getByRole("option", { name: "Result observed", exact: true }).click();
  await expect(newBold.getByRole("textbox", { name: "What happened" })).toHaveValue("");
  await newBold.getByRole("textbox", { name: "What happened" }).fill("New hypothesis result is still unclear");
  await newBold.getByRole("combobox", { name: "Test outcome", exact: true }).click();
  await page.getByRole("option", { name: "Result unclear", exact: true }).click();
  await newBold.getByRole("button", { name: "Save test result", exact: true }).click();
  await expect(page.getByText("Test result saved", { exact: true })).toBeVisible();
  const newReports = (await rows("businessModelTests")).filter(row => row.runId === next._id);
  expect(newReports).toHaveLength(1);
  expect(newReports[0]).toMatchObject({ target: "bold", outcome: "unclear", outcomeNote: "New hypothesis result is still unclear" });
  await append("businessModelTests", [{ ...base, runId: next._id, target: "bold", outcome: "missed", outcomeNote: "A newer report reviewed the source records", createdAt: Date.now() + 1 }]);
  await expect(newBold.getByText("A newer result was saved", { exact: true })).toBeVisible();
  await expect(newBold.getByRole("button", { name: "Save test result", exact: true })).toBeDisabled();
  await expect(newBold.getByRole("textbox", { name: "What happened" })).toHaveValue("New hypothesis result is still unclear");
  await newBold.getByRole("button", { name: "Reload saved result", exact: true }).click();
  await expect(newBold.getByRole("textbox", { name: "What happened" })).toHaveValue("A newer report reviewed the source records");
  await expect(newBold.getByRole("combobox", { name: "Test outcome", exact: true })).toHaveText("Missed the test goal");
  await page.getByText("Test history", { exact: true }).click();
  await expect(page.getByText("New hypothesis result is still unclear", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load older reports", exact: true })).toBeVisible();
  await expect(page.getByText(check.alternatives.find(a => a.mode === "adjacent")!.name, { exact: true }).last()).toBeVisible();
  await expectAccessible(page, "business model version-bound report history");
  await expectNoHorizontalScroll(page);
  const after = await snapshot();
  expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
  expect(after[3]).toHaveLength(before[3].length + 2);
  expect(errors).toEqual([]);
});


test("business model check explains changed evidence without rerunning or executing @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Freshness check requires an isolated demo workspace");
  await page.goto(`/app/${slug}/business-model`);
  await page.getByRole("button", { name: "Check my business model", exact: true }).click();
  await expect(page.getByText("Saved inputs match", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "How the business makes money today", exact: true })).toBeVisible();
  const snapshot = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const before = await snapshot();
  const fact = (await rows("businessFacts")).find(row => row.orgId === org._id);
  if (!fact) throw new Error("Demo business fact required");
  const { _id: _id, _creationTime: _creationTime, ...copy } = fact;
  await append("businessFacts", [{ ...copy, statement: "Synthetic owner update: the service now requires a discovery session before booking.", reviewState: "confirmed", updatedAt: Date.now(), verifiedAt: Date.now() }]);
  await expect(page.getByText("Review this saved judgment", { exact: true })).toBeVisible();
  await expect(page.getByText("Changed: Reviewed business facts.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business model described in this report", exact: true })).toBeVisible();
  await expect(page.getByText("Bold · may have no precedent", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again", exact: true })).toBeEnabled();
  await expectAccessible(page, "business model evidence changed");
  await expectNoHorizontalScroll(page);
  while (await page.getByRole("button", { name: "Dismiss notification", exact: true }).count()) await page.getByRole("button", { name: "Dismiss notification", exact: true }).first().click();
  await page.screenshot({ path: testInfo.outputPath("business-model-freshness.png"), fullPage: false });
  expect(await snapshot()).toEqual(before);
});
