import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Convex environment setup", () => {
  it("syncs the active OpenAI, Gemini, connector, and encryption keys", () => {
    const directory = mkdtempSync(join(tmpdir(), "climbos-env-sync-"));
    const bin = join(directory, "bin");
    const capture = join(directory, "commands.txt");
    const envFile = join(directory, ".env.test");
    mkdirSync(bin);
    const fakeNpx = join(bin, "npx");
    writeFileSync(fakeNpx, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CLIMBOS_TEST_CAPTURE"\n');
    chmodSync(fakeNpx, 0o755);
    writeFileSync(envFile, [
      "OPENAI_API_KEY=test-openai-key",
      "GEMINI_API_KEY=test-gemini-key",
      "CLIMBOS_ENCRYPTION_KEY=test-encryption-key",
      "CLIMBOS_ENCRYPTION_KEY_ID=test-key-id",
      "LINKEDIN_CLIENT_ID=test-linkedin-id",
      "X_CLIENT_SECRET=test-x-secret",
      "ANTHROPIC_API_KEY=retired-test-key",
    ].join("\n"));

    try {
      execFileSync(process.execPath, [resolve("scripts/env-sync.mjs"), "--file", envFile], {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, CLIMBOS_TEST_CAPTURE: capture },
        stdio: "pipe",
      });
      const commands = readFileSync(capture, "utf8");
      expect(commands).toContain("convex env set OPENAI_API_KEY -- test-openai-key");
      expect(commands).toContain("convex env set GEMINI_API_KEY -- test-gemini-key");
      expect(commands).toContain("convex env set CLIMBOS_ENCRYPTION_KEY -- test-encryption-key");
      expect(commands).toContain("convex env set LINKEDIN_CLIENT_ID -- test-linkedin-id");
      expect(commands).toContain("convex env set X_CLIENT_SECRET -- test-x-secret");
      expect(commands).not.toContain("ANTHROPIC_API_KEY");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }

    const setupCheck = readFileSync(resolve("scripts/setup-check.ts"), "utf8");
    const envTemplate = readFileSync(resolve(".env.example"), "utf8");
    expect(setupCheck).toContain('keys: ["OPENAI_API_KEY"]');
    expect(setupCheck).toContain('keys: ["GEMINI_API_KEY"]');
    expect(envTemplate).toContain("OPENAI_API_KEY=");
    expect(envTemplate).not.toContain("ANTHROPIC_API_KEY=");
  });
});
