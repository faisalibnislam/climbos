// Creates ClimbOS products in Polar (sandbox by default) and writes the product
// ids into .env.local. Idempotent: existing products with the same name are reused.
// Requires POLAR_ACCESS_TOKEN (and optional POLAR_SERVER=production) in .env.local.
// Usage: node scripts/polar-setup.mjs [--file .env.local]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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
  const line = `${p.env}=${product.id}`;
  envText = new RegExp(`^${p.env}=.*$`, "m").test(envText) ? envText.replace(new RegExp(`^${p.env}=.*$`, "m"), line) : `${envText.trimEnd()}\n${line}\n`;
}
writeFileSync(file, envText);
console.log(`Product ids written to ${file}. Next: pnpm env:sync`);
