import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("isolated demo refuses other deployments before invoking a CLI", () => {
  it.each(["https://hosted.example", "http://localhost.attacker.example:3320", "http://127.0.0.1:9999"])("refuses %s", (backend) => {
    const state = mkdtempSync(join(tmpdir(), "climbos-isolation-"));
    try {
      writeFileSync(join(state, "backend.env"), `CONVEX_SELF_HOSTED_URL=${backend}\nCONVEX_SELF_HOSTED_ADMIN_KEY=synthetic-admin-key\n`);
      const child = spawnSync(process.execPath, [resolve("scripts/local-demo.mjs"), "sync"], { encoding: "utf8", env: { ...process.env, CLIMBOS_LOCAL_STATE_DIR: state, OPENAI_API_KEY: "synthetic-do-not-log" }, timeout: 5000 });
      expect(child.status).toBe(1);
      expect(child.stderr).toContain("Refusing a backend.env");
      expect(child.stderr).not.toContain("synthetic-admin-key");
      expect(child.stderr).not.toContain("synthetic-do-not-log");
    } finally { rmSync(state, { recursive: true, force: true }); }
  });

  it("refuses a frontend pointed at a hosted backend even with a valid local admin file", () => {
    const state = mkdtempSync(join(tmpdir(), "climbos-isolation-"));
    try {
      writeFileSync(join(state, "backend.env"), "CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3320\nCONVEX_SELF_HOSTED_ADMIN_KEY=synthetic-admin-key\n");
      writeFileSync(join(state, "web.json"), JSON.stringify({ NEXT_PUBLIC_CONVEX_URL: "https://hosted.example", NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3321", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3420" }));
      const child = spawnSync(process.execPath, [resolve("scripts/local-demo.mjs"), "web"], { encoding: "utf8", env: { ...process.env, CLIMBOS_LOCAL_STATE_DIR: state }, timeout: 5000 });
      expect(child.status).toBe(1);
      expect(child.stderr).toContain("Refusing nonlocal demo configuration");
    } finally { rmSync(state, { recursive: true, force: true }); }
  });
});
