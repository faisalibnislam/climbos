import { describe, expect, it } from "vitest";
import { lintCopyBrief, lintDistinctAngles, lintRepeatedCopyPieces, type CopyBrief } from "../../shared/agents/specs";
import { contentHash } from "../../shared/policy";

describe("copy angle quality checks", () => {
  it("accepts concise, distinct angle choices", () => {
    expect(lintDistinctAngles([
      { path: "posts[0].angle", angle: "The late invoice that delays Friday payroll" },
      { path: "posts[1].angle", angle: "What a new customer needs before booking" },
      { path: "posts[2].angle", angle: "Why the owner stopped chasing missing details" },
    ])).toEqual([]);
  });

  it("warns when two pieces use nearly identical angle words", () => {
    expect(lintDistinctAngles([
      { path: "emails[0].angle", angle: "Owners save time by automating intake forms" },
      { path: "emails[1].angle", angle: "Automating intake forms saves time for owners" },
    ])).toMatchObject([{ severity: "warn", rule: "repeated_angle", path: "emails[1].angle" }]);
  });

  it("requires one short, nonempty idea", () => {
    expect(lintDistinctAngles([{ path: "posts[0].angle", angle: "   " }])).toMatchObject([{ severity: "error", rule: "copy_angle" }]);
    expect(lintDistinctAngles([{ path: "posts[0].angle", angle: "A very long sentence that contains multiple different reader situations and several angles all bundled together" }])).toMatchObject([{ severity: "error", rule: "copy_angle" }]);
  });

  it("binds the saved angle to the artifact version hash", async () => {
    const draft = { body: "The same approved copy.", hashtags: [], channel: "email" };
    const first = await contentHash({ ...draft, contentAngle: "Show the setup mechanism" });
    const changed = await contentHash({ ...draft, contentAngle: "Answer the setup objection" });
    expect(changed).not.toBe(first);
  });

  it("flags a rephrased proposition across a content set", () => {
    expect(lintRepeatedCopyPieces([
      { path: "posts[0]", text: "Owners save bookkeeping time by automating payment reminders and intake forms." },
      { path: "posts[1]", text: "Automate intake forms and payment reminders to save time on bookkeeping for owners." },
    ])).toMatchObject([{ severity: "warn", rule: "repeated_copy", path: "posts[1]" }]);
  });

  it("flags a repeated opening even when the rest of the copy differs", () => {
    expect(lintRepeatedCopyPieces([
      { path: "emails[0]", text: "Stop losing Fridays to invoices. This email explains the first step." },
      { path: "emails[1]", text: "Stop losing Fridays to invoices. Here is another way to handle the process." },
    ])).toMatchObject([{ severity: "warn", rule: "repeated_copy", path: "emails[1]" }]);
  });

  it("does not flag pieces with different propositions and openings", () => {
    expect(lintRepeatedCopyPieces([
      { path: "posts[0]", text: "Owners save bookkeeping time by automating payment reminders and intake forms." },
      { path: "posts[1]", text: "A clear service menu helps new customers understand which appointment to book." },
    ])).toEqual([]);
  });
});

const copyBrief: CopyBrief = {
  reader: "Local service owners",
  situation: "They need more qualified bookings",
  awarenessStage: "problem_aware",
  relationshipStage: "unknown",
  objective: "Request a consultation",
  offerFactIndexes: [0],
  problemJob: "Choose a trusted provider",
  trigger: "A current need",
  centralIdea: "Make the next step clear",
  objection: "Unknown",
  proofFactIndexes: [],
  prohibitedClaims: ["Guaranteed growth"],
  channel: "email",
  format: "three-email sequence",
  deliveryContext: "Consented subscribers",
  brandVoice: "Clear and practical",
  approvedExamples: [],
  cta: "Book a consultation",
  afterAction: "Review request",
  trackingMetric: "Consultation requests",
  trackingMethod: "Unknown",
  supportingFactIndexes: [],
  supportingSourceUrls: ["https://example.com/services"],
  unknowns: ["Consultation availability"],
};

describe("structured copy brief provenance", () => {
  it("accepts fact indexes and source URLs supplied to this run", () => {
    expect(lintCopyBrief(copyBrief, {
      task: "Draft email",
      brief: "",
      facts: ["Consultation is available"],
      availableSourceUrls: ["https://example.com/services"],
    })).toEqual([]);
  });

  it("rejects references to unavailable facts or pages", () => {
    expect(lintCopyBrief({ ...copyBrief, proofFactIndexes: [2], supportingSourceUrls: ["https://unknown.example/proof"] }, {
      task: "Draft email",
      brief: "",
      facts: ["Consultation is available"],
      availableSourceUrls: ["https://example.com/services"],
    })).toMatchObject([
      { severity: "error", rule: "fact_reference", path: "copyBrief.proofFactIndexes[0]" },
      { severity: "error", rule: "citation", path: "copyBrief.supportingSourceUrls[0]" },
    ]);
  });

  it("binds campaign context to the artifact approval hash", async () => {
    const draft = { body: "The same approved copy.", hashtags: [], channel: "email" };
    const first = await contentHash({ ...draft, copyBrief: { ...copyBrief, centralIdea: "Make the next step clear" } });
    const changed = await contentHash({ ...draft, copyBrief: { ...copyBrief, centralIdea: "Lead with customer proof" } });
    expect(changed).not.toBe(first);
  });
});
