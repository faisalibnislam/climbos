import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** Exercise the actual shared calendar, including navigation, rather than filling a native date input. */
export async function pickCalendarDate(page: Page, control: Locator, date: string) {
  await control.click();
  const grid = page.getByRole("grid", { name: "Choose a date", exact: true });
  await expect(grid).toBeVisible();
  const target = grid.locator(`[data-iso="${date}"]`);
  for (let month = 0; month < 24 && await target.count() === 0; month++) {
    const first = await grid.getByRole("gridcell").first().getAttribute("data-iso");
    await page.getByRole("button", { name: date < first! ? "Previous month" : "Next month", exact: true }).click();
  }
  await expect(target).toBeEnabled();
  await target.click();
  await expect(grid).toHaveCount(0);
}

/** WCAG 2.2 AA scan; fails on serious or critical violations. */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} ${n.html.slice(0, 500)}`).join(" | ")}`);
  expect(summary, `${label} accessibility`).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

export async function openDemo(page: Page): Promise<string> {
  await page.goto("/demo");
  await page.waitForURL(/\/app\/[^/]+\/today/, { timeout: 45_000 });
  const slug = page.url().split("/app/")[1].split("/")[0];
  await expect(page.getByText("Demo data").first()).toBeVisible();
  return slug;
}
