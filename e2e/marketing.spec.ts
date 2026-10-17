import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll } from "./helpers";

test.describe("public site", () => {
  test("landing page explains the product honestly and validates the preview form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/approve anything that goes live/i).first()).toBeVisible();
    await expect(page.getByText(/no contact database|doesn't sell or include a contact database/i).first()).toBeVisible();
    await page.getByRole("button", { name: /show me/i }).click();
    await expect(page.getByText(/enter your website|add your website|website/i).first()).toBeVisible();
    await expectAccessible(page, "landing");
  });

  test("pricing lists every plan from the entitlement registry", async ({ page }) => {
    await page.goto("/pricing");
    for (const price of ["$19", "$169", "$449", "$999", "$2,299"]) await expect(page.getByText(price).first()).toBeVisible();
    await expect(page.getByText(/\$29/).first()).toBeVisible();
    await expect(page.getByText(/most popular/i)).toHaveCount(0);
    await expectAccessible(page, "pricing");
  });

  test("sign-in is accessible", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expectAccessible(page, "sign-in");
  });

  test("security, privacy and terms pages render @mobile", async ({ page }) => {
    for (const path of ["/security", "/privacy", "/terms", "/pricing", "/"]) {
      await page.goto(path);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expectNoHorizontalScroll(page);
    }
  });

  test("protected routes redirect signed-out visitors to sign-in", async ({ page }) => {
    await page.goto("/app/anything/today");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.goto("/ops");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test("design system reference renders every component accessibly", async ({ page }) => {
  await page.goto("/design-system");
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  await expectAccessible(page, "design system");
});
