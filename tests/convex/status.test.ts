import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { CHANGELOG } from "../../shared/changelog";
import { setup } from "./helpers";

describe("status page", () => {
  it("samples components and reports today plus 30 days", async () => {
    const t = setup();
    await t.mutation(internal.status.sample, {});
    const s = await t.query(api.status.overview, {});
    expect(s.components.map((c) => c.key)).toEqual(["app", "ai", "jobs", "email", "publishing", "billing"]);
    expect(s.components.every((c) => c.status === "ok")).toBe(true);
    expect(s.days).toHaveLength(30);
    expect(s.components[0].history[29]).toBe("ok");
  });
  it("changelog is newest first", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
