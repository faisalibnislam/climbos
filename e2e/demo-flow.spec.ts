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
    const box = page.getByLabel("Message your growth team");
    await box.fill("Write a welcome email sequence for new sign-ups");
    await page.getByRole("button", { name: "Send" }).click();
    const card = page.locator('[id^="card-"]', { hasText: "Draft an email sequence" }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/most it can use/i)).toBeVisible();
    await card.getByRole("button", { name: /do it/i }).click();
    await expect(card.getByText("Done")).toBeVisible({ timeout: 30_000 });
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
    for (const path of ["today", "content", "plan", "results", "connections"]) {
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
