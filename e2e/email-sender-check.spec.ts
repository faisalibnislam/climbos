import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);

test("sender setup check is explicit, read-only and available on mobile @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(120000); page.setDefaultTimeout(15000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  expect(org.kind).toBe("demo");
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const artifact = (await rows("artifacts")).find(row => row.orgId === org._id && row.kind === "email_sequence")!;
  const now = Date.now();
  // No key is stored. The fixture connection must be rejected before any provider read.
  await append("connections", [{ orgId: org._id, provider: "email_resend", status: "connected", scopes: [], isFixture: true, createdBy: member.userId, createdAt: now, updatedAt: now }]);
  await append("contacts", [{ orgId: org._id, emailHash: "sender-ui-fixture", emailCiphertext: "unusable-fixture", emailIv: "fixture:unusable", emailDomain: "example.com", source: "csv_import", segments: ["newsletter"], createdAt: now }]);
  const contact = (await rows("contacts")).find(row => row.orgId === org._id)!;
  await append("consentRecords", [{ orgId: org._id, contactId: contact._id, purpose: "marketing_email", basis: "opt_in", source: "Synthetic fixture", evidence: "Synthetic UI test only", capturedAt: now }]);
  await page.goto(`/app/${slug}/content/${artifact._id}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^Approve/ }).click();
  const button = page.getByRole("button", { name: "Check sender setup", exact: true });
  await expect(button).toBeDisabled();
  const before = await Promise.all(["approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  await page.getByLabel("Sender", { exact: true }).fill("Owner <hello@example.com>");
  await expect(button).toBeEnabled();
  await expect(page.getByText("Reads your domain status. No email is sent and no DNS settings are changed.", { exact: true })).toBeVisible();
  await button.click();
  await expect(page.getByText("Connect your own Resend account to check the sender.", { exact: true })).toBeVisible();
  await expect(page.getByText("Domain setup reported verified", { exact: true })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "Email sender setup");
  await page.screenshot({ path: testInfo.outputPath("email-sender-setup.png"), fullPage: false });
  const after = await Promise.all(["approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  expect(after).toEqual(before);
});
