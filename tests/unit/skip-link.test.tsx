import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkipLink } from "@shared/a11y/SkipLink";

describe("SkipLink", () => {
  it("links keyboard users to the focusable main content target", () => {
    const link = renderToStaticMarkup(createElement(SkipLink));
    const main = renderToStaticMarkup(createElement("main", { id: "main", tabIndex: -1 }));

    expect(link).toContain('class="skip-link"');
    expect(link).toContain('href="#main"');
    expect(link).toContain("Skip to main content");
    expect(main).toContain('id="main"');
    expect(main).toContain('tabindex="-1"');
  });

  it("supports an explicitly named destination", () => {
    const markup = renderToStaticMarkup(createElement(SkipLink, { targetId: "editor" }, "Skip to editor"));
    expect(markup).toContain('href="#editor"');
    expect(markup).toContain("Skip to editor");
  });
});
