import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo, pickCalendarDate } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { cli, rows, append } = localDemoFixtures(envFile);

test("owner approves an exact future delivery, reloads and cancels before any send @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(150000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  // Only list discovery is simulated. Approval, persistence, reservation and cancellation use the local backend.
  await page.routeWebSocket(/127\.0\.0\.1:3320\/.*sync/, ws => {
    const server = ws.connectToServer();
    ws.onMessage(message => {
      const request = JSON.parse(String(message));
      if (request.type === "Action" && request.udfPath === "marketing:providerSegments") ws.send(JSON.stringify({ type: "ActionResponse", requestId: request.requestId, success: true, result: [{ id: "offline-list", name: "Offline fixture list" }], logLines: [] }));
      else server.send(message);
    });
  });
  const slug = await openDemo(page), org = (await rows("organizations")).find(row => row.slug === slug)!;
  expect(org.kind).toBe("demo");
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|schedule-fixture`, tokenIdentifier: "test|schedule-fixture" });
  await cli(["run", "marketing:importContacts", JSON.stringify({ slug, csv: "email,consent,consent_source,consent_date,segment\nschedule@example.com,yes,signup,2026-10-01,scheduled-test" }), "--identity", identity]);
  const artifact = (await rows("artifacts")).find(row => row.orgId === org._id && row.kind === "email_sequence")!;
  await cli(["run", "content:decide", JSON.stringify({ slug, artifactId: artifact._id, decision: "approve" }), "--identity", identity]);
  if (!(await rows("connections")).some(row => row.orgId === org._id && row.provider === "email_resend")) await append("connections", [{ orgId: org._id, provider: "email_resend", status: "connected", isFixture: true, scopes: [], accountLabel: "Offline fixture without credentials", createdBy: member.userId, createdAt: Date.now(), updatedAt: Date.now() }]);
  const noEffects = async () => Promise.all(["actionReceipts", "emailLog", "consentRecords"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await noEffects(), errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/content/${artifact._id}`);
  await page.getByRole("combobox", { name: "Who gets it" }).click(); await page.getByRole("option", { name: /scheduled-test/ }).click();
  await page.getByRole("combobox", { name: "Resend list", exact: true }).click(); await page.getByRole("option", { name: "Offline fixture list", exact: true }).click();
  await page.getByLabel("Sender", { exact: true }).fill("Owner <hello@example.com>");
  await page.getByRole("combobox", { name: "Delivery", exact: true }).click(); await page.getByRole("option", { name: "Choose a delivery time", exact: true }).click();
  const target = await page.evaluate(() => {
    const d = new Date(Math.ceil((Date.now() + 2 * 3_600_000) / 900_000) * 900_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { timestamp: d.getTime(), date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
  });
  await pickCalendarDate(page, page.getByLabel("Delivery time", { exact: true }), target.date);
  await page.getByRole("combobox", { name: "Time", exact: true }).click(); await page.getByRole("option", { name: target.time, exact: true }).click();
  await page.getByRole("button", { name: "Review scheduled delivery", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Schedule delivery to 1 person?", exact: true });
  await expect(confirm.getByText(/No later email or new recipient is approved/)).toBeVisible();
  await expect(confirm.getByText(/Window ends one hour later/)).toBeVisible();
  await expectAccessible(page, "Scheduled delivery confirmation"); await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("scheduled-delivery-confirmation.png"), fullPage: false });
  await confirm.getByRole("button", { name: "Approve scheduled delivery", exact: true }).click();
  await expect(page.getByText("Email scheduled", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("button", { name: "Cancel scheduled email", exact: true })).toBeVisible();
  const approval = (await rows("approvals")).find(row => row.orgId === org._id && row.subjectType === "email_send")!;
  expect(approval.scope).toMatchObject({ scheduledFor: target.timestamp, destination: "offline-list", audience: "scheduled-test", spendLimitMinor: 1 });
  expect(approval.executionStartedAt).toBeUndefined();
  await expectAccessible(page, "Pending email delivery"); await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Cancel scheduled email", exact: true }).click();
  await expect(page.getByText("Email scheduled", { exact: true })).toHaveCount(0);
  const cancelled = (await rows("approvals")).find(row => row._id === approval._id)!;
  expect(cancelled.status).toBe("invalidated"); expect(cancelled.executionStartedAt).toBeUndefined();
  const reservationId = (approval.scope as Record<string, unknown>).reservationId;
  expect((await rows("usageReservations")).find(row => row._id === reservationId)?.status).toBe("reconciled");
  expect(await noEffects()).toEqual(before); expect(errors).toEqual([]);
});
