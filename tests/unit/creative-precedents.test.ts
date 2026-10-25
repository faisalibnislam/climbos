import { describe, expect, it } from "vitest";
import { CREATIVE_PRECEDENTS, creativePrecedentsForAgent, formatCreativePrecedents, retrieveCreativePrecedents } from "../../shared/knowledge/creativePrecedents";

describe("creative strategy precedent retrieval", () => {
  it("keeps the verified corpus honest and each case source-backed", () => {
    expect(CREATIVE_PRECEDENTS).toHaveLength(14);
    for (const precedent of CREATIVE_PRECEDENTS) {
      expect(precedent.sources.length).toBeGreaterThan(0);
      expect(precedent.sources.every((source) => /^https:\/\//.test(source.url) && source.supports.length > 10 && source.accessedAt && source.sourceRole && source.claimRole)).toBe(true);
      expect(precedent.causalLimit.length).toBeGreaterThan(30);
      expect(precedent.reversibleTest.length).toBeGreaterThan(20);
    }
  });

  it("retrieves a character-design mechanism across industries instead of matching industry names", () => {
    const matches = retrieveCreativePrecedents("small business distinctive mascot identity customer recall visual constraints");
    expect(matches[0]?.precedent.id).toBe("CP-004");
    expect(formatCreativePrecedents("small business distinctive mascot identity customer recall visual constraints")).toContain("Nintendo");
  });

  it("retrieves a product-prototyping mechanism from mechanism language", () => {
    expect(retrieveCreativePrecedents("prototype an unusual product feature with a small group of customers")[0]?.precedent.id).toBe("CP-003");
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
