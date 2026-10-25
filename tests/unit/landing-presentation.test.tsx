import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingPresentation } from "@/components/app/landing/LandingPresentation";
import type { LandingContent } from "../../shared/landing";

const content: LandingContent = {
  headline: "A clearer first step",
  subhead: "Help your team decide what to do next.",
  benefits: [{ title: "Useful", text: "A specific benefit." }],
  steps: ["Tell us what you need"],
  proof: "Proof supplied by the owner.",
  faq: [{ q: "How does it work?", a: "We explain the next step." }],
  ctaLabel: "Get started",
  formIntro: "Share a little context.",
};

describe("LandingPresentation", () => {
  it("uses the shared responsive page structure and keeps preview actions inert", () => {
    const markup = renderToStaticMarkup(createElement(LandingPresentation, {
      name: "Example Business",
      color: "#2255aa",
      content,
      website: "https://example.com",
      badge: true,
      preview: true,
      form: createElement("div", null, "Example form"),
    }));

    expect(markup).toContain("@container");
    expect(markup).toContain("@sm:grid-cols-2");
    expect(markup).toContain("A clearer first step");
    expect(markup).toContain("Example form");
    expect(markup).toContain("example.com");
    expect(markup).not.toContain("href=\"#start\"");
    expect(markup).not.toContain("href=\"https://example.com\"");
    expect(markup).not.toContain("id=\"start\"");
  });

  it("keeps the public call to action, contact link, and lead form anchor", () => {
    const markup = renderToStaticMarkup(createElement(LandingPresentation, {
      name: "Example Business",
      color: "#2255aa",
      content,
      website: "https://example.com",
      badge: true,
      form: createElement("form", null, "Live form"),
    }));

    expect(markup.match(/href=\"#start\"/g)).toHaveLength(2);
    expect(markup).toContain("id=\"start\"");
    expect(markup).toContain("href=\"https://example.com\"");
    expect(markup).toContain("Live form");
  });
});
