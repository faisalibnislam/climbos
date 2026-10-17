// Copies server-side values from .env.local into the Convex deployment.
// Never prints secret values. Usage: node scripts/env-sync.mjs [--prod] [--file .env.production.local]
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SERVER_VARS = [
  "OPS_EMAILS", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AUTH_RESEND_KEY", "RESEND_FROM", "RESEND_WEBHOOK_SECRET",
  "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "POLAR_SERVER", "POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET",
  "POLAR_PRODUCT_BASIC", "POLAR_PRODUCT_STARTER", "POLAR_PRODUCT_GROWTH", "POLAR_PRODUCT_PRO", "POLAR_PRODUCT_BUSINESS",
  "POLAR_PRODUCT_BOOST_29", "FIRECRAWL_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET",
  "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_ACCESS_LEVEL",
  "META_APP_ID", "META_APP_SECRET", "META_ADS_ACCESS_TIER", "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "SITE_URL", "CUSTOM_AUTH_SITE_URL",
];

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const fileIdx = args.indexOf("--file");
const file = fileIdx >= 0 ? args[fileIdx + 1] : ".env.local";
if (!existsSync(file)) { console.error(`${file} not found`); process.exit(1); }

const env = {};
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let value = m[2].replace(/\s+#.*$/, "");
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  env[m[1]] = value;
}

let set = 0;
for (const name of SERVER_VARS) {
  const value = env[name];
  if (!value) continue;
  execFileSync("npx", ["convex", "env", "set", ...(prod ? ["--prod"] : []), name, "--", value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`✔ ${name}`);
  set++;
}
console.log(`${set} value(s) synced to the ${prod ? "production" : "dev"} Convex deployment.`);
