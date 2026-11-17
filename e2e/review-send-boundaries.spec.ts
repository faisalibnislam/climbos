import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
test("Review invitations distinguish accepted and unknown receipt without sending @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(120000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page), org = (await rows("organizations")).find(row => row.slug === slug)!;
  expect(org.kind).toBe("demo");
  await append("reviewRequests", [
    { orgId: org._id, name: "Unconfirmed customer", email: "unknown@example.com", token: `uncertain-${org._id}`, status: "uncertain", error: "The mailbox result is unclear. Check the Sent folder before sending another invitation. ClimbOS will not retry automatically.", createdAt: Date.now() },
    { orgId: org._id, name: "Accepted customer", email: "accepted@example.com", token: `accepted-${org._id}`, status: "sent", sentAt: Date.now(), createdAt: Date.now() },
  ]);
  const effects = async () => Promise.all(["reviewRequests", "auditEvents", "approvals", "actionReceipts", "workflowRuns", "emailLog"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects(); const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/reviews`);
  await expect(page.getByText("Delivery unclear", { exact: true })).toBeVisible();
  await expect(page.getByText("Mailbox accepted", { exact: true })).toBeVisible();
  await expect(page.getByText("The mailbox result is unclear.", { exact: false })).toBeVisible();
  await expectAccessible(page, "Review invitation receipts"); await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("review-send-boundaries.png"), fullPage: true });
  expect(errors).toEqual([]); expect(await effects()).toEqual(before);
});
