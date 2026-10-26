import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const brand = ["air", "ly"].join("");

describe("public ClimbOS product copy", () => {
  it("keeps owner-facing product docs free of the former studio name", async () => {
    const docs = await Promise.all([
      readFile("docs/Capabilities.md", "utf8"),
      readFile("docs/ClimbOS-Simple-UX-Codex-Prompt.md", "utf8"),
    ]);

    for (const content of docs) {
      expect(content.toLowerCase()).not.toContain(brand);
    }
  });

  it("keeps every app and shared source string free of the former studio name, apart from internal module identifiers", async () => {
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (/\.(tsx?|md)$/.test(entry.name)) files.push(path);
      }
    };
    await walk("src");
    await walk("shared");
    // Internal Convex module and table names are deferred for a migration (docs/growth-engine/spec-coverage.md gap 17).
    const internal = new RegExp(`\\b(?:api\\.)?${brand}(?:Actions|Links)?\\b(?=[.:"'/])|shared/${brand}|\\.\\./${brand}`, "gi");
    const word = new RegExp(`\\b${brand}\\b`, "i");
    const offenders: string[] = [];
    for (const file of files) {
      const text = (await readFile(file, "utf8")).replace(internal, "");
      if (word.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});