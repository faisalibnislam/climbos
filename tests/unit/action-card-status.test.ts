import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCardStatus, actionCardStartLabel, actionCardStatusExplanation, actionCardStatusLabel } from "@/components/app/ActionCardStatus";

describe("owner-facing action card status", () => {
  it("uses plain labels for each saved card state", () => {
    expect(actionCardStatusLabel("proposed", false)).toBe("Suggested");
    expect(actionCardStatusLabel("approved", false)).toBe("Approved");
    expect(actionCardStatusLabel("running", false)).toBe("In progress");
    expect(actionCardStatusLabel("done", false)).toBe("Completed");
    expect(actionCardStatusLabel("failed", false)).toBe("Couldn’t finish");
    expect(actionCardStatusLabel("blocked", false)).toBe("Needs setup");
    expect(actionCardStatusLabel("rejected", false)).toBe("Skipped");
  });

  it("makes clear that a prepared external-effect item is not live", () => {
    expect(actionCardStatusLabel("done", true)).toBe("Ready for review");
    expect(actionCardStatusExplanation("done", true)).toBe("Prepared for review. Nothing has gone live.");
    expect(actionCardStatusExplanation("done", false)).toBeNull();
    const markup = renderToStaticMarkup(createElement(ActionCardStatus, { status: "done", externalEffect: true }));
    expect(markup).toContain("Ready for review");
    expect(markup).toContain("Nothing has gone live");
  });

  it("names the action that the button actually starts", () => {
    expect(actionCardStartLabel("generate_content", true)).toBe("Prepare it");
    expect(actionCardStartLabel("generate_content", false)).toBe("Do it");
    expect(actionCardStartLabel("note", false)).toBe("Got it");
  });
});
