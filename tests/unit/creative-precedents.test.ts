import { describe, expect, it } from "vitest";
import { CREATIVE_PRECEDENTS, creativePrecedentsForAgent, formatCreativePrecedents, retrieveCreativePrecedents } from "../../shared/knowledge/creativePrecedents";

describe("creative strategy precedent retrieval", () => {
  it("keeps the verified corpus honest and each case source-backed", () => {
    expect(CREATIVE_PRECEDENTS).toHaveLength(24);
    for (const precedent of CREATIVE_PRECEDENTS) {
      expect(precedent.sources.length).toBeGreaterThan(0);
      expect(precedent.sources.every((source) => /^https:\/\//.test(source.url) && source.supports.length > 10 && source.accessedAt && source.sourceRole && source.claimRole)).toBe(true);
      expect(precedent.causalLimit.length).toBeGreaterThan(30);
      expect(precedent.reversibleTest.length).toBeGreaterThan(20);
    }
    const whopperDetour = CREATIVE_PRECEDENTS.find((precedent) => precedent.id === "CP-014");
    expect(whopperDetour?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.oneclub.org/awards/theoneshow/-award/33593/the-whopper-detour/", sourceRole: "creator_primary" }),
      expect.objectContaining({ url: "https://www.restaurantdive.com/news/burger-kings-whopper-detour-generated-15m-app-downloads/548249/", sourceRole: "independent_secondary" }),
    ]));
  });

  it("retrieves a character-design mechanism across industries instead of matching industry names", () => {
    const matches = retrieveCreativePrecedents("small business distinctive mascot identity customer recall visual constraints");
    expect(matches[0]?.precedent.id).toBe("CP-004");
    expect(formatCreativePrecedents("small business distinctive mascot identity customer recall visual constraints")).toContain("Nintendo");
  });

  it("retrieves a product-prototyping mechanism from mechanism language", () => {
    expect(retrieveCreativePrecedents("prototype an unusual product feature with a small group of customers")[0]?.precedent.id).toBe("CP-003");
  });

  it("retrieves a distribution redesign that pairs compact packaging with customer assembly", () => {
    expect(retrieveCreativePrecedents("Test compact packaging and customer assembly for bulky furniture to reduce shipping damage")[0]?.precedent.id).toBe("CP-017");
  });

  it("retrieves collaboration-led bottom-up adoption through its product mechanism", () => {
    const matches = retrieveCreativePrecedents("Help individual users invite coworkers by sharing content and collaborating on a work platform, enabling bottom-up adoption within organizations", 2);
    expect(matches.some(({ precedent }) => precedent.id === "CP-018")).toBe(true);
  });

  it("retrieves audience expansion through accessible shared product design", () => {
    expect(retrieveCreativePrecedents("Make an accessible product experience that helps non-users and families participate together").some(({ precedent }) => precedent.id === "CP-019")).toBe(true);
  });

  it("retrieves a product-integrated partnership across adjacent brands", () => {
    expect(retrieveCreativePrecedents("Redesign a familiar restaurant product format through a co-branding partnership", 3).some(({ precedent }) => precedent.id === "CP-020")).toBe(true);
  });

  it("retrieves a capacity-led invitation rollout without endorsing artificial scarcity", () => {
    expect(retrieveCreativePrecedents("Run a capacity-limited beta with an invitation loop and transparent onboarding").some(({ precedent }) => precedent.id === "CP-021")).toBe(true);
  });

  it("retrieves creator-centered participation without promising viral reach", () => {
    expect(retrieveCreativePrecedents("Recognize an authentic customer-created social moment and ask permission to collaborate with the creator").some(({ precedent }) => precedent.id === "CP-022")).toBe(true);
  });

  it("retrieves personalization as a product participation mechanism", () => {
    expect(retrieveCreativePrecedents("Personalize product packaging so customers can share a meaningful gift with friends").some(({ precedent }) => precedent.id === "CP-023")).toBe(true);
  });

  it("retrieves accountable service recovery without generalizing brand humor", () => {
    expect(retrieveCreativePrecedents("Respond to a real service failure with an accountable apology, clear remedy, and recovery plan").some(({ precedent }) => precedent.id === "CP-024")).toBe(true);
  });

  it("retrieves opt-in personalization and sharing as a separate customer mechanism", () => {
    expect(retrieveCreativePrecedents("Create a personalized, shareable annual recap using each customer's own product history")[0]?.precedent.id).toBe("CP-011");
  });

  it("retrieves circular resale from the product lifecycle and operations mechanism", () => {
    expect(retrieveCreativePrecedents("Test a buyback and resale route for durable products with inspection and reverse logistics")[0]?.precedent.id).toBe("CP-012");
  });

  it("retrieves a licensed audience partnership that changes the product experience", () => {
    expect(retrieveCreativePrecedents("Partner with a popular entertainment property to update a learning product for its audience")[0]?.precedent.id).toBe("CP-013");
  });

  it("retrieves a location-triggered offer as a distinct distribution mechanism", () => {
    expect(retrieveCreativePrecedents("Use a geofence near competitor locations to trigger a one-time offer in the mobile app")[0]?.precedent.id).toBe("CP-014");
    expect(retrieveCreativePrecedents("Create a useful travel guide that helps customers use our product category")[0]?.precedent.id).toBe("CP-015");
    expect(retrieveCreativePrecedents("Respond to customer criticism with a core recipe change, franchisee support, and candid advertising")[0]?.precedent.id).toBe("CP-016");
  });

  it("retrieves fan co-creation through its mechanism, without requiring the target to be a toy company", () => {
    expect(retrieveCreativePrecedents("invite customers to propose product improvements and review suggestions before production")[0]?.precedent.id).toBe("CP-005");
  });

  it("uses stated business context, service geography, and owner constraints to explain transfer relevance", () => {
    const matches = retrieveCreativePrecedents({
      task: "Explore an unconventional community ritual that invites local outdoor customers to participate instead of buying on a retail holiday",
      brief: "A small local service business in the United States has limited owner time and wants useful community participation.",
      facts: ["The owner says the service area is regional and the team has limited capacity."],
      industryBusinessTypeId: "local_services",
      constraints: { ownerHoursPerWeek: 4, monthlyAdBudgetUsd: 0, serviceArea: "United States regional", businessTypes: ["local_service"] },
    });
    expect(matches[0]?.precedent.id).toBe("CP-007");
    expect(matches[0]?.matchReasons.some((reason) => reason.startsWith("geography: united"))).toBe(true);
    expect(["audience/context:", "goal:", "constraint:", "scale:", "business model:"].every((prefix) => matches[0]?.matchReasons.some((reason) => reason.startsWith(prefix)))).toBe(true);
    expect(formatCreativePrecedents({
      task: "Explore community participation ritual",
      brief: "Local outdoor business, limited owner time, United States",
      facts: [],
      constraints: { serviceArea: "United States" },
    })).toContain("Why retrieved:");
  });

  it("does not force a weak analogy when customer and constraint evidence are absent", () => {
    expect(retrieveCreativePrecedents("")).toEqual([]);
    expect(formatCreativePrecedents("")).toContain("No sufficiently relevant sourced creative precedent");
  });

  it("does not retrieve a case from geography or sector overlap without a mechanism match", () => {
    expect(retrieveCreativePrecedents({ task: "Compare retail businesses in the United States", brief: "Outdoor retail, local retail stores.", facts: [], constraints: { serviceArea: "United States" } })).toEqual([]);
  });

  it("injects bounded precedents into every production growth-plays run", () => {
    const injected = creativePrecedentsForAgent("growth_plays", "Build a growth plan", "small business distinctive mascot identity customer recall visual constraints");
    expect(injected).toContain("Nintendo");
    expect(injected).toContain("precedent, not a forecast");
    expect(injected).not.toContain("Airbnb");
    expect(creativePrecedentsForAgent("social_posts", "Draft social captions", "small business mascot")).toBe("");
  });
});
