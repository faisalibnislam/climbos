import { describe, expect, it } from "vitest";
import { redactFeedback } from "../../shared/lab/redact";

describe("engine lab redaction", () => {
  it("removes names, sites, links, contacts and figures", () => {
    const out = redactFeedback("Formkit's plan claims 21,000 users at $9; see https://formkit.app/pricing, email jo@formkit.app or @formkitapp, call +1 (555) 123-4567. Competitor tally.so is cheaper.", ["Formkit", "https://formkit.app"]);
    expect(out).not.toMatch(/formkit|21,000|\$9|jo@|555|tally/i);
    expect(out).toContain("[business]");
  });
  it("keeps numbers in rules when asked", () => {
    expect(redactFeedback("Use at most 3 channels", [], { keepNumbers: true })).toBe("Use at most 3 channels");
  });
});
