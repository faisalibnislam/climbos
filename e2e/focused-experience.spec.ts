import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";

test("Focused tabs keep cycles small and preserve reviews @mobile", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/plan`);
  const current = page.getByRole("tab", { name: "Next steps", exact: true });
  await expect(current).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Growth plays", exact: true })).toHaveCount(0);
  const cycle = page.getByRole("region", { name: "Plan length and progress", exact: true });
  await expect(cycle.getByRole("button", { name: "14 days", exact: true })).toBeVisible();
  await expect(cycle.getByRole("button", { name: "7 days", exact: true })).toHaveCount(0);
  await cycle.getByRole("button", { name: "14 days", exact: true }).click();
  await expect(cycle.getByRole("button", { name: "14 days", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(cycle.getByRole("button", { name: "14 days", exact: true })).toHaveAttribute("aria-pressed", "true");
  await cycle.getByRole("button", { name: "Tell us how it went", exact: true }).click();
  await expect(cycle.getByRole("textbox")).toHaveCount(0);
  await cycle.getByRole("radio", { name: "I’m not sure yet", exact: true }).check();
  await cycle.getByRole("radio", { name: "30 days", exact: true }).check();
  await cycle.getByRole("button", { name: "Save and move forward", exact: true }).click();
  await expect(cycle.getByRole("button", { name: "30 days", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "What we learned", exact: true }).click();
  await expect(page.getByText("Length changed", { exact: false }).first()).toBeVisible();
  await page.locator("summary").filter({ hasText: "What we learned" }).click();
  await expect(page.getByText("Results have not been reviewed. No growth outcome is claimed.", { exact: true })).toBeVisible();
  await expectAccessible(page, "cycle history");
  await page.getByRole("tab", { name: "Next steps", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Why this plan", exact: true })).toHaveAttribute("aria-selected", "true");
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
  await page.getByRole("tab", { name: "Next steps", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("focused-cycle.png"), fullPage: true });
});

test("AI activity and Results open with the useful view @mobile", async ({ page }) => {
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/work`);
  await expect(page.getByRole("tab", { name: "In progress", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /Design editor/ })).toHaveCount(0);
  await page.getByText("Ask AI for something else", { exact: true }).click();
  await expect(page.getByLabel("Describe a problem or a goal", { exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "Ready for you", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Needs you/ })).toBeVisible();
  await page.goto(`/app/${slug}/results`);
  await expect(page.getByRole("tab", { name: "What happened", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Reported by the platform", { exact: true })).toHaveCount(0);
  await expectAccessible(page, "focused results");
  await expectNoHorizontalScroll(page);
});

test("AI questions use choices, support unknown and reveal text only for Other @mobile", async ({ page }) => {
  await page.goto("/design-system/v2/components/forms");
  const example = page.locator("#owner-question-example");
  await expect(example.getByRole("textbox")).toHaveCount(0);
  await expect(example.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await expect(example.getByRole("radio", { checked: true })).toHaveCount(0);
  await example.getByRole("radio", { name: "Email", exact: true }).check();
  await example.getByRole("radio", { name: "Book a call", exact: true }).check();
  await expect(example.getByRole("radio", { checked: true })).toHaveCount(1);
  await example.getByRole("button", { name: "I’m not sure", exact: true }).click();
  await expect(example.getByRole("status")).toContainText("remains unknown");
  await example.getByRole("radio", { name: "Something else", exact: true }).check();
  await example.getByRole("textbox", { name: "Your answer", exact: true }).fill("Use the shop’s contact form");
  await example.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(example.getByRole("status")).toContainText("Use the shop’s contact form");
  await example.getByRole("button", { name: "Try multiple choices", exact: true }).click();
  await example.getByRole("checkbox", { name: "Email", exact: true }).check();
  await example.getByRole("checkbox", { name: "Visit my website", exact: true }).check();
  await example.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(example.getByRole("status")).toContainText("Email; Visit my website");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("friendly-question.png"), fullPage: false });
});

test("Make it happen prepares the saved move and opens the actual work @mobile", async ({ page }) => {
  const slug = await openDemo(page);
  const recommendation = page.getByRole("region", { name: "Your next step", exact: true });
  await recommendation.getByRole("button", { name: "Make it happen", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/work`));
  const requests = page.getByRole("region", { name: "Your requests", exact: true });
  await expect(requests).toContainText(/Start the.*play/);
  await expect(requests.getByText(/See result|Done|Working|Ready for review/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
