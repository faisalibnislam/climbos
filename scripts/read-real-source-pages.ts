/** Re-read already captured public HTML through the production focused reader. No network or AI. */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { extractPageContent } from "../shared/integrations/website";
const root = resolve("bench/cache/anthropic-real-2026-11-09");
for (const id of ["macloving", "livoform", "folevi"]) {
  const old = resolve(root, `${id}-evidence.json`), frozen = resolve(root, `${id}-baseline-fixed-evidence.json`);
  if (existsSync(old) && !existsSync(frozen)) copyFileSync(old, frozen);
}
const parserSourceHash = createHash("sha256").update(readFileSync(resolve("shared/integrations/website.ts"))).digest("hex");
const directory = resolve(root, "sources");
for (const filename of readdirSync(directory).filter((file) => file.endsWith(".meta.json") && !file.startsWith("external-"))) {
  const metaPath = resolve(directory, filename), meta = JSON.parse(readFileSync(metaPath, "utf8"));
  if (meta.status !== 200) continue;
  const page = extractPageContent(readFileSync(resolve(directory, filename.replace(".meta.json", ".html")), "utf8"), meta.finalUrl, { maxTextChars: 10000, maxLinks: 120, includeExternalLinks: true });
  const links = page.links.filter((link) => /^(?:download(?:\s+(?:free|for mac|app))?|(?:get|view|open|download)\s+(?:it\s+)?(?:on\s+the\s+)?(?:app store|play store)|free apps|pricing|see pricing)$/i.test(link.text.trim()) && (new URL(link.url).hostname === new URL(meta.finalUrl).hostname || ["apps.apple.com", "play.google.com"].includes(new URL(link.url).hostname))).slice(0, 4);
  const text = [page.title, `Reading region: ${page.contentScope ?? "body"}. Website claims only; product behavior is not independently verified.`, ...(page.jsonLdPrices.length ? ["Structured prices published by this page (not verified checkout or average customer value):", ...page.jsonLdPrices.map((price) => `${price.name ?? price.type}: ${price.price} ${price.currency ?? "currency unspecified"}`)] : []), ...(links.length ? ["Observed link destinations (targets not tested by observing the link):", ...links.map((link) => `${link.text}: ${link.url}`)] : []), page.contentText ?? page.text].filter(Boolean).join("\n");
  writeFileSync(resolve(directory, filename.replace(".meta.json", ".txt")), text);
  writeFileSync(metaPath, JSON.stringify({ ...meta, readingScope: page.contentScope ?? "body", parserSourceHash, sourceTextHash: createHash("sha256").update(text).digest("hex") }, null, 2));
  console.log(`${filename}: ${page.contentScope ?? "body"}, ${text.length} characters`);
}
