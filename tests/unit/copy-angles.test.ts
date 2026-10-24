import { describe, expect, it } from "vitest";
import { lintDistinctAngles, lintRepeatedCopyPieces } from "../../shared/agents/specs";
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
