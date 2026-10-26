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
    expect(research?.brief).toContain("do not call an undated signal current");
    expect(research?.brief).toContain("TREND SIGNAL 1");
    expect(research?.brief).toContain("Observed date:");
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
        angle: "Compare options before commitment", format: "text", hook: "A useful checklist for the decision", slides: [], videoScript: "", shotList: [], visualBrief: "", firstComment: "",
      })),
    };
    const issues = spec.lint?.(output as never, input) ?? [];
    expect(issues.some((issue) => issue.rule === "trend_source" && issue.path === "posts[0].trendSourceUrl")).toBe(true);
    expect(issues.some((issue) => issue.rule === "platform_adaptation" && issue.path === "posts[1].body")).toBe(true);

    const sourceUrl = "https://trends.example/current";
    const trendNotes = [
      "TREND SIGNAL 1",
      "Platform: Instagram",
      "Market: unknown",
      "Observed date: 2026-10-20",
      `Source URL: ${sourceUrl}`,
      "Observed signal: A creator trend uses short before-and-after clips.",
      "Fit idea: Explain a useful before-and-after decision.",
    ].join("\n");
    const citedInput: AgentInput = {
      ...input,
      availableSourceUrls: [sourceUrl],
      precomputedResearch: { notes: trendNotes, sources: [{ url: sourceUrl }], retrievedAt: Date.parse("2026-10-25T12:00:00.000Z") },
    };
    const citedOutput = {
      ...output,
      copyBrief: { ...copyBrief, supportingSourceUrls: [sourceUrl] },
      posts: output.posts.map((post) => ({
        ...post,
        trendSourceUrl: sourceUrl,
        trendEvidence: { sourceUrl, observationDate: "2026-10-20", observation: "A creator trend uses short before-and-after clips." },
      })),
    };
    const citedIssues = spec.lint?.(citedOutput as never, citedInput) ?? [];
    expect(citedIssues.some((issue) => issue.rule === "trend_source" || issue.rule === "citation")).toBe(false);
    const artifacts = socialToArtifacts(citedOutput as never, 1);
    expect(artifacts.map((artifact) => artifact.copyBrief?.supportingSourceUrls)).toEqual([[sourceUrl], [sourceUrl]]);
    expect(artifacts[0]?.copyBrief?.trendEvidence).toEqual({
      sourceUrl,
      observationDate: "2026-10-20",
      observation: "A creator trend uses short before-and-after clips.",
    });

    const mismatchedOutput = {
      ...citedOutput,
      posts: citedOutput.posts.map((post) => ({ ...post, trendSourceUrl: "https://other.example/trend" })),
    };
    expect((spec.lint?.(mismatchedOutput as never, citedInput) ?? []).some((issue) => issue.rule === "citation")).toBe(true);
  });

  it("requires a current trend date and observation tied to the same research record", () => {
    const spec = socialSpec(["instagram"]);
    const sourceUrl = "https://trends.example/current";
    const notes = [
      "TREND SIGNAL 1",
      "Platform: Instagram",
      "Market: unknown",
      "Observed date: 2026-10-20",
      `Source URL: ${sourceUrl}`,
      "Observed signal: Creators are using a short progress-reveal format.",
      "Fit idea: Show one practical step before the reveal.",
    ].join("\n");
    const input: AgentInput = {
      task: "Write a current trend post",
      brief: "A business",
      facts: [],
      precomputedResearch: { notes, sources: [{ url: sourceUrl }], retrievedAt: Date.parse("2026-10-25T12:00:00.000Z") },
    };
    const copyBrief = {
      reader: "customers", situation: "planning", awarenessStage: "unknown", relationshipStage: "unknown", objective: "teach",
      offerFactIndexes: [], problemJob: "understand a choice", trigger: "planning", centralIdea: "A useful reveal", objection: "none known",
      proofFactIndexes: [], prohibitedClaims: [], channel: "social", format: "text", deliveryContext: "organic", brandVoice: "clear",
      approvedExamples: [], cta: "Save the steps", afterAction: "none", trackingMetric: "unknown", trackingMethod: "unknown",
      supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [],
    };
    const post = {
      channel: "instagram", title: "A current trend worth trying", body: "A practical way to show the progress before the reveal.",
      hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 1, angle: "Show the work behind a result", format: "text",
      hook: "A current trend can clarify the steps", slides: [], videoScript: "", shotList: [], visualBrief: "", firstComment: "", trendSourceUrl: sourceUrl,
      trendEvidence: { sourceUrl, observationDate: "2026-10-20", observation: "Creators are using a short progress-reveal format." },
    };
    const good = spec.lint?.({ copyBrief, posts: [post] } as never, input) ?? [];
    expect(good.filter((issue) => issue.rule === "trend_evidence")).toEqual([]);

    const missingDate = spec.lint?.({ copyBrief, posts: [{ ...post, trendEvidence: undefined }] } as never, input) ?? [];
    expect(missingDate.some((issue) => issue.rule === "trend_evidence")).toBe(true);
    const wrongObservation = spec.lint?.({ copyBrief, posts: [{ ...post, trendEvidence: { ...post.trendEvidence, observation: "Another source claim not present in the notes." } }] } as never, input) ?? [];
    expect(wrongObservation.some((issue) => issue.rule === "trend_evidence")).toBe(true);
    const wrongUrl = spec.lint?.({ copyBrief, posts: [{ ...post, trendEvidence: { ...post.trendEvidence, sourceUrl: "https://other.example/signal" } }] } as never, input) ?? [];
    expect(wrongUrl.some((issue) => issue.rule === "trend_evidence")).toBe(true);
    const staleInput: AgentInput = { ...input, precomputedResearch: { ...input.precomputedResearch!, retrievedAt: Date.parse("2026-12-01T12:00:00.000Z") } };
    expect((spec.lint?.({ copyBrief, posts: [post] } as never, staleInput) ?? []).some((issue) => issue.rule === "trend_evidence")).toBe(true);
    const undatedResearch: AgentInput = { ...input, precomputedResearch: { notes, sources: [{ url: sourceUrl }] } };
    expect((spec.lint?.({ copyBrief, posts: [post] } as never, undatedResearch) ?? []).some((issue) => issue.rule === "trend_evidence")).toBe(true);
    const future = { ...post, trendEvidence: { ...post.trendEvidence, observationDate: "2026-10-26" } };
    const futureInput: AgentInput = { ...input, precomputedResearch: { ...input.precomputedResearch!, notes: notes.replace("2026-10-20", "2026-10-26") } };
    expect((spec.lint?.({ copyBrief, posts: [future] } as never, futureInput) ?? []).some((issue) => issue.rule === "trend_evidence")).toBe(true);
  });

  it("checks titles, hooks, and image alt text against confirmed claim evidence", () => {
    const spec = socialSpec(["instagram"]);
    const input: AgentInput = { task: "Write an Instagram post", brief: "A business", facts: [], constraints: { factKinds: [] } };
    const copyBrief = {
      reader: "customers", situation: "choosing a provider", awarenessStage: "unknown", relationshipStage: "unknown", objective: "teach",
      offerFactIndexes: [], problemJob: "understand a choice", trigger: "planning", centralIdea: "A useful guide", objection: "none known",
      proofFactIndexes: [], prohibitedClaims: [], channel: "social", format: "image", deliveryContext: "organic", brandVoice: "clear",
      approvedExamples: [], cta: "Save this guide", afterAction: "none", trackingMetric: "unknown", trackingMethod: "unknown",
      supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [],
    };
    const output = {
      copyBrief,
      posts: [{
        channel: "instagram", title: "The #1 platform for local shops", hook: "Support 24/7 by chat", body: "A useful guide for comparing services and asking better questions.",
        hashtags: [], altText: "Award-winning customer support poster", imageIdea: "A simple comparison card", factIndexes: [], suggestedDay: 1,
        angle: "Compare before choosing", format: "image", slides: [], videoScript: "", shotList: [], visualBrief: "A clear, readable comparison card", firstComment: "",
      }],
    };

    const claims = (spec.lint?.(output as never, input) ?? []).filter((issue) => issue.rule === "unsupported_claim");
    expect(claims.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "posts[0].title", "posts[0].hook", "posts[0].altText",
    ]));
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
      posts: [{ channel: "instagram", title: "A useful idea", body: "A short useful idea for the audience.", hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 1, angle: "Make the next step clearer", format: "text", hook: "A useful idea", slides: [], videoScript: "", shotList: [], visualBrief: "", firstComment: "" }],
    };
    const issue = (spec.lint?.(output as never, input) ?? []).find((entry) => entry.rule === "unexpected_channel");
    expect(issue?.severity).toBe("warn");
  });
});
