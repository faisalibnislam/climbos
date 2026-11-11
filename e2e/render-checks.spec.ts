import { test, expect } from "@playwright/test";
import { inspectRenderedPage } from "../shared/site/renderChecks";
test("rendered checks report actual desktop and mobile layout evidence", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent('<html lang="en"><body><h1>Example</h1><label for="email">Email address</label><input id="email"><button aria-label="Save"></button><a href="/help"><img alt="Help"></a><p>Readable description.</p></body></html>');
    const good = await page.evaluate(inspectRenderedPage);
    expect(good.viewport.width).toBe(width);
    expect(good.checks.every((check) => check.state === "pass")).toBe(true);
    await page.setContent('<html><body><div style="width:2000px">Wide</div><button></button><input><a href="/help"></a><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><p style="font-size:10px">Small text</p></body></html>');
    const bad = await page.evaluate(inspectRenderedPage);
    expect(bad.checks.filter((check) => check.state === "review").map((check) => check.id)).toEqual(expect.arrayContaining(["horizontal-overflow", "document-language", "primary-heading", "control-names", "link-names", "image-alternatives", "small-text"]));
  }
});

test("a saved local draft keeps captures and layout observations against its version", async ({ page }) => {
  test.setTimeout(120000);
  const { openDemo } = await import("./helpers");
  const slug = await openDemo(page);
  await page.goto(`/app/${slug}/pages`);
  await page.getByLabel("What's the page for?", { exact: true }).fill("A synthetic project handoff utility demonstration for local review. No customer claims or offers.");
  await page.getByRole("button", { name: "Write page", exact: true }).click();
  // Generation opens the editor as soon as the fixture draft is saved.
  const dialog = page;
  await expect(dialog.getByRole("button", { name: /Capture version/ })).toBeVisible({ timeout: 45000 });
  await dialog.getByRole("button", { name: /Capture version/ }).click();
  const capture = dialog.getByRole("region", { name: "Captured views of this draft" });
  await expect(capture.getByText("Captured", { exact: true })).toBeVisible({ timeout: 85000 });
  await expect(capture.getByText("Desktop page checks", { exact: false })).toBeVisible();
  await expect(capture.getByText("Mobile page checks", { exact: false })).toBeVisible();
  await expect(capture.getByRole("img")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /Publish version/ })).toBeVisible();
});
