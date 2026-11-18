import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";

test("Focused timeline keeps task progress separate from business outcomes @mobile", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/plan`);
  const current = page.getByRole("tab", { name: "Next steps", exact: true });
  await expect(current).toHaveAttribute("aria-selected", "true");
  const timeline = page.getByRole("region", { name: "Your plan timeline", exact: true });
  await expect(timeline.getByRole("heading", { name: "Prepare the review", exact: true })).toBeVisible();
  await timeline.getByText("Track this step", { exact: true }).click();
  const task = timeline.getByRole("checkbox").first();
  await task.click();
  await expect(task).toBeChecked();
  await page.reload();
  await timeline.getByText("Track this step", { exact: true }).click();
  await expect(task).toBeChecked();
  const learning = page.getByRole("region", { name: "Check your progress", exact: true });
  await expect(learning.getByRole("button", { name: "Record outcome", exact: true })).toBeVisible();
  await expect(learning).toContainText("Completing tasks alone does not establish a business result.");
  await task.click();
  await expect(task).not.toBeChecked();
  await current.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Strategy options", exact: true })).toHaveAttribute("aria-selected", "true");
  await current.click();
  await expectAccessible(page, "plan timeline and separate outcome");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("focused-timeline.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("Work opens saved drafts and keeps activity and decisions discoverable @mobile", async ({ page }) => {
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/work`);
  await expect(page.getByRole("tab", { name: "Your drafts", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Prepared drafts by goal", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "AI activity", exact: true }).click();
  await page.getByText("Ask AI for something else", { exact: true }).click();
  await expect(page.getByLabel("Your request", { exact: true })).toBeEditable();
  await page.getByRole("tab", { name: "Needs a decision", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Needs you/ })).toBeVisible();
  await page.goto(`/app/${slug}/results`);
  await expect(page.getByRole("tab", { name: "What happened", exact: true })).toHaveAttribute("aria-selected", "true");
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

test("Demo explains preparation limits without offering a paid action @mobile", async ({ page }) => {
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/plan`);
  const timeline = page.getByRole("region", { name: "Your plan timeline", exact: true });
  await expect(timeline.getByText("Explore saved work in the demo", { exact: true })).toBeVisible();
  await expect(timeline.getByRole("link", { name: "Use my own business", exact: true })).toHaveAttribute("href", "/sign-in?switch=1&next=/onboarding");
  await expect(timeline.getByRole("button", { name: "Make it happen", exact: true })).toHaveCount(0);
  await expect(timeline.getByText(/Up to .*credits/)).toHaveCount(0);
  await timeline.getByText("Track this step", { exact: true }).click();
  await expect(timeline.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
