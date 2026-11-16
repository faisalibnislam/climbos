import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Explicit loopback-only imports. Never target a hosted or real-business deployment. */
export function localDemoFixtures(envFile: string | undefined) {
  async function cli(args: string[]) {
    if (!envFile) throw new Error("Provide the isolated local demo backend.env file");
    const lines = (await readFile(envFile, "utf8")).trim().split(/\r?\n/);
    if (lines.length !== 2 || lines[0] !== "CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3320" || !/^CONVEX_SELF_HOSTED_ADMIN_KEY=\S+$/.test(lines[1])) throw new Error("Fixtures require the dedicated loopback demo backend");
    const { stdout } = await execute(process.execPath, [resolve("node_modules/convex/bin/main.js"), ...args, "--env-file", envFile], {
      env: {
        NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        CONVEX_DEPLOYMENT: "", CONVEX_DEPLOY_KEY: "",
        CONVEX_SELF_HOSTED_URL: "http://127.0.0.1:3320",
        CONVEX_SELF_HOSTED_ADMIN_KEY: lines[1].slice("CONVEX_SELF_HOSTED_ADMIN_KEY=".length),
      },
      maxBuffer: 8 * 1024 * 1024, encoding: "utf8",
    });
    return stdout;
  }
  async function rows(table: string): Promise<Record<string, unknown>[]> {
    const output = await cli(["data", table, "--limit", "5000", "--format", "json"]);
    return output.trim() ? JSON.parse(output) : [];
  }
  async function append(table: string, values: Record<string, unknown>[]) {
    const temp = await mkdtemp(join(tmpdir(), "climbos-demo-e2e-"));
    try {
      const path = join(temp, "rows.json");
      await writeFile(path, JSON.stringify(values));
      await cli(["import", "--append", "--table", table, path]);
    } finally { await rm(temp, { recursive: true, force: true }); }
  }
  return { cli, rows, append };
}
