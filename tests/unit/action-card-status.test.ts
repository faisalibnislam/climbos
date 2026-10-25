import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCardStatus, actionCardSetupHref, actionCardStartLabel, actionCardStatusExplanation, actionCardStatusLabel } from "@/components/app/ActionCardStatus";

describe("owner-facing action card status", () => {
  it("uses plain labels for each saved card state", () => {
    expect(actionCardStatusLabel("proposed", false)).toBe("Suggested");
    expect(actionCardStatusLabel("approved", false)).toBe("Approved");
    expect(actionCardStatusLabel("running", false)).toBe("In progress");
    expect(actionCardStatusLabel("done", false, "generate_content")).toBe("Completed");
    expect(actionCardStatusLabel("failed", false)).toBe("Couldn’t finish");
    expect(actionCardStatusLabel("blocked", false)).toBe("Needs setup");
    expect(actionCardStatusLabel("rejected", false)).toBe("Skipped");
  });

  it("makes clear that a prepared external-effect item is not live", () => {
    expect(actionCardStatusLabel("done", true)).toBe("Ready for review");
    expect(actionCardStatusExplanation("done", true)).toBe("Prepared for review. Nothing has gone live.");
    expect(actionCardStatusExplanation("done", false, "generate_content")).toBeNull();
    const markup = renderToStaticMarkup(createElement(ActionCardStatus, { status: "done", externalEffect: true }));
    expect(markup).toContain("Ready for review");
    expect(markup).toContain("Nothing has gone live");
    expect(actionCardStatusLabel("done", false, "email_send")).toBe("Ready for review");
    expect(actionCardStatusExplanation("done", false, "ad_change")).toBe("Prepared for review. Nothing has gone live.");
    expect(actionCardStatusLabel("done", false, "future_action_kind")).toBe("Ready for review");
  });

  it("names the action that the button actually starts", () => {
    expect(actionCardStartLabel("generate_content", true)).toBe("Prepare it");
    expect(actionCardStartLabel("generate_content", false)).toBe("Do it");
    expect(actionCardStartLabel("schedule_content", false)).toBe("Prepare it");
    expect(actionCardStartLabel("note", false)).toBe("Got it");
  });

  it("routes setup cards to their real destinations without implying setup is complete", () => {
    expect(actionCardStartLabel("connect_account", false)).toBe("Connect account");
    expect(actionCardStartLabel("set_up_autopilot", false)).toBe("Review autopilot setup");
    expect(actionCardSetupHref("northstar", "connect_account")).toBe("/app/northstar/connections");
    expect(actionCardSetupHref("northstar", "set_up_autopilot")).toBe("/app/northstar/autopilot");
    expect(actionCardSetupHref("northstar", "generate_content")).toBeNull();
  });
});
