/** Isolated, credential-free fixture workspace. Never reads the configured Convex deployment. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const real = process.argv.includes("--real");
const profile = real ? "real" : "demo";
const backendPort = real ? 3330 : 3320;
const state = resolve((real ? process.env.CLIMBOS_LOCAL_REAL_STATE_DIR : process.env.CLIMBOS_LOCAL_STATE_DIR) || join(tmpdir(), `climbos-local-${profile}`));
const backendUrl = `http://127.0.0.1:${backendPort}`;
const siteUrl = `http://127.0.0.1:${backendPort + 1}`;
const webPort = real ? 3430 : 3420;
const webUrl = `http://127.0.0.1:${webPort}`;
const envFile = join(state, "backend.env");
const convexCli = join(repo, "node_modules/convex/bin/main.js");
const command = process.argv[2];
const validCommands = ["backend", "configure", "sync", "web", "build"];
if (!validCommands.includes(command)) {
  console.log(real ? "Local real-business workspace (separate empty database):\n\npnpm local:real backend\npnpm local:real configure\npnpm local:real sync\npnpm local:real web\n\nOpen " + webUrl + "/dev-login. Capped evaluation/import instructions: docs/Anthropic-and-Simple-Experience-2026-11-09.md" : "Local fixture demo (no hosted deployment or paid provider keys):\n\nTerminal 1: pnpm local:demo backend\nTerminal 2: pnpm local:demo configure\n            pnpm local:demo sync\n            pnpm local:demo web\n\nOpen " + webUrl + "/demo\n\nKeep Terminal 1 running. State: " + state + "\nOptional: pnpm local:demo build");
  process.exit(command ? 1 : 0);
}
mkdirSync(state, { recursive: true, mode: 0o700 });

// A small allowlist prevents inherited model, billing, mail and deployment
// credentials from reaching any child. Explicit blanks also prevent Next's
// automatic .env loading from reintroducing application configuration.
const childEnv = {};
for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "SYSTEMROOT", "SystemRoot", "SHELL", "TERM"]) {
  if (process.env[key]) childEnv[key] = process.env[key];
}
for (const file of readdirSync(repo).filter((name) => /^\.env(?:\.|$)/.test(name))) {
  for (const line of readFileSync(join(repo, file), "utf8").split(/\r?\n/)) {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key) childEnv[key] = "";
  }
}
Object.assign(childEnv, {
  CONVEX_DEPLOYMENT: "", CONVEX_DEPLOY_KEY: "", CONVEX_SELF_HOSTED_URL: "", CONVEX_SELF_HOSTED_ADMIN_KEY: "",
  OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", FIRECRAWL_API_KEY: "",
  POLAR_ACCESS_TOKEN: "", AUTH_RESEND_KEY: "", RESEND_API_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1", DISABLE_BEACON: "1", SENTRY_DSN: "",
});

function saveJson(file, data) {
  writeFileSync(join(state, file), JSON.stringify(data, null, 2), { mode: 0o600 });
}
function run(args, env = childEnv) {
  const child = spawn(process.execPath, args, { cwd: repo, env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => process.exit(code ?? 1));
}
function localBackendEnv() {
  if (!existsSync(envFile)) throw new Error("Start pnpm local:demo backend first.");
  const contents = readFileSync(envFile, "utf8");
  const rows = contents.trim().split(/\r?\n/);
  if (rows.length !== 2 || rows[0] !== `CONVEX_SELF_HOSTED_URL=${backendUrl}` || !/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1])) {
    throw new Error("Refusing a backend.env that does not identify the isolated loopback backend.");
  }
  return { ...childEnv, CONVEX_SELF_HOSTED_URL: backendUrl, CONVEX_SELF_HOSTED_ADMIN_KEY: rows[1].slice("CONVEX_SELF_HOSTED_ADMIN_KEY=".length) };
}

try {
  if (command === "backend") {
    const cache = join(homedir(), ".cache/convex/binaries");
    const candidates = existsSync(cache) ? readdirSync(cache).sort().reverse().map((name) => join(cache, name, "convex-local-backend")).filter(existsSync) : [];
    const binary = process.env.CLIMBOS_LOCAL_BACKEND_BINARY || candidates[0];
    if (!binary || !existsSync(binary)) throw new Error("No cached Convex local backend found. Install it using the official Convex local-deployment instructions, or set CLIMBOS_LOCAL_BACKEND_BINARY. This script does not download or configure a hosted deployment.");
    const instancePath = join(state, "instance.json");
    const instance = existsSync(instancePath) ? JSON.parse(readFileSync(instancePath, "utf8")) : { name: `climbos-local-${profile}`, secret: randomBytes(32).toString("hex") };
    if (instance.name !== `climbos-local-${profile}`) throw new Error("Refusing state created by a different local profile.");
    saveJson("instance.json", instance);
    let key;
    try { key = execFileSync(binary, ["keygen", "admin-key", "--instance-name", instance.name, "--instance-secret", instance.secret], { env: childEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
    catch { throw new Error("The local backend could not generate a test admin key. Check that the cached binary supports keygen."); }
    writeFileSync(envFile, `CONVEX_SELF_HOSTED_URL=${backendUrl}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${key}\n`, { mode: 0o600 });
    console.log(`Starting isolated Convex at ${backendUrl}; state stays in ${state}`);
    const child = spawn(binary, ["--interface", "127.0.0.1", "--port", String(backendPort), "--site-proxy-port", String(backendPort + 1), "--instance-name", instance.name, "--instance-secret", instance.secret, "--local-storage", join(state, "storage"), "--disable-beacon", join(state, "backend.sqlite3")], { env: childEnv, stdio: "inherit" });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
    child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
    child.on("exit", (code) => process.exit(code ?? 1));
  } else if (command === "configure") {
    const env = localBackendEnv();
    const setupPath = join(state, "setup.json");
    let values;
    if (existsSync(setupPath)) values = JSON.parse(readFileSync(setupPath, "utf8"));
    else {
      const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      values = {
        JWT_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString().trimEnd().replace(/\n/g, " "),
        JWKS: JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...publicKey.export({ format: "jwk" }) }] }),
        CLIMBOS_SERVER_SECRET: randomBytes(32).toString("hex"),
        CLIMBOS_ENCRYPTION_KEY: randomBytes(32).toString("base64"), CLIMBOS_ENCRYPTION_KEY_ID: `local-${profile}`,
      };
      saveJson("setup.json", values);
    }
    const configuration = { ...values, SITE_URL: webUrl, CUSTOM_AUTH_SITE_URL: webUrl, CLIMBOS_ENGINE: "v2", OPS_EMAILS: real ? "owner@local.climbos" : "tester@example.com", CLIMBOS_ENABLE_DEV_LOGIN: "true", CLIMBOS_LOCAL_REAL_RESEARCH: real ? "true" : "false" };
    for (const [key, value] of Object.entries(configuration)) {
      try { execFileSync(process.execPath, [convexCli, "env", "set", "--env-file", envFile, key], { cwd: repo, env, input: value, stdio: "pipe" }); }
      catch { throw new Error(`Could not configure ${key} on the isolated backend. Check that pnpm local:demo backend is running.`); }
    }
    saveJson("web.json", { NEXT_PUBLIC_CONVEX_URL: backendUrl, NEXT_PUBLIC_CONVEX_SITE_URL: siteUrl, NEXT_PUBLIC_SITE_URL: webUrl, NEXT_PUBLIC_POSTHOG_KEY: "", NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true", CLIMBOS_SERVER_SECRET: values.CLIMBOS_SERVER_SECRET });
    console.log(real ? "Configured an empty local workspace for real research. No demo rows or provider keys added; capped evaluation runs separately." : "Configured local sign-in, encryption and fixture engine. No paid provider credentials configured.");
  } else if (command === "sync") {
    run([convexCli, "dev", "--env-file", envFile, "--once", "--typecheck", "disable"], localBackendEnv());
  } else {
    localBackendEnv();
    const configPath = join(state, "web.json");
    if (!existsSync(configPath)) throw new Error("Run pnpm local:demo configure first.");
    const web = JSON.parse(readFileSync(configPath, "utf8"));
    if (web.NEXT_PUBLIC_CONVEX_URL !== backendUrl || web.NEXT_PUBLIC_CONVEX_SITE_URL !== siteUrl || web.NEXT_PUBLIC_SITE_URL !== webUrl) throw new Error("Refusing nonlocal demo configuration.");
    // Only the generated local values can override the cleared environment.
    const env = { ...childEnv };
    for (const key of ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CONVEX_SITE_URL", "NEXT_PUBLIC_SITE_URL", "CLIMBOS_SERVER_SECRET"]) env[key] = web[key];
    Object.assign(env, { NEXT_PUBLIC_POSTHOG_KEY: "", NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true" });
    run([join(repo, "node_modules/next/dist/bin/next"), ...(command === "build" ? ["build"] : ["dev", "--hostname", "127.0.0.1", "--port", String(webPort)])], env);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
