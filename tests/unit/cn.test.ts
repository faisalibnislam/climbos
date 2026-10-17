import { describe, expect, it } from "vitest";
import { cn } from "../../src/lib/utils";

describe("cn (tailwind-merge with the design-system scale)", () => {
  it("keeps colour and custom font sizes together", () => {
    expect(cn("text-white", "text-ui")).toBe("text-white text-ui");
    expect(cn("text-ink-3", "text-2xs")).toBe("text-ink-3 text-2xs");
    expect(cn("text-white h-9 text-ui", "text-sm")).toBe("text-white h-9 text-sm");
  });
  it("still resolves real conflicts", () => {
    expect(cn("text-ui", "text-sm")).toBe("text-sm");
    expect(cn("text-ink", "text-white")).toBe("text-white");
    expect(cn("heading-card", "heading-section")).toBe("heading-section");
  });
});
