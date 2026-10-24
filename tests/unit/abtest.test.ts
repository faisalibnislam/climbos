import { describe, expect, it } from "vitest";
import { decide, variantFor } from "../../shared/abtest";

describe("A/B decisions", () => {
  it("reads once at the planned end: no early winner, then an exact or z test", () => {
    // Decision books (Kohavi Ch 2; Kochenderfer Ch 15): an early lead isn't a result.
    expect(decide([{ key: "A", trials: 20, wins: 1 }, { key: "B", trials: 20, wins: 8 }], 100, 3000).done).toBe(false);
    expect(decide([{ key: "A", trials: 150, wins: 3 }, { key: "B", trials: 150, wins: 18 }], 100, 3000)).toMatchObject({ done: false, winner: null, confidence: 0 });
    const d = decide([{ key: "A", trials: 1500, wins: 30 }, { key: "B", trials: 1500, wins: 75 }], 100, 3000);
    expect(d).toMatchObject({ done: true, winner: "B" });
    const tie = decide([{ key: "A", trials: 1500, wins: 30 }, { key: "B", trials: 1500, wins: 31 }], 100, 3000);
    expect(tie).toMatchObject({ done: true, winner: "A" });
  });
  it("a split that doesn't match 50/50 keeps the original whatever the rates say", () => {
    const d = decide([{ key: "A", trials: 1700, wins: 20 }, { key: "B", trials: 1300, wins: 60 }], 100, 3000);
    expect(d).toMatchObject({ done: true, validity: "invalid", winner: null, confidence: 0, lift: null });
    expect(d.note).toMatch(/Invalid test.*neither version can be called a winner.*original remains active/);
  });
  it("identical variants rarely produce a B winner (seeded simulation)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    let bWins = 0;
    for (let t = 0; t < 200; t++) {
      const stats = [{ key: "A", trials: 0, wins: 0 }, { key: "B", trials: 0, wins: 0 }];
      for (let i = 0; i < 600; i++) {
        const s = stats[i % 2];
        s.trials++;
        if (rnd() < 0.05) s.wins++;
      }
      if (decide(stats, 30, 600).winner === "B") bWins++;
    }
    expect(bWins / 200).toBeLessThan(0.06);
  });
  it("splits recipients stably and roughly in half", () => {
    expect(variantFor("abc")).toBe(variantFor("abc"));
    const ids = Array.from({ length: 1000 }, (_, i) => `prospect_${i}_x`);
    const b = ids.filter((id) => variantFor(id) === "B").length;
    expect(b).toBeGreaterThan(400);
    expect(b).toBeLessThan(600);
  });
});
