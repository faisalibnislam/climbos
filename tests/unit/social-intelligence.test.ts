import { describe, expect, it } from "vitest";
import { lintEmbeddedUrls, researchFor, socialCalendarSpec, socialSpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";
import { planJob } from "../../convex/lib/jobPlans";
import { socialToArtifacts } from "../../convex/jobWrites";

describe("social intelligence routing", () => {
  it("loads the shared business-fit playbook for post writing and review", () => {
    const spec = socialSpec(["linkedin", "instagram"]);
    expect(spec.skills).toContain("social-intelligence");
    expect(spec.criticSkills).toContain("social-intelligence");
  });

  it("researches current trend signals for only the requested platforms", () => {
    const research = researchFor("social_posts", { businessName: "Northstar SaaS", platforms: ["linkedin"] });
    expect(research).toMatchObject({ maxSearches: 3, maxFetches: 3 });
    expect(research?.brief).toContain("linkedin");
    expect(research?.brief).toContain("Do not call an undated signal current");
  });

  it("warns when an allowed copy link was not actually opened in the run", () => {
    const input: AgentInput = {
      task: "Write a LinkedIn post",
      brief: "A business",
      facts: [],
      businessWebsite: "https://example.com",
      availableSourceUrls: ["https://example.com/"],
      ownerSuppliedUrls: ["https://partner.example/join"],
    };
    const issues = lintEmbeddedUrls([
      { path: "posts[0].body", text: "See https://example.com/pricing for details." },
      { path: "posts[1].body", text: "Apply at https://partner.example/join." },
      { path: "posts[2].body", text: "Read https://unapproved.example/offer." },
    ], input);
    expect(issues.filter((issue) => issue.rule === "unverified_copy_link")).toHaveLength(2);
    expect(issues.find((issue) => issue.rule === "unverified_copy_link")?.severity).toBe("warn");
    expect(issues.find((issue) => issue.rule === "copy_link")?.severity).toBe("error");

    const checked = lintEmbeddedUrls([{ path: "posts[0].body", text: "See https://example.com/ for details." }], input);
    expect(checked).toEqual([]);
  });

  it("includes social trend research in the upfront v2 cost reservation", () => {
    const previous = process.env.CLIMBOS_ENGINE;
    process.env.CLIMBOS_ENGINE = "v2";
    try {
      const posts = planJob("content_social", { quantity: 2, images: 0, channel: "linkedin" });
      const calendar = planJob("social_calendar");
      expect(posts.meters.searchCalls).toBe(3);
      expect(posts.steps[0]).toMatchObject({ kind: "model", webSearches: 3 });
      expect(calendar.meters.searchCalls).toBe(3);
      expect(calendar.steps[0]).toMatchObject({ kind: "model", webSearches: 3 });
    } finally {
      if (previous === undefined) delete process.env.CLIMBOS_ENGINE;
      else process.env.CLIMBOS_ENGINE = previous;
    }
  });

  it("rejects a calendar trend citation that was not supplied by this run", () => {
    const spec = socialCalendarSpec({ instagram: 1 });
    const input: AgentInput = {
      task: "Plan one social post",
      brief: "A local business",
      facts: [],
      availableSourceUrls: ["https://trends.example/current"],
    };
    const output = {
      weekTheme: "Useful ideas",
      pillars: [],
      slots: [{
        channel: "instagram",
        day: 1,
        pillar: "Teach",
        purpose: "teach" as const,
        format: "text" as const,
        idea: "Adapt a current trend to explain the customer problem.",
        angle: "A current trend meets a real customer job",
        hookDraft: "A meme can explain this process",
        proof: "none needed",
        callToAction: "Save the checklist",
        needsOwner: false,
        ownerNote: "Trend freshness: dated today. Source: https://unverified.example/trend",
      }],
      learningsApplied: [],
    };

    const issues = spec.lint?.(output, input) ?? [];
    expect(issues.some((issue) => issue.rule === "citation" && issue.path?.includes("ownerNote"))).toBe(true);
  });

  it("requires current-trend evidence and warns when cross-platform copy is reused", () => {
    const spec = socialSpec(["linkedin", "instagram"]);
    const input: AgentInput = { task: "Write social posts", brief: "A business", facts: [], availableSourceUrls: [] };
    const copyBrief = {
      reader: "operators", situation: "planning", awarenessStage: "unknown", relationshipStage: "unknown", objective: "teach",
      offerFactIndexes: [], problemJob: "understand a decision", trigger: "planning", centralIdea: "A useful decision guide",
      objection: "none known", proofFactIndexes: [], prohibitedClaims: [], channel: "social", format: "text", deliveryContext: "organic",
      brandVoice: "clear", approvedExamples: [], cta: "Think about this", afterAction: "none", trackingMetric: "unknown",
      trackingMethod: "unknown", supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [],
    };
    const sharedDraft = "A useful checklist helps teams compare options before committing to a new approach.";
    const output = {
      copyBrief,
      posts: ["linkedin", "instagram"].map((channel) => ({
        channel, title: "A current trend for teams", body: sharedDraft, hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 1,
        angle: "Compare options before commitment", format: "text", hook: "A useful checklist for the decision", slides: [], videoScript: "", visualBrief: "", firstComment: "",
      })),
    };
    const issues = spec.lint?.(output as never, input) ?? [];
    expect(issues.some((issue) => issue.rule === "trend_source" && issue.path === "posts[0].trendSourceUrl")).toBe(true);
    expect(issues.some((issue) => issue.rule === "platform_adaptation" && issue.path === "posts[1].body")).toBe(true);

    const sourceUrl = "https://trends.example/current";
    const citedInput: AgentInput = { ...input, availableSourceUrls: [sourceUrl] };
    const citedOutput = {
      ...output,
      copyBrief: { ...copyBrief, supportingSourceUrls: [sourceUrl] },
      posts: output.posts.map((post) => ({ ...post, trendSourceUrl: sourceUrl })),
    };
    const citedIssues = spec.lint?.(citedOutput as never, citedInput) ?? [];
    expect(citedIssues.some((issue) => issue.rule === "trend_source" || issue.rule === "citation")).toBe(false);
    expect(socialToArtifacts(citedOutput as never, 1).map((artifact) => artifact.copyBrief?.supportingSourceUrls)).toEqual([
      [sourceUrl], [sourceUrl],
    ]);

    const mismatchedOutput = {
      ...citedOutput,
      posts: citedOutput.posts.map((post) => ({ ...post, trendSourceUrl: "https://other.example/trend" })),
    };
    expect((spec.lint?.(mismatchedOutput as never, citedInput) ?? []).some((issue) => issue.rule === "citation")).toBe(true);
  });

  it("warns on a mismatched channel when single-channel publishing binds the final artifact to the selected channel", () => {
    const spec = socialSpec(["facebook"]);
    const input: AgentInput = { task: "Write one Facebook post", brief: "A business", facts: [] };
    const copyBrief = {
      reader: "operators", situation: "planning", awarenessStage: "unknown", relationshipStage: "unknown", objective: "teach",
      offerFactIndexes: [], problemJob: "understand a decision", trigger: "planning", centralIdea: "A useful decision guide",
      objection: "none known", proofFactIndexes: [], prohibitedClaims: [], channel: "social", format: "text", deliveryContext: "organic",
      brandVoice: "clear", approvedExamples: [], cta: "Think about this", afterAction: "none", trackingMetric: "unknown",
      trackingMethod: "unknown", supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [],
    };
    const output = {
      copyBrief,
      posts: [{ channel: "instagram", title: "A useful idea", body: "A short useful idea for the audience.", hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 1, angle: "Make the next step clearer", format: "text", hook: "A useful idea", slides: [], videoScript: "", visualBrief: "", firstComment: "" }],
    };
    const issue = (spec.lint?.(output as never, input) ?? []).find((entry) => entry.rule === "unexpected_channel");
    expect(issue?.severity).toBe("warn");
  });
});
