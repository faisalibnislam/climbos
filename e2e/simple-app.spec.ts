import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";

test("plain-language Home, suggestions, tools, and review links @mobile", async ({ page }) => {
  const slug = await openDemo(page);
  const request = page.getByLabel("Your request", { exact: true });
  await expect(request).toBeVisible();
  const history = page.getByRole("region", { name: "Your requests", exact: true });
  const before = await history.innerText();
  await page.screenshot({ path: test.info().outputPath("home.png"), fullPage: false });
  await request.fill("Keep this draft.");
  await page.getByRole("button", { name: "Prepare posts for next week", exact: true }).click();
  await expect(request).toHaveValue("Keep this draft.\nPrepare posts for next week");
  await expect(history).toHaveText(before, { useInnerText: true });

  await page.getByRole("button", { name: /Ask for help or find a tool/ }).click();
  await page.getByRole("combobox", { name: "Find a tool or prepare a request" }).fill("Help me understand my sales");
  await page.getByRole("button", { name: /Ask for help with this/ }).click();
  await expect(request).toHaveValue("Keep this draft.\nPrepare posts for next week\nHelp me understand my sales");
  await expect(history).toHaveText(before, { useInnerText: true });
  await page.getByRole("button", { name: "Ask Climb about this page", exact: true }).click();
  await page.getByLabel("Message Climb AI", { exact: true }).fill("Keep this question.");
  await page.getByRole("button", { name: "What needs my attention today?", exact: true }).click();
  await expect(page.getByLabel("Message Climb AI", { exact: true })).toHaveValue("Keep this question.\nWhat needs my attention today?");
  await page.getByRole("button", { name: "Close Climb AI", exact: true }).click();
  await expect(history).toHaveText(before, { useInnerText: true });

  await page.goto(`/app/${slug}/content`);
  await page.goto(`/app/${slug}/today`);
  await expect(request).toHaveValue("Keep this draft.\nPrepare posts for next week\nHelp me understand my sales");

  await expectAccessible(page, "simple Home");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("home-request.png"), fullPage: false });

  await page.getByRole("link", { name: "Your work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your work", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Posts, emails & ads/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/content`));
  await expect(page.getByRole("heading", { name: "Posts, emails & ads", exact: true })).toBeVisible();

  await page.goto(`/app/${slug}/customers`);
  await page.getByRole("link", { name: /Customer progress/ }).click();
  await expect(page.getByRole("heading", { name: "Customer progress", exact: true })).toBeVisible();
  await page.goto(`/app/${slug}/tools`);
  await page.getByLabel("Find a tool", { exact: true }).fill("SEO");
  await expect(page.getByRole("link", { name: /Help people find you/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Design editor/ })).toHaveCount(0);
  await page.getByLabel("Find a tool", { exact: true }).fill("xyz-not-a-tool");
  await expect(page.getByRole("heading", { name: "No matching tools" })).toBeVisible();
  await page.getByLabel("Find a tool", { exact: true }).fill("");
  await page.getByText("What do these words mean?", { exact: true }).click();
  await expect(page.getByText("Money from sales, before subtracting costs.", { exact: true })).toBeVisible();
  await expectAccessible(page, "plain-language tool directory");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("tools.png"), fullPage: false });
  if ((page.viewportSize()?.width ?? 1366) < 1024) await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("link", { name: "Review work", exact: true }).click();
  await expect(page.locator("#review")).toBeInViewport();
});

test("shared composer protects drafts and treats IME input as composition @mobile", async ({ page }) => {
  await page.goto("/design-system/v2/components/forms");
  const input = page.getByLabel("Example request", { exact: true });
  await input.fill("My first line");
  await page.getByRole("button", { name: "Help me choose what to do next", exact: true }).click();
  await expect(input).toHaveValue("My first line\nHelp me choose what to do next");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await expect(page.getByText(/^Example received:/)).toHaveCount(0);
  await input.press("Shift+Enter");
  await input.press("End");
  const section = page.getByRole("region", { name: "Guided request", exact: true });
  await section.getByRole("button", { name: "Send request" }).click();
  await expect(section.getByRole("status")).toContainText("My first line");
  await expect(input).toHaveValue("");
  const results = await new AxeBuilder({ page }).include("#request-composer-example").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
  await expectNoHorizontalScroll(page);
});
