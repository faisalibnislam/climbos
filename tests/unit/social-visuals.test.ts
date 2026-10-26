import { describe, expect, it } from "vitest";
import { lintPostVisual, socialSpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";
import { postVisualOf, socialToArtifacts } from "../../convex/jobWrites";
import { maxJobMicros, planJob } from "../../convex/lib/jobPlans";

const input: AgentInput = { task: "Write a LinkedIn post", brief: "Formkit lists its Free plan at $0 with unlimited forms.", facts: ["Formkit's Free plan is $0."], availableSourceUrls: [] };
const brief = "A real photo of an event check-in desk with a printed RSVP form, shot from above in window light. No text on the image.";
const rules = (p: Parameters<typeof lintPostVisual>[0]) => lintPostVisual(p, input, "posts[0]").map((issue) => issue.rule);

describe("social post visuals", () => {
  it("requires a concrete visual brief on every post, text posts included", () => {
    expect(rules({ channel: "linkedin", format: "text", visualBrief: "" })).toContain("visual");
    expect(lintPostVisual({ channel: "linkedin", format: "text", visualBrief: "" }, input, "posts[0]")[0]?.message).toContain("Text posts still need a visual suggestion");
    expect(rules({ channel: "linkedin", format: "text", visualBrief: brief })).toEqual([]);
    expect(rules({ channel: "linkedin", format: "single_image", visualBrief: brief })).toEqual([]);
  });

  it("keeps LinkedIn to text, single image, document or short video", () => {
    expect(rules({ channel: "linkedin", format: "carousel", visualBrief: brief })).toContain("visual_format");
    expect(rules({ channel: "linkedin", format: "story", visualBrief: brief })).toContain("visual_format");
    expect(rules({ channel: "linkedin", format: "document", visualBrief: brief })).toEqual([]);
    expect(rules({ channel: "instagram", format: "carousel", visualBrief: brief })).toEqual([]);
  });

  it("asks for a phone-filmable shot list on short video", () => {
    expect(rules({ channel: "linkedin", format: "reel", visualBrief: brief, shotList: [] })).toContain("missing");
    const shots = [
      { timing: "0-3s", show: "Close-up of a hand ticking a name on the RSVP list." },
      { timing: "3-10s", show: "Screen recording of building the form in the editor." },
      { timing: "10-20s", show: "Owner at the desk explaining the first question to ask." },
    ];
    expect(rules({ channel: "linkedin", format: "reel", visualBrief: brief, shotList: shots })).toEqual([]);
  });

  it("never puts an unconfirmed number on the visual, but allows frame specs", () => {
    expect(rules({ channel: "linkedin", format: "single_image", visualBrief: `${brief} Headline card: "Join 5,000 organisers".` })).toContain("invented_fact");
    expect(rules({ channel: "linkedin", format: "single_image", visualBrief: `${brief} Portrait 1080x1350, 4:5 crop. Card shows "$0 Free plan".` })).toEqual([]);
  });

  it("runs the visual rule as part of the social spec lint", () => {
    const spec = socialSpec(["linkedin"]);
    const post = { channel: "linkedin", title: "RSVP", body: "Body", hashtags: [], altText: "", imageIdea: "", factIndexes: [], suggestedDay: 1, angle: "Test one real event form", format: "text", hook: "Start with one RSVP form", slides: [], videoScript: "", shotList: [], visualBrief: "", firstComment: "" };
    const copyBrief = {
      reader: "event organisers", situation: "planning RSVPs", awarenessStage: "unknown", relationshipStage: "unknown", objective: "teach",
      offerFactIndexes: [], problemJob: "collect attendee details", trigger: "a new event", centralIdea: "Test one real form",
      objection: "none known", proofFactIndexes: [], prohibitedClaims: [], channel: "linkedin", format: "text", deliveryContext: "organic",
      brandVoice: "clear", approvedExamples: [], cta: "Try one form", afterAction: "none", trackingMetric: "unknown",
      trackingMethod: "unknown", supportingFactIndexes: [], supportingSourceUrls: [], unknowns: [],
    };
    const issues = spec.lint?.({ copyBrief, posts: [post] } as never, input) ?? [];
    expect(issues.some((issue) => issue.rule === "visual" && issue.path === "posts[0].visualBrief")).toBe(true);
  });

  it("keeps the suggested visual when saving a draft, and reads old image ideas as a single image", () => {
    expect(postVisualOf({ imageIdea: "A desk with an RSVP form" })).toEqual({ format: "single_image", brief: "A desk with an RSVP form" });
    expect(postVisualOf({ format: "text", visualBrief: "", imageIdea: "" })).toBeUndefined();
    const slides = [{ heading: "Start with one event", body: "" }, { heading: "Collect three details", body: "Name, email, dietary needs" }, { heading: "Check the editor", body: "" }];
    expect(postVisualOf({ format: "document", visualBrief: brief, slides, videoScript: "ignored", shotList: [{ timing: "0-3s", show: "x" }] })).toEqual({ format: "document", brief, slides });
    expect(postVisualOf({ format: "reel", visualBrief: brief, slides, videoScript: "Say hi", shotList: [{ timing: "0-3s", show: "Desk" }] })).toEqual({ format: "reel", brief, videoScript: "Say hi", shotList: [{ timing: "0-3s", show: "Desk" }] });

    const [item] = socialToArtifacts({ posts: [{ channel: "linkedin", title: "RSVP", body: "Body", hashtags: [], altText: "Desk", imageIdea: "", factIndexes: [], suggestedDay: 1, format: "single_image", visualBrief: brief }] }, 0);
    expect(item?.visual).toEqual({ format: "single_image", brief });
  });

  it("prices creating one post image with its two tries as the up-to maximum", () => {
    const plan = planJob("post_image", {});
    expect(plan.steps).toEqual([{ kind: "image", role: "creative_director", imageAttempts: 2 }]);
    expect(maxJobMicros(plan)).toBeGreaterThan(0);
  });
});
