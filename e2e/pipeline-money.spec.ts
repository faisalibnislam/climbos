import { test, expect } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, append } = localDemoFixtures(envFile);
const copyRow = ({ _id: _i, _creationTime: _c, ...data }: Record<string, unknown>) => data;

test("Customer progress preserves currency precision and unknown values @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const demoSlug = await openDemo(page);
  const original = (await rows("organizations")).find(row => row.slug === demoSlug);
  if (!original || original.kind !== "demo") throw new Error("Demo workspace required");
  const member = (await rows("memberships")).find(row => row.orgId === original._id);
  if (!member) throw new Error("Demo owner missing");
  const slug = `money-${testInfo.project.name}-${Date.now()}`;
  await append("organizations", [{ ...copyRow(original), slug, name: "Pipeline money fixture", kind: "demo", currency: "KWD" }]);
  const org = (await rows("organizations")).find(row => row.slug === slug);
  if (!org || org.kind !== "demo") throw new Error("Isolated workspace missing");
  await append("memberships", [{ ...copyRow(member), orgId: org._id }]);
  const base = { orgId: org._id, source: "manual", stage: "lead", currency: "KWD", notes: [], createdAt: Date.now(), updatedAt: Date.now() };
  await append("deals", [
    { ...base, name: "Precise sale", valueMinor: 12345, valueVersion: "currency-minor-v1" },
    { ...base, name: "Dollar sale", valueMinor: 10000, currency: "USD", valueVersion: "currency-minor-v1" },
    { ...base, name: "Unknown sale" },
    { ...base, name: "Legacy yen sale", valueMinor: 100000, currency: "JPY" },
  ]);
  const effects = async () => Promise.all(["workflowRuns", "approvals", "actionReceipts", "webhookDeliveries"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects(); const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/pipeline`);
  await expect(page.getByRole("heading", { name: "Customer progress", exact: true })).toBeVisible();
  await expect(page.getByText(/Values are owner-reported, not confirmed payments/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Precise sale/ })).toContainText("12.345");
  await expect(page.getByRole("button", { name: /Legacy yen sale/ })).toContainText("Value needs review");
  await expect(page.getByRole("button", { name: /Unknown sale/ })).toContainText("Value not recorded");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("separate-currencies.png"), fullPage: true });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add someone" });
  await add.getByLabel("Name", { exact: true }).fill("New KWD buyer");
  await add.getByLabel(/Possible sale value \(KWD\)/).fill("9.876");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  const saved = async () => (await rows("deals")).find(row => row.orgId === org._id && row.name === "New KWD buyer");
  await expect.poll(saved).toMatchObject({ valueMinor: 9876, currency: "KWD", valueVersion: "currency-minor-v1" });
  await page.getByRole("button", { name: /New KWD buyer/ }).click();
  const edit = page.getByRole("dialog", { name: "New KWD buyer" });
  await expect(edit.getByLabel(/Possible sale value \(KWD\)/)).toHaveValue("9.876");
  await edit.getByLabel(/Possible sale value \(KWD\)/).fill("4.321");
  await edit.getByText("Notes", { exact: true }).click();
  await expect.poll(saved).toMatchObject({ valueMinor: 4321 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Legacy yen sale/ }).click();
  const legacy = page.getByRole("dialog", { name: "Legacy yen sale" });
  await expect(legacy.getByText(/An earlier amount has unconfirmed currency units/)).toBeVisible();
  await expect(legacy.getByLabel(/Possible sale value \(JPY\)/)).toHaveValue("");
  await legacy.getByLabel(/Possible sale value \(JPY\)/).focus();
  await legacy.getByText("Notes", { exact: true }).click();
  expect((await rows("deals")).find(row => row.orgId === org._id && row.name === "Legacy yen sale")?.valueMinor).toBe(100000);
  await expectAccessible(page, "pipeline currency review");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("legacy-value-review.png"), fullPage: true });
  expect(errors).toEqual([]);
  expect(await effects()).toEqual(before);
});
