import { describe, expect, it } from "vitest";
import { CONSTRAINTS, CONSTRAINT_LABEL, DecisionSchema } from "../../shared/agents/decision";
import { playWorksOnConstraint } from "../../shared/agents/diagnosis";

describe("binding constraints (spec §3.1)", () => {
  it("covers price, trust, acquisition, repeat purchase, referral and cash with owner-facing labels", () => {
    for (const c of ["price", "trust", "acquisition", "repeat_purchase", "referral", "cash"] as const) {
      expect(CONSTRAINTS).toContain(c);
      expect(CONSTRAINT_LABEL[c].length).toBeGreaterThan(10);
    }
    expect(DecisionSchema.shape.constraint.safeParse("repeat_purchase").success).toBe(true);
  });

  it.each([
    ["trust", "Add three customer testimonials and a guarantee to the quote page", "Post a weekly reel"],
    ["referral", "Start a refer-a-friend reward for existing members", "Run search ads"],
    ["repeat_purchase", "Email first-time buyers a reorder reminder after 30 days", "Redesign the homepage headline"],
    ["cash", "Take a 30% deposit upfront on new bookings", "Post on Instagram"],
    ["price", "Test a higher price tier for rush jobs", "Ask for reviews"],
    ["acquisition", "Compare cost per lead across two outbound channels", "Add a loyalty card"],
  ] as const)("matches plays that work on %s", (constraint, fits, misses) => {
    expect(playWorksOnConstraint(fits, constraint)).toBe(true);
    expect(playWorksOnConstraint(misses, constraint)).toBe(false);
  });

  it("leaves the original constraints' matching unchanged", () => {
    expect(playWorksOnConstraint("Fix onboarding so new users reach first value", "activation")).toBe(true);
    expect(playWorksOnConstraint("Post a weekly reel", "demand")).toBe(false);
  });
});
