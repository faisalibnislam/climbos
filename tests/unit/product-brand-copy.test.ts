import { readFile } from "node:fs/promises";
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
});
