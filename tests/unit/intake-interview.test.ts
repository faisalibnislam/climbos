import { describe, expect, it } from "vitest";
import { acknowledgeWebsite, briefForPlan, shortOwnerReply, interviewGaps, mergeEvidence, ownerPlanningInputs, profileFromJson, type IntakeField, type IntakeProfile } from "../../shared/intake/interview";

const owner = { id: "owner-1", kind: "owner" as const, text: "I want more customers. My website is https://sample.example. We sell handmade leather belts to cyclists. We are pre-launch. Paid subscriptions. I have two hours a week, and I don't know my budget." };
const field = (key: IntakeField["key"], value: string, quote: string): IntakeField => ({ key, value, quote, basis: "owner", sourceId: owner.id });

describe("a discovery interview must understand the business before planning", () => {
  it("retains a direct website answer even when the model omits it from extracted updates", () => {
    const profile = acknowledgeWebsite({}, [{ id: "ask", role: "assistant", text: "Could you share your website address?" }, { id: "answer", role: "user", text: "https://sample.example" }]);
    expect(profile.website).toEqual({ key: "website", value: "https://sample.example/", basis: "owner", sourceId: "answer", quote: "https://sample.example" });
    expect(mergeEvidence(profile, [{ key: "offer", value: "Handmade cycling belts", basis: "website", sourceId: "https://sample.example/", quote: "Handmade cycling belts" }], [{ id: "https://sample.example/", kind: "website", text: "Handmade cycling belts", url: "https://sample.example/" }]).profile.offer?.value).toBe("Handmade cycling belts");
    expect(acknowledgeWebsite({}, [{ id: "answer", role: "user", text: "My website is sample.example." }]).website?.value).toBe("https://sample.example/");
  });
  it("does not adopt a competitor reference or unsafe URL as the owner's website", () => {
    for (const text of ["My competitor is https://competitor.example", "I like the example https://competitor.example", "https://127.0.0.1", "My website is http://localhost"]) expect(acknowledgeWebsite({}, [{ id: "a", role: "assistant", text: "What is your website?" }, { id: "b", role: "user", text }]).website).toBeUndefined();
  });
  it("does not resurrect a website after the owner has said they no longer have it", () => {
    const website = { key: "website" as const, value: "none", basis: "owner" as const, sourceId: "new", quote: "I no longer have a website" };
    expect(acknowledgeWebsite({ website }, [{ id: "old", role: "user", text: "https://sample.example" }, { id: "new", role: "user", text: website.quote }]).website).toEqual(website);
  });
  it("does not confuse a name and wish with an adequate business brief", () => {
    const profile = mergeEvidence({}, [field("name", "Sample", "sample.example"), field("goal", "I want more customers.", "I want more customers.")], [owner]).profile;
    expect(interviewGaps(profile)).toEqual(expect.arrayContaining(["your website, or whether you have one", "what the business offers", "who the business helps"]));
  });
  it("learns public details from the right website and preserves owner-reported private facts", () => {
    const website = { id: "https://sample.example/", url: "https://sample.example/", kind: "website" as const, text: "Handmade leather cycling belts. For everyday bicycle commuters. One-time purchase." };
    const result = mergeEvidence({}, [field("website", "https://sample.example", "https://sample.example"), { key: "offer", value: "Handmade leather cycling belts", basis: "website", sourceId: website.id, quote: "Handmade leather cycling belts." }, { key: "audience", value: "Everyday bicycle commuters", basis: "website", sourceId: website.id, quote: "For everyday bicycle commuters." }, field("goal", "More customers", "I want more customers."), field("businessModel", "Paid subscriptions", "Paid subscriptions."), field("stage", "pre-launch", "We are pre-launch."), { ...field("resources", "Budget not decided; two hours a week", "I have two hours a week, and I don't know my budget."), basis: "unknown" }], [owner, website]);
    expect(result.rejected).toEqual([]);
    expect(interviewGaps(result.profile)).toEqual([]);
    expect(result.profile.offer?.basis).toBe("website");
    expect(result.profile.resources?.basis).toBe("unknown");
  });
  it("rejects fabricated quotes, private facts inferred from marketing copy, and new numbers", () => {
    const site = { id: "https://sample.example/", url: "https://sample.example/", kind: "website" as const, text: "Trusted by businesses everywhere." };
    const result = mergeEvidence({}, [field("offer", "Something invented", "This sentence isn't in the evidence"), { key: "stage", value: "Has 500 customers", basis: "website", sourceId: site.id, quote: site.text }, field("resources", "$1000 budget", "I don't know my budget")], [owner, site]);
    expect(result.rejected).toEqual(["offer", "stage", "resources"]);
    expect(result.profile).toEqual({});
  });
  it("does not populate the business offer from a competitor's website or override an owner's correction", () => {
    const profile: IntakeProfile = { website: field("website", "https://sample.example/", "https://sample.example"), offer: field("offer", "Handmade leather belts", "We sell handmade leather belts") };
    const competitor = { id: "https://competitor.example/", url: "https://competitor.example/", kind: "website" as const, text: "We offer consulting for large companies." };
    const result = mergeEvidence(profile, [{ key: "audience", value: "Large companies", basis: "website", sourceId: competitor.id, quote: competitor.text }, { key: "offer", value: "Consulting for large companies", basis: "website", sourceId: competitor.id, quote: competitor.text }], [competitor]);
    expect(result.rejected).toEqual(["audience", "offer"]);
    expect(result.profile.offer).toEqual(profile.offer);
  });
  it("rejects private URLs and accepts an explicit lack of a website without inventing one", () => {
    const evidence = { ...owner, text: "We have no website. http://127.0.0.1:3330 is my local test." };
    expect(mergeEvidence({}, [field("website", "http://127.0.0.1:3330", "http://127.0.0.1:3330")], [evidence]).rejected).toEqual(["website"]);
    expect(mergeEvidence({}, [field("website", "None", "We have no website.")], [evidence]).profile.website?.value).toBe("none");
    expect(profileFromJson("not-json")).toEqual({});
  });
  it("uses explicit owner time and ad limits without inventing revenue or converting currencies", () => {
    const resources = field("resources", "Two hours a week and $500 on ads", "I have two hours a week. My ad budget is $500 a month.");
    expect(ownerPlanningInputs({ resources }, "USD")).toEqual({ ownerHoursPerWeek: 2, monthlyAdBudget: 500 });
    expect(ownerPlanningInputs({ resources: { ...resources, basis: "website" } }, "USD")).toEqual({});
    expect(ownerPlanningInputs({ resources: { ...resources, basis: "unknown" } }, "USD")).toEqual({});
    expect(ownerPlanningInputs({ resources: { ...resources, quote: "I can't spend two hours per week." } }, "USD")).toEqual({});
    expect(ownerPlanningInputs({ resources: { ...resources, quote: "My ad budget is £500 a month." } }, "USD")).toEqual({});
  });
});

it("starts planning from sourced business context without demanding private stage or time", () => {
  const profile: IntakeProfile = {
    goal: field("goal", "More visitors", "I want more customers."),
    website: field("website", "https://sample.example/", "https://sample.example"),
    offer: field("offer", "Cycling belts", "We sell handmade leather belts"),
    audience: { ...field("audience", "Bicycle commuters", "cyclists"), basis: "inferred" },
    businessModel: field("businessModel", "One-time purchases", "Paid subscriptions."),
  };
  expect(interviewGaps(profile)).toEqual([]);
  expect(JSON.parse(briefForPlan(profile, [])).unknowns).toEqual(["stage", "resources", "currentApproach"]);
  expect(ownerPlanningInputs(profile, "USD")).toEqual({});
  expect(interviewGaps({ ...profile, audience: { ...profile.audience!, value: "Everyone" } })).toContain("who the business helps");
});
it("removes repeated summaries while preserving essential questions and source limitations", () => {
  expect(shortOwnerReply("Great start: Macloving wants more website visitors. What is your website address, so I can read it?")) .toBe("What is your website address, so I can read it?");
  expect(shortOwnerReply("Got it. I couldn’t read your site. What does your business sell?")) .toBe("I couldn’t read your site. What does your business sell?");
  expect(shortOwnerReply("Thank you, " + "A word. ".repeat(40)).split(/\s+/).length).toBeLessThanOrEqual(30);
});
