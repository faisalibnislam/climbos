import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";

const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, cli, append } = localDemoFixtures(envFile);

test("owner previews, approves and recovers page copy using local fixtures @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires the isolated local demo database");
  test.setTimeout(180_000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const business = (await rows("businesses")).find(row => row.orgId === org._id)!;
  const identity = JSON.stringify({ subject: member.userId + "|page-fixture", tokenIdentifier: "test|page-fixture" });
  const now = Date.now();
  const title = "Fixture services " + now;
  await append("artifacts", [{ orgId: org._id, businessId: business._id, kind: "blog_post", channel: "blog", title, currentVersion: 0, status: "in_review", createdAt: now, updatedAt: now }]);
  const artifactId = (await rows("artifacts")).find(row => row.orgId === org._id && row.title === title)!._id;
  const edit = (title: string, body: string) => cli(["run", "content:edit", JSON.stringify({ slug, artifactId, title, body, hashtags: [] }), "--identity", identity]);
  await edit(title, "Our initial service description.");
  const outside: string[] = [];
  await page.route("https://*.example.com/**", route => { outside.push(route.request().url()); return route.abort(); });
  await page.goto('/app/' + slug + '/content/' + artifactId);
  const open = () => page.getByText("Rehearse an existing WordPress page change", { exact: true }).click();
  await open();
  await page.getByLabel("Existing page address").fill("https://site.example.com/services/");
  await page.getByLabel("Original source revision or capture label").fill("fixture revision 17");
  await page.getByRole("button", { name: "Save version 1 as original copy" }).click();
  const frame = page.frameLocator('iframe[title="Private WordPress copy preview"]');
  await expect(frame.getByText("Our initial service description.")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Book a service review");
  await page.getByLabel("Page text", { exact: true }).fill("Choose a time to review your setup. See [our guide](https://site.example.com/guide).");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  const select = async (name: string, option: RegExp) => {
    await page.getByRole("combobox", { name }).click();
    await page.getByRole("option", { name: option }).click();
  };
  await select("Copy to preview", /Proposed · v2/);
  await expect(frame.getByRole("heading", { name: "Book a service review" })).toBeVisible();
  for (const [width, label] of [[390, /Mobile/], [1280, /Desktop/]] as const) {
    await select("Preview width", label);
    await expect.poll(() => frame.locator("html").evaluate(el => [el.clientWidth, el.scrollWidth])).toEqual([width, width]);
    await expectNoHorizontalScroll(page);
    await frame.locator("html").screenshot({ path: testInfo.outputPath("proposed-" + width + ".png") });
  }
  expect(await frame.getByRole("link").count()).toBe(0);
  await page.getByRole("button", { name: "Approve this copy for rehearsal" }).click();
  await expect(page.getByText("Rehearsal currently shows approved version 2.")).toBeVisible();
  await page.reload();
  await open();
  await expect(frame.getByRole("heading", { name: "Book a service review" })).toBeVisible();
  await select("Copy to preview", /Original · v1/);
  await page.getByRole("button", { name: "Restore original in rehearsal" }).click();
  await expect(page.getByText("Rehearsal currently shows original version 1.")).toBeVisible();
  await expect(frame.getByText("Our initial service description.")).toBeVisible();
  await select("Copy to preview", /Last approved · v2/);
  await expect(frame.getByRole("heading", { name: "Book a service review" })).toBeVisible();
  expect((await rows("wordpressDraftOperations")).filter(row => row.artifactId === artifactId)).toEqual([]);
  expect(outside).toEqual([]);
});
