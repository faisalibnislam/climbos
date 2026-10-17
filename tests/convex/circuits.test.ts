import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { setup } from "./helpers";

/** Provider circuit: billing failures open it at once and alert operators once. */
describe("provider circuit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on an out-of-credit failure, alerts once, and closes on success", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: false, billing: true, reason: "The AI account is out of credit." });
    expect(await t.query(internal.circuits.circuitState, { provider: "anthropic" })).toBe("open");
    const fleet = async () => t.run(async (ctx) => (await ctx.db.query("fleetControls").first())!.circuits.find((c) => c.provider === "anthropic")!);
    const first = await fleet();
    expect(first.alertedAt).toBeTypeOf("number");
    expect(first.reason).toMatch(/credit/);

    // Still failing: no second alert while open.
    await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: false, billing: true });
    expect((await fleet()).alertedAt).toBe(first.alertedAt);

    await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: true });
    expect(await t.query(internal.circuits.circuitState, { provider: "anthropic" })).toBe("closed");
    // Re-opening within 6 hours does not alert again.
    await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: false, billing: true });
    expect((await fleet()).alertedAt).toBe(first.alertedAt);
  });

  it("needs repeated ordinary errors before opening", async () => {
    const t = setup();
    for (let i = 0; i < 4; i++) await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: false });
    expect(await t.query(internal.circuits.circuitState, { provider: "anthropic" })).toBe("closed");
    await t.mutation(internal.circuits.recordProviderResult, { provider: "anthropic", ok: false });
    expect(await t.query(internal.circuits.circuitState, { provider: "anthropic" })).toBe("open");
  });
});
