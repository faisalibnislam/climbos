import { describe, expect, it } from "vitest";
import { capabilityContext } from "../../shared/agents/capacity";

/** S5 (REQ-ENG-11): the planner is told what this workspace can run, not a static list. */
describe("capability context", () => {
  it("without connections, nothing is promised as sending or publishing", () => {
    const t = capabilityContext({ connected: [], autonomy: "review" });
    expect(t).toMatch(/SENDING NEEDS SETUP/);
    expect(t).toMatch(/NO channel is connected/);
    expect(t).toMatch(/no ad account is connected/);
    expect(t).not.toMatch(/publishes directly to/);
    expect(t).toMatch(/Approval mode: Review/);
  });

  it("names only the channels actually connected, and the approval mode", () => {
    const t = capabilityContext({ connected: ["email_mailbox", "linkedin", "google_ads"], autonomy: "copilot" });
    expect(t).toMatch(/outreach: READY/);
    expect(t).toMatch(/publishes directly to LinkedIn \(connected\)/);
    expect(t).not.toMatch(/Instagram/);
    expect(t).toMatch(/Google connected/);
    expect(t).toMatch(/Copilot/);
  });

  it("never frames engines as free of owner time", () => {
    expect(capabilityContext({ connected: [], autonomy: "bounded_autopilot" })).toMatch(/still need the owner's time/);
  });
});

it("does not turn software capacity or historical rates into business evidence", () => {
  const text = capabilityContext({ connected: ["email_mailbox"], autonomy: "review" });
  expect(text).not.toContain("$300");
  expect(text).not.toContain("1–3%");
  expect(text).not.toContain("10–20%");
  expect(text).not.toContain("50 emails/day");
  expect(text).toContain("there is no universal customer-value cutoff");
  expect(text).toContain("Never multiply an agency's clients into paid licenses");
});
