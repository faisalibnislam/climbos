import { expect, it } from "vitest";
import { socialSpec } from "../../shared/agents/specs";
import { currentTrendResearch, socialTrendFixture } from "../fixtures/socialTrend";

const reference = "Adapt this current viral format to explain the review.";
const changes = [
  { slides: [{ heading: "A current meme", body: "Show the work" }] },
  { slides: [{ heading: "Show the work", body: reference }] },
  { videoScript: reference }, { firstComment: reference }, { altText: reference },
  { visualBrief: reference }, { imageIdea: reference }, { shotList: [{ timing: "0–3s", show: reference }] },
  { hashtags: ["trending"] },
];

it.each(changes)("requires evidence when the trend appears only in %j", change => {
  const output = socialTrendFixture();
  Object.assign(output.posts[0], change);
  const lint = socialSpec(["linkedin"]).lint!;
  expect(lint(output, { task: "Draft a post", brief: "A studio", facts: [] }).some(issue => issue.rule === "trend_evidence")).toBe(true);
  const { evidence, research } = currentTrendResearch();
  output.posts[0].trendSourceUrl = evidence.sourceUrl;
  output.posts[0].trendEvidence = evidence;
  expect(lint(output, { task: "Draft a post", brief: "A studio", facts: [], precomputedResearch: research }).filter(issue => ["trend_evidence", "trend_source"].includes(issue.rule))).toEqual([]);
});

it("keeps original evergreen creative directions available without trend evidence", () => {
  const output = socialTrendFixture();
  output.posts[0].visualBrief = "An original absurdist character investigates unanswered project questions. Test whether the audience understands the idea.";
  expect(socialSpec(["linkedin"]).lint!(output, { task: "Draft a post", brief: "A studio", facts: [] }).filter(issue => ["trend_evidence", "trend_source"].includes(issue.rule))).toEqual([]);
});

it.each([
  "Don't chase viral trends. Explain the customer's actual problem.",
  "Do not use memes. Show an original diagram instead.",
  "Avoid meme images; photograph the real process.",
  "No viral gimmicks. Make the buying decision clearer.",
  "Never copy unlicensed memes. Use original illustrations.",
  "Stop chasing viral trends and answer a real customer question.",
  "Without memes, the diagram can still be distinctive.",
])("allows explicit generic trend exclusions: %s", text => {
  const output = socialTrendFixture();
  output.posts[0].visualBrief = text;
  expect(socialSpec(["linkedin"]).lint!(output, { task: "Draft", brief: "A studio", facts: [] }).filter(issue => ["trend_evidence", "trend_source"].includes(issue.rule))).toEqual([]);
});

it.each([
  "Don't chase viral trends. Adapt this current meme instead.",
  "No viral gimmicks, but use this trending format.",
  "Don't miss this viral trend.",
  "No one should miss this current meme.",
  "Without copying this viral meme, adapt its structure.",
  "Avoid this current viral format.",
  "Follow current trends to frame the demonstration.",
])("still requires evidence for an actual reference: %s", text => {
  const output = socialTrendFixture();
  output.posts[0].visualBrief = text;
  expect(socialSpec(["linkedin"]).lint!(output, { task: "Draft", brief: "A studio", facts: [] }).some(issue => issue.rule === "trend_evidence")).toBe(true);
});

it("does not let one field's negation exempt another field or explicit evidence", () => {
  const output = socialTrendFixture();
  output.posts[0].title = "No";
  output.posts[0].hook = "viral trends worth adapting";
  const lint = () => socialSpec(["linkedin"]).lint!(output, { task: "Draft", brief: "A studio", facts: [] });
  expect(lint().some(issue => issue.rule === "trend_evidence")).toBe(true);
  output.posts[0].hook = "No viral gimmicks";
  output.posts[0].trendEvidence = currentTrendResearch().evidence;
  expect(lint().some(issue => issue.rule === "trend_evidence")).toBe(true);
});
