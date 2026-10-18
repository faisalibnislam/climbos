import { describe, expect, it } from "vitest";

describe("published email finder", () => {
  it("keeps only same-domain emails a site publishes, drops do-not-contact boxes and ranks person > role > support", async () => {
    const { publishedEmails } = await import("../../shared/outbound");
    const pages = [
      { url: "https://acme.com/", text: "Write to hello@acme.com or support@acme.com. Sentry: abc@sentry.io <img src='logo@2x.png'>" },
      { url: "https://acme.com/team", text: "Jane Doe — jane.doe@acme.com · noreply@acme.com · privacy@acme.com · sales [at] acme [dot] com" },
    ];
    const found = publishedEmails(pages, "acme.com");
    expect(found.map((f) => f.email)).toEqual(["jane.doe@acme.com", "hello@acme.com", "sales@acme.com", "support@acme.com"]);
    expect(found[0]).toMatchObject({ kind: "person", url: "https://acme.com/team" });
  });
});
