import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, cli } = localDemoFixtures(envFile);

test("owner can schedule manual search checks and inspect recurring transcript topics @mobile", async ({ page, baseURL }) => {
  test.skip(!envFile, "Requires isolated local fixtures");
  test.setTimeout(180000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|monitoring-fixture`, tokenIdentifier: "test|monitoring-fixture" });
  const run = (name: string, args: Record<string, unknown>) => cli(["run", name, JSON.stringify({ slug, ...args }), "--identity", identity]);
  await run("aiSearchVisibility:createPanel", { name: "Repeat questions", queries: [{ provider: "gemini", query: "Who serves our area?" }] });
  await page.goto(`/app/${slug}/visibility`);
  await page.getByRole("combobox", { name: "Saved question panel" }).click();
  await page.getByRole("option", { name: /Repeat questions/ }).click();
  await page.getByRole("combobox", { name: "Repeat manual checks" }).click();
  await page.getByRole("option", { name: "Every 7 days" }).click();
  await page.getByText(/1 checks? due by/).click();
  await expect(page.getByText("Awaiting check", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);

  const deal = JSON.parse(await run("crm:create", { name: "Call topic fixture" }));
  for (const [index, text] of ["Buyer: What does this service cost?", "Seller: Can we discuss the price and service scope?"].entries()) {
    await run("crm:addTranscript", { id: deal, expectedRevision: index, title: `Conversation ${index + 1}`, sourceLabel: "Local fixture", text, permissionConfirmed: true, permissionBasis: "Synthetic local test record" });
  }
  await page.goto(`/app/${slug}/pipeline`);
  await page.getByText("Recurring conversation topics", { exact: true }).click();
  await page.getByText("Price and value · 2 transcripts across 1 deal", { exact: true }).click();
  await page.getByRole("button", { name: "Call topic fixture · Conversation 1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Call topic fixture" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
