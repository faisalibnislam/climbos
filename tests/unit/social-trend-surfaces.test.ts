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
