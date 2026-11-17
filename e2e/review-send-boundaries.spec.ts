import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
test("Review receipt checks and owner observations never resend @mobile", async ({ page, baseURL }, testInfo) => {
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
  const noSendEffects = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns", "emailLog", "outboundSends"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const beforeWriting = await noSendEffects();
  await expect(page.getByRole("button", { name: "Check original mailbox" })).toHaveCount(0); // Legacy fixture has no saved mailbox identity.
  await page.getByRole("button", { name: "Record what I found", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Invitation to Unconfirmed customer" });
  await dialog.getByRole("textbox", { name: "What you checked" }).fill("Inspected the original mailbox; delivery is still unknown.");
  await dialog.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(a => a.finished.catch(() => undefined))); });
  await expectAccessible(page, "Record invitation observation");
  await dialog.getByRole("button", { name: "Save observation", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Inspected the original mailbox; delivery is still unknown.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record what I found", exact: true }).click();
  await dialog.getByRole("combobox", { name: "What did you find?" }).click();
  await page.getByRole("option", { name: "I confirmed it was not sent", exact: true }).click();
  await dialog.getByRole("textbox", { name: "What you checked" }).fill("Synthetic fixture: the mailbox rejected this invitation before acceptance.");
  await dialog.getByRole("button", { name: "Save observation", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Owner: not sent", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Owner: not sent", { exact: true })).toBeVisible();
  const saved = (await rows("reviewRequests")).find(row => row.orgId === org._id && row.name === "Unconfirmed customer")!;
  expect(saved).toMatchObject({ status: "failed", recoveryRevision: 2, recovery: { source: "owner_reported", outcome: "not_sent", originalStatus: "uncertain" } });
  expect((await rows("auditEvents")).filter(row => row.orgId === org._id && row.action === "reviews.receipt_observed")).toHaveLength(2);
  expect(await noSendEffects()).toEqual(beforeWriting); expect(errors).toEqual([]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("review-receipt-observed.png"), fullPage: true });
});
