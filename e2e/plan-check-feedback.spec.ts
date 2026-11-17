import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

test("old provisional source errors explain the current approval block @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the isolated local demo backend");
  test.setTimeout(120_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  expect(org.kind).toBe("demo");
  const plan = (await rows("strategies")).find(row => row.orgId === org._id)!;
  const { _id, _creationTime, ...copy } = plan;
  await append("strategies", [{ ...copy, status: "needs_approval", approvalId: undefined, version: Number(plan.version) + 1, createdAt: Date.now() + 1,
    expert: { ...(plan.expert as object), quality: { version: 1, state: "provisional", reasons: ["An older review left a minor finding."], hard: [], agents: [{ agentId: "growth_strategy", shipped: false, gatesPassed: true, average: 4, rounds: 1, errors: { exploration_evidence: 1 }, researchSources: null }] } },
  }]);
  const authority = async () => Promise.all(["workflowRuns", "approvals", "actionReceipts", "artifacts"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await authority();
  await page.goto(`/app/${slug}/plan`);
  await page.getByRole("button", { name: "See the update", exact: true }).click();
  await expect(page.getByText("AI found issues to fix", { exact: true })).toBeVisible();
  await expect(page.getByText("A recorded check still blocks this draft. Refresh it to show the current findings.", { exact: true })).toBeVisible();
  await expect(page.getByText("This draft can be better", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Explain these checks", exact: true })).toBeEnabled();
  await expectAccessible(page, "Retained strategy citation findings");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("retained-source-check.png"), fullPage: false });
  expect(await authority()).toEqual(before);
});

test("plan checks explain the block and discussion stays an editable request @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the isolated local demo backend");
  test.setTimeout(120_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  expect(org.kind).toBe("demo");
  const plan = (await rows("strategies")).find(row => row.orgId === org._id)!;
  const { _id, _creationTime, ...copy } = plan;
  const reason = "The main recommendation buys traffic before the supplied demand concerns are resolved.";
  const additionalReason = "Delivery capacity has not been confirmed for the proposed test.";
  const fix = "Prepare an unpaid demand test first; keep any paid experiment secondary and capped.";
  await append("strategies", [{ ...copy, status: "needs_approval", approvalId: undefined, version: Number(plan.version) + 1, createdAt: Date.now() + 1,
    expert: { ...(plan.expert as object), quality: { version: 1, state: "failed", reasons: [reason, additionalReason], hard: ["demand_gate"], fixes: [{ rule: "demand_gate", path: "channels[0].suggestedMonthlyAdSpend", message: fix }], agents: [] } },
  }]);
  const authority = async () => Promise.all(["workflowRuns", "approvals", "actionReceipts", "artifacts", "climbMessages", "planTaskProgress"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await authority();
  await page.goto(`/app/${slug}/plan`);
  await page.getByRole("button", { name: "See the update", exact: true }).click();
  await expect(page.getByRole("tablist", { name: "Plan views", exact: true }).getByRole("tab", { name: "Next steps", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByText(additionalReason, { exact: true })).not.toBeVisible();
  await page.getByText("What needs fixing", { exact: true }).click();
  await expect(page.getByText(additionalReason, { exact: true })).toBeVisible();
  await expect(page.getByText(fix, { exact: false })).toBeVisible();
  await expectAccessible(page, "Plan check explanation");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("plan-check-explanation.png"), fullPage: false });
  await page.getByRole("button", { name: "Explain these checks", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Message Climb AI", exact: true });
  const request = "Explain the saved plan checks in simple words. What needs fixing, what remains unknown, and what can I safely review now? Do not start work, send, publish or spend.";
  await expect(composer).toHaveValue(request);
  await expect(composer).toBeEditable();
  await composer.fill("Keep my existing question about the offer.");
  await page.getByRole("button", { name: "Close Climb AI", exact: true }).click();
  await page.getByRole("button", { name: "Explain these checks", exact: true }).click();
  await expect(composer).toHaveValue(`Keep my existing question about the offer.\n${request}`);
  expect(await authority()).toEqual(before);
});
