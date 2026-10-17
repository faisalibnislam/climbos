// Sets up everything ClimbOS needs in Polar (sandbox by default), using only an
// organization access token:
//   1. the six products (5 monthly plans + the one-off capacity pack),
//   2. a webhook endpoint pointing at this env file's Convex deployment,
// then writes POLAR_PRODUCT_* and POLAR_WEBHOOK_SECRET into the env file.
// Idempotent: products with the same name and an endpoint with the same URL are reused.
// Never prints secret values.
// Requires POLAR_ACCESS_TOKEN (and optional POLAR_SERVER=production) in the env file.
// Usage: node scripts/polar-setup.mjs [--file .env.local] [--sync]
//   --sync  also copies the results into the matching Convex deployment
//           (production when --file is .env.production.local).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const fileIdx = process.argv.indexOf("--file");
const file = fileIdx >= 0 ? process.argv[fileIdx + 1] : ".env.local";
if (!existsSync(file)) {
  console.error(`${file} not found`);
  process.exit(1);
}
let envText = readFileSync(file, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim()]),
);
const token = env.POLAR_ACCESS_TOKEN;
if (!token) {
  console.error("POLAR_ACCESS_TOKEN is empty in " + file);
  process.exit(1);
}
const base = env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";

const siteUrl = env.NEXT_PUBLIC_CONVEX_SITE_URL;
if (!siteUrl) {
  console.error("NEXT_PUBLIC_CONVEX_SITE_URL is empty in " + file + " (needed for the webhook URL)");
  process.exit(1);
}
const webhookUrl = new URL("/webhooks/polar", siteUrl).toString();
// Everything convex/billing.ts processes: checkouts, orders (incl. refunds) and subscriptions.
const WEBHOOK_EVENTS = [
  "checkout.created", "checkout.updated",
  "order.created", "order.paid", "order.updated", "order.refunded",
  "subscription.created", "subscription.active", "subscription.updated", "subscription.canceled",
  "subscription.uncanceled", "subscription.revoked", "subscription.past_due",
];

function setEnvLine(name, value) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  envText = re.test(envText) ? envText.replace(re, line) : `${envText.trimEnd()}\n${line}\n`;
}

const PRODUCTS = [
  { env: "POLAR_PRODUCT_BASIC", name: "ClimbOS Basic", cents: 1900, recurring: true, description: "Your AI growth team in miniature: a monthly plan and a few ready-to-post drafts." },
  { env: "POLAR_PRODUCT_STARTER", name: "ClimbOS Starter", cents: 16900, recurring: true, description: "All 10 growth roles for a founder getting a steady rhythm going." },
  { env: "POLAR_PRODUCT_GROWTH", name: "ClimbOS Growth", cents: 44900, recurring: true, description: "Approved recurring campaigns and one ads workflow for small teams." },
  { env: "POLAR_PRODUCT_PRO", name: "ClimbOS Pro", cents: 99900, recurring: true, description: "Up to 3 brands and multi-channel experiments." },
  { env: "POLAR_PRODUCT_BUSINESS", name: "ClimbOS Business", cents: 229900, recurring: true, description: "Up to 5 brands, governed policies and portfolio reporting." },
  { env: "POLAR_PRODUCT_BOOST_29", name: "ClimbOS Extra capacity pack", cents: 2900, recurring: false, description: "More AI work for the current month. Bought only when you click; never automatic." },
];

async function api(path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  return json;
}

const existing = (await api("/v1/products/?limit=100&is_archived=false")).items ?? [];
for (const p of PRODUCTS) {
  let product = existing.find((x) => x.name === p.name);
  if (!product) {
    product = await api("/v1/products/", {
      method: "POST",
      body: JSON.stringify({
        name: p.name,
        description: p.description,
        recurring_interval: p.recurring ? "month" : null,
        prices: [{ amount_type: "fixed", price_amount: p.cents, price_currency: "usd" }],
      }),
    });
    console.log(`✔ created ${p.name}`);
  } else {
    console.log(`• reusing ${p.name}`);
  }
  setEnvLine(p.env, product.id);
}

const endpoints = (await api("/v1/webhooks/endpoints?limit=100")).items ?? [];
let endpoint = endpoints.find((e) => e.url === webhookUrl);
if (endpoint) {
  endpoint = await api(`/v1/webhooks/endpoints/${endpoint.id}`, { method: "PATCH", body: JSON.stringify({ events: WEBHOOK_EVENTS, format: "raw", enabled: true }) });
  console.log(`• reusing webhook → ${webhookUrl}`);
} else {
  endpoint = await api("/v1/webhooks/endpoints", { method: "POST", body: JSON.stringify({ url: webhookUrl, name: "ClimbOS", format: "raw", events: WEBHOOK_EVENTS }) });
  console.log(`✔ created webhook → ${webhookUrl}`);
}
if (!endpoint.secret) throw new Error("Polar didn't return a webhook secret; copy it from the Polar dashboard into POLAR_WEBHOOK_SECRET.");
setEnvLine("POLAR_WEBHOOK_SECRET", endpoint.secret);

writeFileSync(file, envText);
console.log(`Product ids and webhook secret written to ${file}.`);

if (process.argv.includes("--sync")) {
  const prod = file.includes("production");
  execFileSync("node", ["scripts/env-sync.mjs", ...(prod ? ["--prod"] : []), "--file", file], { stdio: "inherit" });
} else {
  console.log(`Next: node scripts/env-sync.mjs${file.includes("production") ? " --prod" : ""} --file ${file}`);
}
