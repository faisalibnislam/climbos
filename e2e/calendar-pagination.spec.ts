import { localDemoFixtures } from "./local-demo-fixtures";
import { expect, test, type Locator } from "@playwright/test";
import { localDate, zonedTime } from "../shared/autopilot";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";

const envFile = process.env.CLIMBOS_CALENDAR_E2E_ENV_FILE;

const { rows, append } = localDemoFixtures(envFile);

async function seedCalendar(slug: string) {
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo" || typeof org.timezone !== "string") throw new Error("Only a newly opened demo workspace may receive calendar fixtures");
  const business = (await rows("businesses")).find(row => row.orgId === org._id);
  if (!business) throw new Error("Demo business missing");
  const now = Date.now();
  const local = localDate(now, org.timezone);
  const scheduledFor = zonedTime(local.year, local.month0, local.day, 12, 0, org.timezone);
  const artifacts = Array.from({ length: 351 }, (_, i) => ({
    orgId: org._id, businessId: business._id, kind: "social_post", channel: "facebook",
    title: `Calendar regression post ${String(i).padStart(3, "0")}`, status: "in_review",
    currentVersion: 1, scheduledFor, createdAt: now, updatedAt: now,
  }));
  await append("artifacts", artifacts);
  const saved = (await rows("artifacts")).filter(row => row.orgId === org._id && String(row.title).startsWith("Calendar regression post "));
  if (saved.length !== 351) throw new Error("Expected exactly 351 isolated calendar fixtures");
  await append("calendarSlots", saved.map(row => ({
    orgId: org._id, weekOf: `${local.year}-${String(local.month0 + 1).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
    channel: "facebook", day: local.weekday, slotAt: scheduledFor,
    pillar: "Fixture", purpose: "education", format: "text", idea: row.title,
    angle: "Browser regression", hookDraft: "Fixture only", callToAction: "Review",
    needsOwner: true, status: "needs_approval", artifactId: row._id,
    createdAt: now, updatedAt: now,
  })));
  return { orgId: org._id, timeZone: org.timezone };
}

async function finishLoading(calendar: Locator) {
  const more = calendar.getByRole("button", { name: "Load more calendar items", exact: true });
  for (let i = 0; i < 10; i++) {
    await expect(calendar.locator('[aria-busy="true"]')).toHaveCount(0);
    if (!(await more.count())) return;
    await more.click();
  }
  throw new Error("Calendar did not exhaust its pages");
}

test("calendar loads every item and resets daily, weekly and monthly ranges @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires an explicitly configured isolated local demo backend");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  const { orgId, timeZone } = await seedCalendar(slug);
  const actionSnapshot = async () => Promise.all(["approvals", "actionReceipts", "workflowRuns"].map(async table => (await rows(table)).filter(row => row.orgId === orgId).map(row => row._id).sort()));
  const before = await actionSnapshot();
  await page.goto(`/app/${slug}/content?tab=calendar`);
  const calendar = page.locator('section[aria-labelledby="calendar-heading"]');
  const posts = calendar.getByRole("link", { name: /Calendar regression post / });
  await expect(calendar.getByText(`Times shown in ${timeZone}`)).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Load more calendar items" })).toBeVisible();
  await finishLoading(calendar);
  await expect(posts).toHaveCount(351);
  await expect(posts.first()).toHaveAccessibleName(/Autopilot/);
  await expectNoHorizontalScroll(page);

  await calendar.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(posts).toHaveCount(0);
  await expect(calendar.locator('[aria-busy="true"]')).toHaveCount(0);
  await calendar.getByRole("button", { name: "Previous week", exact: true }).click();
  await expect(calendar.getByRole("button", { name: "Load more calendar items" })).toBeVisible();
  await finishLoading(calendar);
  await expect(posts).toHaveCount(351);

  await calendar.getByRole("button", { name: "Month", exact: true }).click();
  await finishLoading(calendar);
  await expect(posts).toHaveCount(351);
  await expectNoHorizontalScroll(page);
  await calendar.locator('li[aria-current="date"]').getByRole("button", { name: /^View / }).click();
  await expect(calendar.getByRole("button", { name: "Day", exact: true })).toHaveAttribute("aria-pressed", "true");
  await finishLoading(calendar);
  await expect(posts).toHaveCount(351);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page, "paginated content calendar");
  await page.screenshot({ path: testInfo.outputPath("calendar.png"), fullPage: false });

  await posts.first().click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/content/[^/?]+$`));
  await expect(page.getByRole("heading", { name: /^Calendar regression post / })).toBeVisible();
  expect(await actionSnapshot()).toEqual(before);
  expect(errors).toEqual([]);
});
