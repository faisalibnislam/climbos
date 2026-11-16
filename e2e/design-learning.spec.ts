import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

async function seedLearning(slug: string) {
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Design fixtures require a newly opened demo workspace");
  const business = (await rows("businesses")).find(row => row.orgId === org._id);
  const strategy = (await rows("strategies")).find(row => row.orgId === org._id);
  const membership = (await rows("memberships")).find(row => row.orgId === org._id && row.role === "owner");
  if (!business || !strategy || !membership) throw new Error("Demo business, plan and owner required");
  const now = Date.now();
  const approvedAt = now - 30 * 86_400_000;
  const start = new Date(now - 28 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(now - 14 * 86_400_000).toISOString().slice(0, 10);
  // Synthetic imported records exercise the non-fixture learning path only in this
  // isolated demo database. No model, publication endpoint or provider is invoked.
  await append("workflowRuns", [{ orgId: org._id, kind: "conversion_audit", title: "Synthetic design learning check", status: "verified", input: "{}", output: JSON.stringify({ designCritic: { coverage: "text_only", summary: "Synthetic browser-test evidence, not a real website audit.", findings: [{ lens: "communication_hierarchy", region: "Inquiry hero", observation: "Synthetic observation: the offer needs clarification.", classification: "expert_judgment", severity: "medium", confidence: "low", directions: [{ id: "clear", name: "Make the offer explicit" }] }] } }), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: approvedAt, updatedAt: now }]);
  const run = (await rows("workflowRuns")).find(row => row.orgId === org._id && row.title === "Synthetic design learning check")!;
  const content = JSON.stringify({ headline: "Synthetic inquiry page", subhead: "Browser fixture only", benefits: [], steps: [], proof: "", faq: [], ctaLabel: "Ask", formIntro: "Fixture" });
  const plan = { metric: "Qualified inquiries", method: "Compare equal periods", baseline: { state: "recorded", value: "5 inquiries from 100 visits", source: "Synthetic owner log" }, audience: "Synthetic service audience", guardrail: "No additional support burden", observationDays: 14, decisionRule: "More qualified inquiries without extra support", appliesToVersion: 2, confirmedBy: membership.userId, confirmedAt: approvedAt };
  await append("landingPages", [{ orgId: org._id, slug: `learning-${slug}`, title: "Synthetic inquiry page", brief: "Browser fixture only", status: "draft", version: 4, content, color: "#225533", views: 0, leads: 0, createdAt: approvedAt, updatedAt: now, designCriticSource: { runId: run._id, findingIndex: 0, directionId: "clear", directionName: "Make the offer explicit", region: "Inquiry hero", selectedAt: approvedAt } }]);
  const page = (await rows("landingPages")).find(row => row.orgId === org._id && row.slug === `learning-${slug}`)!;
  await append("landingPageVersions", [{ orgId: org._id, pageId: page._id, version: 2, publicationApprovedAt: approvedAt, title: "Synthetic inquiry page", color: "#225533", content, kind: "measurement", designMeasurementPlan: plan, createdAt: approvedAt }]);
  await append("experiments", [{ orgId: org._id, strategyId: strategy._id, designSource: { runId: run._id, findingIndex: 0, pageId: page._id, pageVersion: 2 }, name: "Synthetic page result", hypothesis: "Offer clarity may help inquiries", population: plan.audience, method: "pre_post_observational", primaryMetric: plan.metric, guardrails: [plan.guardrail], durationDays: 14, stoppingRule: plan.decisionRule, status: "concluded", createdAt: approvedAt, analyses: [{ n: 1, executed: true, source: "integration", design: "before_after", exposed: 100, conversions: 8, windowStart: start, windowEnd: end, metric: plan.metric, successRule: plan.decisionRule, result: "met", stopRuleHit: false, inference: "observed", redefined: false, reviewedBy: membership.userId, reviewedAt: now }] }]);
  return { orgId: org._id, runId: run._id, pageId: page._id };
}

test("design outcomes retain their exact version and qualified learning through owner edits @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires an explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  const f = await seedLearning(slug);
  const actionSnapshot = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns", "landingPages", "landingPageVersions"].map(async table => (await rows(table)).filter(row => row.orgId === f.orgId).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const before = await actionSnapshot();
  await page.goto(`/app/${slug}/work/${f.runId}`);
  const section = page.locator("details").filter({ has: page.locator("summary", { hasText: "Did this page change help?" }) });
  await section.locator("summary").first().click();
  await expect(section.getByRole("link", { name: "Synthetic inquiry page · draft v4" })).toBeVisible();
  await expect(section.getByText("Synthetic page result · page v2 · concluded")).toBeVisible();
  await expect(section.getByText("Use this as an observed result to inform another test, not proof the design caused it.")).toBeVisible();
  await section.getByText("How later advice uses this result", { exact: true }).click();
  await expect(section.getByText(/Page v2 · Publication approval recorded/)).toBeVisible();
  await expect(section.getByText(/Connected tool, as reported by the person recording it/)).toBeVisible();
  await expect(section.getByText(/not been independently verified/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "design outcome learning");
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("design-learning.png"), fullPage: false });

  await section.getByRole("button", { name: "Update outcome", exact: true }).click();
  await section.getByRole("button", { name: "Unclear", exact: true }).click();
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(section.getByText("Inconclusive for choosing a future design; use it to improve the next test.")).toBeVisible();
  await section.getByRole("button", { name: "Update outcome", exact: true }).click();
  await section.getByRole("button", { name: "Didn't run", exact: true }).click();
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(section.getByText("Not run. This says nothing about whether the design works.")).toBeVisible();
  await page.reload();
  await section.locator("summary").first().click();
  await expect(section.getByText("Not run. This says nothing about whether the design works.")).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(await actionSnapshot()).toEqual(before);
  expect(errors).toEqual([]);
});

test("reported comparisons keep allocation unknown until the owner supplies it @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires an explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  const f = await seedLearning(slug);
  const actionSnapshot = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns", "landingPages", "landingPageVersions"].map(async table => (await rows(table)).filter(row => row.orgId === f.orgId).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const before = await actionSnapshot();
  await page.goto(`/app/${slug}/work/${f.runId}`);
  const section = page.locator("details").filter({ has: page.locator("summary", { hasText: "Did this page change help?" }) });
  await section.locator("summary").first().click();
  await section.getByRole("button", { name: "Update outcome", exact: true }).click();
  await section.getByRole("combobox", { name: "Reported design", exact: true }).click();
  await page.getByRole("option", { name: "Random split", exact: true }).click();
  await expect(section.getByRole("combobox", { name: "Comparison group chosen" })).toHaveText("Unknown / not recorded");
  await expect(section.getByRole("textbox", { name: "Planned % in new version", exact: true })).toHaveValue("");
  await section.getByRole("textbox", { name: "Assigned to the change", exact: true }).fill("300");
  await section.getByRole("textbox", { name: "Converted", exact: true }).fill("15");
  await section.getByRole("textbox", { name: "Comparison group", exact: true }).fill("300");
  await section.getByRole("textbox", { name: "Comparison converted", exact: true }).fill("60");
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(section.getByRole("button", { name: "Update outcome", exact: true })).toBeVisible();
  await expect(section.getByText("Observed only", { exact: true })).toBeVisible();
  const latest = async () => {
    const e = (await rows("experiments")).find(row => row.orgId === f.orgId && row.name === "Synthetic page result")!;
    return (e.analyses as Record<string, unknown>[]).at(-1)!;
  };
  expect(await latest()).toMatchObject({ design: "randomized", inference: "observed", source: "integration" });
  expect((await latest()).assignment).toBeUndefined();
  expect((await latest()).plannedSharePct).toBeUndefined();
  await section.getByRole("button", { name: "Update outcome", exact: true }).click();
  await section.getByRole("combobox", { name: "Comparison group chosen" }).click();
  await page.getByRole("option", { name: "At random", exact: true }).click();
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(section.getByRole("button", { name: "Update outcome", exact: true })).toBeVisible();
  await expect(section.getByText(/The planned split is unknown/)).toBeVisible();
  await section.getByRole("button", { name: "Update outcome", exact: true }).click();
  await section.getByRole("textbox", { name: "Planned % in new version", exact: true }).fill("50.5");
  await expect(section.getByRole("textbox", { name: "Planned % in new version", exact: true })).toHaveValue("50.5");
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "reported experiment form");
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(section.getByRole("button", { name: "Update outcome", exact: true })).toBeVisible();
  await expect(section.getByText("Reported random comparison", { exact: true })).toBeVisible();
  await expect(section.getByText(/A calculated rate difference/)).toHaveText(/likely -[\d.]+ to -[\d.]+ points/);
  await expect(section.getByText(/Member-entered; reported source: connected tool/)).toBeVisible();
  await expect(section.getByText("Incremental", { exact: true })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "reported experiment result");
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("reported-comparison.png"), fullPage: false });
  expect(await actionSnapshot()).toEqual(before);
  expect(errors).toEqual([]);
});
