import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { cli, rows, append } = localDemoFixtures(envFile);

test("owner policy and broadcast preview explain review contact pressure without sending @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures");
  test.setTimeout(120000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(r => r.slug === slug)!;
  expect(org.kind).toBe("demo");
  const member = (await rows("memberships")).find(r => r.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|frequency-fixture`, tokenIdentifier: "test|frequency-fixture" });
  await cli(["run", "marketing:importContacts", JSON.stringify({ slug, csv: "email,consent,consent_source,consent_date,segment\nana@example.com,yes,signup form,2026-10-01,frequency-test" }), "--identity", identity]);
  await append("reviewRequests", [{ orgId: org._id, name: "Ana", email: "ana@example.com", token: `frequency-${org._id}`, status: "uncertain", createdAt: Date.now() - 100 * 86400000 }]);
  const artifact = (await rows("artifacts")).find(r => r.orgId === org._id && r.kind === "email_sequence")!;
  await cli(["run", "content:decide", JSON.stringify({ slug, artifactId: artifact._id, decision: "approve" }), "--identity", identity]);
  if (!(await rows("connections")).some(r => r.orgId === org._id && r.provider === "email_resend")) {
    // No secret: the existing provider-list action returns without contacting Resend.
    await append("connections", [{ orgId: org._id, provider: "email_resend", status: "connected", isFixture: true, scopes: [], accountLabel: "Local fixture", createdBy: member.userId, createdAt: Date.now(), updatedAt: Date.now() }]);
  }
  const effects = async () => Promise.all(["approvals", "actionReceipts", "reviewRequests", "outboundSends", "emailLog"].map(async table => (await rows(table)).filter(r => r.orgId === org._id)));
  const before = await effects(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/settings/policies`);
  const policy = page.getByRole("region", { name: "Email limit per person" });
  await policy.getByLabel("Days between emails").fill("7");
  await policy.getByRole("button", { name: "Save limit", exact: true }).click();
  await expect(policy).toContainText("At most one email every 7 days per person.");
  await expect(policy).toContainText("Broadcasts, outreach (including follow-ups), and review invitations");
  await expect(policy).toContainText("observation date conservatively");
  await expectAccessible(page, "Shared contact frequency policy");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("shared-contact-policy.png"), fullPage: true });
  await page.goto(`/app/${slug}/content/${artifact._id}`);
  await page.getByRole("combobox", { name: "Who gets it" }).click();
  await page.getByRole("option", { name: /frequency-test/ }).click();
  await expect(page.getByText("Your contact limit will hold this send", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 person has a queued or unresolved review invitation/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expectAccessible(page, "Review pressure in broadcast preview");
  await expectNoHorizontalScroll(page);
  expect(await effects()).toEqual(before);
  expect((await rows("organizations")).find(r => r._id === org._id)?.contactFrequencyDays).toBe(7);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("review-pressure-preview.png"), fullPage: true });
});
