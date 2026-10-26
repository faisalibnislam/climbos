import { describe, expect, it } from "vitest";
import { publicReplyPrivacyIssue } from "../../shared/reviews/replyPrivacy";

describe("public review reply privacy guard", () => {
  it("holds back drafts with contact details or order references", () => {
    expect(publicReplyPrivacyIssue("Sorry, Sam. Email me at sam.owner@example.com and we'll fix it.")).toMatch(/email/);
    expect(publicReplyPrivacyIssue("Call us on +1 (415) 555-0134 any time.")).toMatch(/phone/);
    expect(publicReplyPrivacyIssue("We've looked into order #48213 and found the problem.")).toMatch(/order/);
    expect(publicReplyPrivacyIssue("Your booking ref: AB-9921 is refunded.")).toMatch(/order/);
  });

  it("holds back drafts that repeat the customer's private feedback", () => {
    const privateNote = "The therapist was late and my shoulder still hurts after the session last Tuesday.";
    expect(publicReplyPrivacyIssue("Thanks, Jo. We're sorry your shoulder still hurts after the session last Tuesday.", [privateNote])).toMatch(/private feedback/);
  });

  it("allows a normal specific reply", () => {
    expect(publicReplyPrivacyIssue("Thank you, Jo. We're glad the new evening slots worked for you, and we'll pass your kind words to the team.", ["The parking was hard to find."])).toBeNull();
    expect(publicReplyPrivacyIssue("Thanks for visiting in 2026. See you soon.")).toBeNull();
  });
});
