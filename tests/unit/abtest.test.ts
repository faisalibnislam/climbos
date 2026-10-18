import { describe, expect, it } from "vitest";
import { decide, variantFor } from "../../shared/abtest";

describe("A/B decisions", () => {
  it("needs enough data and 95% confidence", () => {
    expect(decide([{ key: "A", trials: 20, wins: 1 }, { key: "B", trials: 20, wins: 8 }], 100, 3000).done).toBe(false);
    const d = decide([{ key: "A", trials: 150, wins: 3 }, { key: "B", trials: 150, wins: 18 }], 100, 3000);
    expect(d).toMatchObject({ done: true, winner: "B" });
    expect(d.confidence).toBeGreaterThanOrEqual(95);
    const tie = decide([{ key: "A", trials: 1500, wins: 30 }, { key: "B", trials: 1500, wins: 31 }], 100, 3000);
    expect(tie).toMatchObject({ done: true, winner: "A" });
  });
  it("splits recipients stably and roughly in half", () => {
    expect(variantFor("abc")).toBe(variantFor("abc"));
    const ids = Array.from({ length: 1000 }, (_, i) => `prospect_${i}_x`);
    const b = ids.filter((id) => variantFor(id) === "B").length;
    expect(b).toBeGreaterThan(400);
    expect(b).toBeLessThan(600);
  });
});
