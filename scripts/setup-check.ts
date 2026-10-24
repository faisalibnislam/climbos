/**
 * Reports which configuration is present for the web app (.env.local) and the
 * Convex deployment. Never prints secret values.
 * Usage: pnpm setup:check [--prod]
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const prod = process.argv.includes("--prod");
const groups: { name: string; where: "web" | "convex"; keys: string[]; required: boolean; impact: string }[] = [
  { name: "Convex connection", where: "web", keys: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"], required: true, impact: "App can't load data" },
  { name: "Server secret", where: "web", keys: ["CLIMBOS_SERVER_SECRET"], required: true, impact: "Landing preview and OAuth callbacks are disabled" },
  { name: "Auth keys", where: "convex", keys: ["JWT_PRIVATE_KEY", "JWKS", "SITE_URL"], required: true, impact: "Nobody can sign in (run pnpm auth:keys)" },
  { name: "Server secret (Convex)", where: "convex", keys: ["CLIMBOS_SERVER_SECRET"], required: true, impact: "Landing preview and OAuth callbacks are disabled" },
  { name: "Encryption", where: "convex", keys: ["CLIMBOS_ENCRYPTION_KEY", "CLIMBOS_ENCRYPTION_KEY_ID"], required: true, impact: "Connections can't store tokens" },
  { name: "Operators", where: "convex", keys: ["OPS_EMAILS"], required: true, impact: "Nobody can open /ops" },
  { name: "Email sign-in (Resend)", where: "convex", keys: ["AUTH_RESEND_KEY"], required: true, impact: "Email codes can't be sent" },
  { name: "OpenAI text models", where: "convex", keys: ["OPENAI_API_KEY"], required: true, impact: "Real text-AI work is unavailable (demo still works)" },
  { name: "Gemini image/video models", where: "convex", keys: ["GEMINI_API_KEY"], required: false, impact: "AI image and video generation is unavailable" },
  { name: "Billing (Polar)", where: "convex", keys: ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET", "POLAR_PRODUCT_BASIC", "POLAR_PRODUCT_STARTER", "POLAR_PRODUCT_GROWTH", "POLAR_PRODUCT_PRO", "POLAR_PRODUCT_BUSINESS", "POLAR_PRODUCT_BOOST_29"], required: true, impact: "Plans can't be purchased" },
  { name: "Resend webhooks", where: "convex", keys: ["RESEND_WEBHOOK_SECRET"], required: false, impact: "Bounces/complaints aren't auto-suppressed" },
  { name: "Google sign-in", where: "convex", keys: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"], required: false, impact: "Email codes only" },
  { name: "Firecrawl", where: "convex", keys: ["FIRECRAWL_API_KEY"], required: false, impact: "Built-in website reader is used" },
  { name: "Google integrations", where: "convex", keys: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"], required: false, impact: "GA4/Search Console/Google Ads show Setup needed" },
  { name: "Google Ads API", where: "convex", keys: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_ACCESS_LEVEL"], required: false, impact: "Google Ads campaigns can't be created" },
  { name: "Meta integrations", where: "convex", keys: ["META_APP_ID", "META_APP_SECRET", "META_ADS_ACCESS_TIER"], required: false, impact: "Facebook Pages / Meta Ads show Setup needed" },
  { name: "Instagram Login", where: "convex", keys: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"], required: false, impact: "Instagram publishing shows Setup needed" },
  { name: "LinkedIn publishing app", where: "convex", keys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], required: false, impact: "LinkedIn publishing shows Setup needed" },
  { name: "X publishing app", where: "convex", keys: ["X_CLIENT_ID", "X_CLIENT_SECRET"], required: false, impact: "X publishing shows Setup needed" },
  { name: "R2 storage", where: "convex", keys: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"], required: false, impact: "Convex file storage is used" },
  { name: "Product analytics", where: "web", keys: ["NEXT_PUBLIC_POSTHOG_KEY"], required: false, impact: "No ClimbOS usage analytics" },
];

function webEnv(): Record<string, string> {
  const file = prod ? ".env.production.local" : ".env.local";
  const out: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && m[2].replace(/["']/g, "").trim()) out[m[1]] = "set";
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = "set";
  return out;
}

function convexEnvNames(): Set<string> {
  try {
    const listing = execFileSync("npx", ["convex", "env", "list", ...(prod ? ["--prod"] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return new Set(listing.split(/\r?\n/).map((l) => l.split("=")[0].trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

const web = webEnv();
const convex = convexEnvNames();
let missingRequired = 0;
for (const g of groups) {
  const present = g.keys.filter((k) => (g.where === "web" ? web[k] : convex.has(k)));
  const ok = present.length === g.keys.length;
  if (!ok && g.required) missingRequired++;
  const mark = ok ? "✔" : g.required ? "✖" : "○";
  const missing = g.keys.filter((k) => !present.includes(k));
  console.log(`${mark} [${g.where}] ${g.name}${ok ? "" : ` — missing: ${missing.join(", ")} (${g.impact})`}`);
}
console.log(missingRequired ? `\n${missingRequired} required group(s) incomplete.` : "\nAll required configuration is present.");
process.exit(missingRequired ? 1 : 0);
