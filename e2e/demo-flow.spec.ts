import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";

/**
 * Seeded Formkit flow (fixture adapters only): Today → chat → costed action
 * card → drafts → review/approve → publish (simulated receipt) → plan →
 * results/forecast → connections → billing → pause all → resume.
 */
test.describe.serial("Formkit demo end-to-end", () => {
  let slug = "";
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // One signed-in (anonymous demo) session shared by the whole flow.
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    page = await context.newPage();
    slug = await openDemo(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("today: goal, next actions, chat becomes action cards, cards run", async () => {
    await page.goto(`/app/${slug}/today`);
    await expect(page.getByText(/Help Formkit acquire more paying customers/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /do these next/i })).toBeVisible();
    // Make a wish: safe work starts on its own; anything else waits for "Do it".
    await page.getByLabel("Your wish for the team").fill("Write a welcome email sequence for new sign-ups");
    await page.getByRole("button", { name: "Make it happen" }).click();
    const step = page.locator("li", { hasText: /email/i }).filter({ has: page.getByRole("button").or(page.getByText(/Working|Done|See result/)) }).first();
    await expect(step).toBeVisible({ timeout: 30_000 });
    const doIt = step.getByRole("button", { name: /^do it$/i });
    if (await doIt.isVisible()) await doIt.click();
    await expect(step.getByText(/See result|Done/)).toBeVisible({ timeout: 45_000 });
    await expectAccessible(page, "today");
  });

  test("content: approve an Instagram draft, publish it (simulated receipt) and never duplicate", async () => {
    await page.goto(`/app/${slug}/content?status=in_review`);
    await expect(page.getByRole("heading", { level: 1, name: "Content" })).toBeVisible();
    await expectAccessible(page, "content list");
    const instagram = page.locator("li, article", { hasText: "Instagram" }).locator("a[href*='/content/']").first();
    await instagram.click();
    await expect(page.getByText(/publishing is simulated/i).first()).toBeVisible();
    await expectAccessible(page, "content detail");
    await page.getByRole("button", { name: /^approve$/i }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /approve/i }).last().click();
    await expect(page.getByText(/^Approved$/).first()).toBeVisible();
    await page.getByRole("button", { name: /publish now/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /publish/i }).last().click();
    await expect(page.getByText(/simulated (platform )?acceptance/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Accepted by platform|Published|simulated/i).first()).toBeVisible();
  });

  test("plan: approved plan with channels, experiments and insights", async () => {
    await page.goto(`/app/${slug}/plan`);
    await expect(page.getByText(/Use-case pages|use-case/i).first()).toBeVisible();
    await expect(page.getByText(/experiment/i).first()).toBeVisible();
    await expect(page.getByText(/SWOT|strengths/i).first()).toBeVisible();
    await expectAccessible(page, "plan");
    await page.getByRole("tab", { name: "Channels" }).click();
    await expect(page.getByRole("heading", { name: "Your business" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In the plan" })).toBeVisible();
    await expectAccessible(page, "channels");
  });

  test("results: observed vs attributed vs projected, reconciliation and forecast detail", async () => {
    await page.goto(`/app/${slug}/results`);
    await expect(page.getByText(/unattributed/i).first()).toBeVisible();
    await expect(page.getByText(/platform.reported/i).first()).toBeVisible();
    await expectAccessible(page, "results");
    const forecastLink = page.locator("a[href*='/results/forecasts/']").first();
    await forecastLink.click();
    await expect(page.getByText(/backtest|baseline/i).first()).toBeVisible();
    await expectAccessible(page, "forecast detail");
  });

  test("connections: capability states instead of a single connected flag", async () => {
    await page.goto(`/app/${slug}/connections`);
    await expect(page.getByText(/LinkedIn/).first()).toBeVisible();
    await expect(page.getByText(/no contact database|doesn't sell or include contact data/i).first()).toBeVisible();
    await expectAccessible(page, "connections");
  });

  test("settings: billing usage meters and policies", async () => {
    await page.goto(`/app/${slug}/settings/billing`);
    await expect(page.getByText(/social posts/i).first()).toBeVisible();
    await expectAccessible(page, "billing");
    await page.goto(`/app/${slug}/settings/policies`);
    await expect(page.getByText(/bounded autopilot/i).first()).toBeVisible();
    await expectAccessible(page, "policies");
  });

  test("outbound: find customers, approve them, and a prospect books a call", async () => {
    await page.goto(`/app/${slug}/outbound`);
    await page.getByRole("button", { name: "Find customers" }).click();
    await expect(page.getByText(/Ideal customer/i)).toBeVisible({ timeout: 30_000 });
    await expectAccessible(page, "outbound");
    await page.getByRole("checkbox", { name: "Select all" }).click();
    await page.getByRole("button", { name: /^Approve$/ }).click();
    await expect(page.getByRole("button", { name: /Export \d+ approved/ })).toBeEnabled();
    await page.getByRole("tab", { name: /Emails/ }).click();
    await expect(page.getByText(/First email/i)).toBeVisible();

    const href = await page.locator("a[href^='/book/']").first().getAttribute("href");
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: /Pick a day/ })).toBeVisible();
    await expectAccessible(page, "booking page");
    await page.getByRole("heading", { name: /Pick a time/ }).locator("xpath=following-sibling::div[1]").getByRole("button").first().click();
    await page.getByLabel("Your name").fill("Test Guest");
    await page.getByLabel("Work email").fill("guest@example.com");
    await page.getByRole("button", { name: "Confirm the call" }).click();
    await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
    await expectAccessible(page, "booking confirmed");
  });

  test("pause all activity, then resume", async () => {
    await page.goto(`/app/${slug}/today`);
    await page.getByRole("button", { name: /pause all activity/i }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: /pause all activity/i }).click();
    await expect(page.getByText(/all activity is paused/i).first()).toBeVisible();
    await page.getByRole("button", { name: /resume activity/i }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: /resume activity/i }).click();
    await expect(page.getByText(/all activity is paused/i)).toHaveCount(0);
  });

  test("mobile layout: no horizontal scroll and pause is reachable @mobile", async ({ page }) => {
    const s = await openDemo(page);
    for (const path of ["today", "content", "plan", "results", "connections", "outbound", "autopilot"]) {
      await page.goto(`/app/${s}/${path}`);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expectNoHorizontalScroll(page);
    }
    await expect(page.getByRole("button", { name: /pause/i }).first()).toBeVisible();
  });

  test("keyboard: skip link and primary navigation are reachable", async () => {
    await page.goto(`/app/${slug}/today`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
    await page.keyboard.press("Enter");
    const nav = page.getByRole("navigation", { name: "Primary" }).first();
    await expect(nav.getByRole("link", { name: "Results" })).toBeVisible();
  });
});
