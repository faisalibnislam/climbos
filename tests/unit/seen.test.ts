import { afterEach, describe, expect, it, vi } from "vitest";
import { firstViewToday } from "../../src/lib/seen";

describe("firstViewToday (public page view dedupe)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts a visitor once a day per page", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const t0 = Date.UTC(2026, 9, 20, 9);
    expect(firstViewToday("p:offer", t0)).toBe(true);
    expect(firstViewToday("p:offer", t0 + 60_000)).toBe(false);
    expect(firstViewToday("p:other", t0 + 60_000)).toBe(true);
    expect(firstViewToday("p:offer", t0 + 25 * 3_600_000)).toBe(true);
  });

  it("still counts when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    });
    expect(firstViewToday("bio:x")).toBe(true);
  });
});
