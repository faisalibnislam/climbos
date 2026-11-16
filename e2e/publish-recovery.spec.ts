import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

for (const outcome of ["posted", "not_posted"] as const) {
test(`owner recovery records one attempt as ${outcome} and distinguishes the report from platform acceptance @mobile`, async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures");
  test.setTimeout(150_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Isolated demo required");
  const artifact = (await rows("artifacts")).find(row => row.orgId === org._id && row.status === "uncertain");
  if (!artifact) throw new Error("Expected the synthetic uncertain post");
  const receipt = (await rows("actionReceipts")).find(row => row.orgId === org._id && row.artifactId === artifact._id && row.status === "uncertain");
  if (!receipt) throw new Error("Expected its original receipt");
  await append("actionReceipts", [{ orgId: org._id, artifactId: artifact._id, provider: "instagram", action: "instagram.publish_media", idempotencyKey: `${org._id}:older-unrelated-attempt`, status: "uncertain", summary: "Another synthetic attempt: leave unchanged", createdAt: Date.now() - 20 * 86_400_000 }]);
  const historyBefore = (await rows("actionReceipts")).filter(row => row.orgId === org._id);
  const effects = async () => Promise.all(["approvals", "workflowRuns", "connections"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects();
  await page.goto(`/app/${slug}/content/${artifact._id}`);
  await expect(page.getByText("The original account identity was not saved. Verify the account used for this attempt before answering.", { exact: true })).toBeVisible();
  const posted = outcome === "posted";
  await page.getByRole("button", { name: posted ? "It was posted" : "It wasn't posted", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: posted ? "Yes, it was posted" : "It wasn't posted", exact: true }).click();
  await expect(page.getByText(posted ? "Marked as posted after owner review." : "Marked as not posted after owner review. Nothing was re-sent.", { exact: true })).toBeVisible();
  await expect(page.getByText(posted ? "Owner reported: posted" : "Owner reported: not posted", { exact: true })).toBeVisible();
  await expect(page.getByText(posted ? "Recorded as posted" : "Recorded as not posted", { exact: true })).toBeVisible();
  await expect(page.getByText(/rejected it/)).toHaveCount(0);
  await expect(page.getByText(`Earlier result: ${receipt.summary}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Accepted by platform", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "It was posted", exact: true })).toHaveCount(0);
  const after = (await rows("actionReceipts")).filter(row => row.orgId === org._id);
  expect(after).toHaveLength(historyBefore.length);
  expect(after.find(row => row._id === receipt._id)).toMatchObject({ status: posted ? "verified" : "failed", externalId: receipt.externalId, resolution: { source: "owner", outcome } });
  expect(after.filter(row => row._id !== receipt._id)).toEqual(historyBefore.filter(row => row._id !== receipt._id));
  const effectsAfter = await effects();
  expect(effectsAfter[0]).toEqual(before[0].map(row => posted && row._id === artifact.approvalId ? { ...row, status: "consumed" } : row));
  expect(effectsAfter.slice(1)).toEqual(before.slice(1));
  await expectAccessible(page, "Exact publishing outcome review");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("publishing-owner-outcome.png"), fullPage: true });
});
}
