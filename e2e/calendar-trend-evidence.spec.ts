import { expect, test } from "@playwright/test";
import { thisWeekOf } from "../shared/autopilot";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

test("calendar ideas show dated source evidence without starting work @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(90_000); page.setDefaultTimeout(15_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo" || typeof org.timezone !== "string") throw new Error("An isolated demo is required");
  const now = Date.now(), observed = new Date(now).toISOString().slice(0, 10);
  const sourceUrl = "https://research.example/synthetic-format";
  await append("calendarSlots", [{ orgId: org._id, weekOf: thisWeekOf(now, org.timezone), channel: "linkedin", day: 1, slotAt: now, pillar: "Explain", purpose: "teach", format: "text", idea: "Synthetic dated inspiration", angle: "Show the steps before the result", hookDraft: "Before the result", callToAction: "Compare your process", needsOwner: true, status: "planned", ownerNote: "Audience fit remains a hypothesis.", trendEvidence: { sourceUrl, observationDate: observed, observation: "Synthetic observation: a creator shows each process step.", retrievedAt: now - 1000 }, createdAt: now, updatedAt: now }]);
  const effects = async () => Promise.all(["artifacts", "approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects();
  await page.goto(`/app/${slug}/autopilot`);
  const card = page.locator("article").filter({ hasText: "Synthetic dated inspiration" });
  await card.locator("summary").filter({ hasText: "Notes and sources" }).click();
  const evidence = card.getByRole("region", { name: "Trend evidence" });
  await expect(evidence).toContainText(`Source observation dated ${observed}`);
  await expect(evidence).toContainText("Research retrieved");
  await expect(evidence).toContainText("does not prove the trend will fit your audience or improve results");
  await expect(evidence.getByRole("link", { name: "Read source" })).toHaveAttribute("href", sourceUrl);
  await expect(card).toContainText("Audience fit remains a hypothesis");
  await expectNoHorizontalScroll(page); await expectAccessible(page, "Calendar trend evidence");
  await card.screenshot({ path: testInfo.outputPath("calendar-trend-evidence.png") });
  expect(await effects()).toEqual(before);
});
