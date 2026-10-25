import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequestComposer } from "@/components/ui/request-composer";

describe("shared request composer accessibility", () => {
  it("exposes starter suggestions as a named group and connects help to the input", () => {
    const markup = renderToStaticMarkup(createElement(RequestComposer, {
      label: "What would you like help with?",
      value: "",
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      placeholder: "Describe what you need",
      helper: "Use your own words.",
      suggestions: ["Help me get more customers"],
    }));

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Suggestions to help you start"');
    expect(markup).toContain("Help me get more customers");
    expect(markup).toMatch(/<textarea[^>]+aria-describedby="[^\"]+-help"/);
    expect(markup).toContain('aria-busy="false"');
  });
});
