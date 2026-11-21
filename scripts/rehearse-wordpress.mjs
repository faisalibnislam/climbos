// Optional integration check. Run with the disposable Playground installation documented in the audit.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { wordpressArticleHtml, wordpressPageTitle } from "../shared/integrations/wordpress.ts";

const fixtureDir = process.argv[2];
if (!fixtureDir) throw new Error("Provide the directory containing the fixture's Playground installation and WordPress archive.");
const fromFixture = createRequire(join(resolve(fixtureDir), "package.json"));
assert.equal(fromFixture("@wp-playground/cli/package.json").version, "3.1.65");
const { loadNodeRuntime } = fromFixture("@php-wasm/node");
const { bootWordPressAndRequestHandler } = fromFixture("@wp-playground/wordpress");
const origin = "https://wordpress-fixture.invalid";
const core = await readFile(join(fixtureDir, "wordpress-6.8.3.zip"));
assert.equal(createHash("sha256").update(core).digest("hex"), "a163fe8d0d3d89ce00139ca0e0618e109bb7441fae2f733cff6c72fc4d170fb9");
const sqlite = await readFile(join(dirname(fromFixture.resolve("@wp-playground/cli/package.json")), "sqlite-database-integration.zip"));
const wp = await bootWordPressAndRequestHandler({
  siteUrl: origin,
  phpVersion: "8.3",
  createPhpRuntime: () => loadNodeRuntime("8.3", { emscriptenOptions: { processId: process.pid } }),
  maxPhpInstances: 1,
  constants: { WP_HTTP_BLOCK_EXTERNAL: true, DISABLE_WP_CRON: true, WP_POST_REVISIONS: true },
  wordPressZip: new File([core], "wordpress.zip"),
  sqliteIntegrationPluginZip: new File([sqlite], "sqlite.zip"),
});
const php = await wp.getPrimaryPhp();
async function fixturePHP(code) {
  const response = await php.run({ code: "<?php require '/wordpress/wp-load.php'; wp_set_current_user(1); " + code });
  assert.equal(response.exitCode, 0, response.errors);
  return JSON.parse(response.text);
}
async function rest(method, path, params = {}) {
  php.writeFile("/tmp/request.json", JSON.stringify({ method, path, params }));
  const result = await fixturePHP(`
    $input = json_decode(file_get_contents('/tmp/request.json'), true);
    $request = new WP_REST_Request($input['method'], $input['path']);
    foreach ($input['params'] as $key => $value) $request->set_param($key, $value);
    $response = rest_do_request($request);
    $response = apply_filters('rest_post_dispatch', $response, rest_get_server(), $request);
    echo wp_json_encode(['status' => $response->get_status(), 'data' => $response->get_data()]);
  `);
  assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result));
  return result.data;
}
const browser = await chromium.launch();
try {
  const info = await fixturePHP("echo wp_json_encode([get_bloginfo('version'), get_stylesheet()]);");
  assert.equal(info[0], "6.8.3");
  const original = { title: "Service overview", content: wordpressArticleHtml("Our original service description.") };
  const proposed = { title: wordpressPageTitle("Book a service review", "Internal QA name"), content: wordpressArticleHtml("Choose a **review time** and [read the guide](https://wordpress-fixture.invalid/guide).") };
  const page = await rest("POST", "/wp/v2/pages", { ...original, status: "publish" });
  assert.ok(Number.isSafeInteger(page.id));
  php.writeFile("/tmp/page-id.txt", String(page.id));
  await fixturePHP("echo wp_json_encode(wp_save_post_revision((int)file_get_contents('/tmp/page-id.txt')));");
  const draft = await rest("POST", "/wp/v2/posts", { ...proposed, status: "draft" });
  const readback = await rest("GET", "/wp/v2/posts/" + draft.id, { context: "edit", _fields: "id,status,title.raw,content.raw" });
  assert.deepEqual(readback, { id: draft.id, status: "draft", title: { raw: proposed.title }, content: { raw: proposed.content } });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || route.request().method() !== "GET") return route.abort();
    // Send browser requests directly to the in-memory WordPress handler. No listening socket.
    let response = await wp.request({ url: url.pathname + url.search });
    for (let redirects = 0; response.httpStatusCode >= 300 && response.httpStatusCode < 400; redirects++) {
      const next = new URL(response.headers.location?.[0], url);
      assert.equal(next.origin, origin);
      assert.ok(redirects < 3, "Unexpected WordPress redirect loop");
      response = await wp.request({ url: next.pathname + next.search });
    }
    await route.fulfill({ status: response.httpStatusCode, contentType: response.headers["content-type"]?.[0], body: Buffer.from(response.bytes) });
  });
  const tab = await context.newPage();
  async function checkRendered(title, expectedText) {
    for (const width of [390, 1280]) {
      await tab.setViewportSize({ width, height: 800 });
      await tab.goto(origin + "/?page_id=" + page.id);
      const heading = tab.getByRole("heading", { level: 1, name: title, exact: true });
      assert.equal(await heading.count(), 1, (await tab.locator("body").innerText()).slice(0, 1000));
      assert.ok(await heading.isVisible());
      const main = tab.getByRole("main");
      assert.ok((await main.innerText()).includes(expectedText));
      if (title === proposed.title) {
        const guide = main.getByRole("link", { name: "read the guide" });
        assert.equal(await guide.getAttribute("href"), origin + "/guide");
        await guide.focus();
        assert.ok(await guide.evaluate(link => document.activeElement === link));
      }
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth), width);
    }
  }
  await checkRendered(original.title, "Our original service description.");
  await rest("POST", "/wp/v2/pages/" + page.id, proposed);
  await checkRendered(proposed.title, "Choose a review time");
  const revisions = await rest("GET", "/wp/v2/pages/" + page.id + "/revisions", { context: "edit" });
  const baseline = revisions.find(row => row.title.raw === original.title && row.content.raw === original.content);
  assert.ok(baseline && Number.isSafeInteger(baseline.id), "Original revision unavailable: " + JSON.stringify(revisions.map(({id,title,content}) => ({id,title,content}))));
  php.writeFile("/tmp/baseline-id.txt", String(baseline.id));
  const restored = await fixturePHP("echo wp_json_encode(wp_restore_post_revision((int)file_get_contents('/tmp/baseline-id.txt')));");
  assert.equal(restored, page.id);
  const saved = await rest("GET", "/wp/v2/pages/" + page.id, { context: "edit" });
  assert.equal(saved.content.raw, original.content);
  assert.equal(saved.title.raw, original.title);
  await checkRendered(original.title, "Our original service description.");
  console.log("Passed: WordPress " + info.join(" / ") + ", exact private draft, original/proposed/restored theme at 390 and 1280px.");
} finally {
  await browser.close();
  php.exit();
}
