import { describe, expect, it } from "vitest";
import { eventMayTrigger } from "../../shared/agents/specialistEvents";
import { triggerSummary } from "../../src/components/app/settings/SpecialistTrigger";

const now = Date.UTC(2026, 9, 25);
const agent = { status: "active", trigger: "event", triggerEvents: ["deal.won"], eventCooldownHours: 24 };

describe("specialist event triggers", () => {
  it("starts only for an active event specialist listening for that event and past its cooldown", () => {
    expect(eventMayTrigger(agent, "deal.won", now)).toBe(true);
    expect(eventMayTrigger(agent, "lead.created", now)).toBe(false);
    expect(eventMayTrigger({ ...agent, lastEventRunAt: now - 23 * 3_600_000 }, "deal.won", now)).toBe(false);
    expect(eventMayTrigger({ ...agent, lastEventRunAt: now - 25 * 3_600_000 }, "deal.won", now)).toBe(true);
    expect(eventMayTrigger({ ...agent, status: "archived" }, "deal.won", now)).toBe(false);
    expect(eventMayTrigger({ ...agent, trigger: "daily" }, "deal.won", now)).toBe(false);
  });

  it("describes when a specialist runs", () => {
    expect(triggerSummary({ trigger: "manual" })).toBe("Runs when you ask");
    expect(triggerSummary({ trigger: "weekly" })).toBe("Runs weekly");
    expect(triggerSummary({ trigger: "event", triggerEvents: ["deal.won"], eventCooldownHours: 72 })).toBe("Runs after: a deal moved to won (at most once every 72 hours)");
  });
});
