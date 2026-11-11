import { expect, it } from "vitest";
import { StepWorkOutput, normalizeStepWork, salvageStepWork, validateStepWork } from "../../shared/agents/stepWork";
import { asksOwnerForStrategy, shortOwnerReply } from "../../shared/intake/interview";
import { usefulStepResult } from "../fixtures/stepWork";
it("requires usable preparation instead of another checklist", () => {
  expect(StepWorkOutput.safeParse({ ...usefulStepResult, drafts: [] }).success).toBe(false);
  expect(StepWorkOutput.safeParse(usefulStepResult).success).toBe(true);
});
it("rejects invented citations, contacts and private links", () => {
  const output = { ...usefulStepResult, drafts: [{ ...usefulStepResult.drafts[0], body: "Contact invented@example.com using http://127.0.0.1/private. " + usefulStepResult.drafts[0].body }], evidence: [{ url: "https://other.example/", quote: "A fabricated source statement", claim: "This has been verified" }] };
  expect(validateStepWork(output, [], "")).toHaveLength(3);
});
it("keeps the question concise and rejects asking owners to choose acquisition channels", () => {
  const long = "Thanks, that gives us a clear and very helpful picture of what the whole business does and how the range of products fits together for everyone. ".repeat(5) + "How much time can you spare each week?";
  expect(shortOwnerReply(long).split(/\s+/).length).toBeLessThanOrEqual(45);
  expect(shortOwnerReply(long)).toContain("How much time can you spare each week?");
  expect(asksOwnerForStrategy("Which channel do you think your visitors will find you through first?")).toBe(true);
  expect(asksOwnerForStrategy("Which kind of problem do you think a typical visitor arrives with most often?")).toBe(true);
  expect(asksOwnerForStrategy("How much time can you spare each week?")).toBe(false);
});
it("blocks pitches to a recipient whose retrieved page explicitly refuses them", () => {
  const output = { ...usefulStepResult, drafts: [{ title: "Pitch to MacMost", kind: "email" as const, body: "Hi MacMost, please review our product. " + usefulStepResult.drafts[0].body }] };
  expect(validateStepWork(output, [{ url: "https://macmost.com/contact", text: "We do not accept free products for review.", status: "ok", fetchedAt: Date.now() }], "")).toContainEqual(expect.stringContaining("refuses product outreach"));
});
it("does not pause private preparation for sending permission or delegate creator research", () => {
  const output = { ...usefulStepResult, ownerQuestion: { text: "Is it acceptable to send this as a collaboration request?", choices: ["Yes", "No"] }, ownerTasks: ["Find more educators and check contact rules"] };
  expect(validateStepWork(output, [], "")).toEqual(expect.arrayContaining([expect.stringContaining("Only private preparation"), expect.stringContaining("Do not delegate research")]));
});
it("does not hand public contact-route and link checks back to the owner", () => {
  for (const task of ["Open the candidates' own sites and log each stated contact route and date", "Open the public kit link and confirm it loads"]) expect(validateStepWork({ ...usefulStepResult, ownerTasks: [task] }, [], "")).toContainEqual(expect.stringContaining("Read public pages"));
});
it("prepares search wording without delegating keyword-tool research or inventing demand", () => {
  const output = { ...usefulStepResult, ownerTasks: ["Check search wording in a keyword tool you have access to"] };
  expect(validateStepWork(output, [], "")).toContainEqual(expect.stringContaining("Choose useful search wording"));
  expect(validateStepWork({ ...output, ownerTasks: ["Look up three title phrasings in a keyword tool you have access to"] }, [], "")).toContainEqual(expect.stringContaining("Choose useful search wording"));
  expect(salvageStepWork(output, [], "")?.ownerTasks).toEqual([]);
  const independent = { ...output, ownerTasks: ["Test the actual app on sample files before recording"] };
  expect(validateStepWork(independent, [], "")).toEqual([]);
});

it("keeps individually usable drafts while holding back unsupported links and strategy questions", () => {
  const mixed = { ...usefulStepResult, drafts: [...usefulStepResult.drafts, { ...usefulStepResult.drafts[0], body: usefulStepResult.drafts[0].body + " See https://invented.example/" }], evidence: [{ url: "https://invented.example/", quote: "Unsupported statement", claim: "An invented claim" }], ownerQuestion: { text: "Which channel should we choose?", choices: [] }, ownerTasks: ["Find relevant creators and write their pitch"] };
  const result = salvageStepWork(mixed, [], "");
  expect(result?.drafts).toEqual(usefulStepResult.drafts);
  expect(result?.evidence).toEqual([]);
  expect(result?.ownerTasks).toEqual([]);
  expect(result?.ownerQuestion).toBeNull();
  expect(result?.limitations?.length).toBeGreaterThan(0);
  expect(validateStepWork(result!, [], "")).toEqual([]);
  expect(salvageStepWork({ ...mixed, drafts: [mixed.drafts.at(-1)!] }, [], "")).toBeNull();
});

it("rejects placeholder destinations and public homework handed back to the owner", () => {
  const output = { ...usefulStepResult, drafts: [{ ...usefulStepResult.drafts[0], body: usefulStepResult.drafts[0].body + " https://business.example/GUIDE-ADDRESS" }], ownerTasks: ["Open the Diet Image app page yourself", "Read the community self-promotion rules before posting"] };
  const issues = validateStepWork(output, [], "https://business.example/GUIDE-ADDRESS");
  expect(issues).toContainEqual(expect.stringContaining("Replace placeholder destinations"));
  expect(issues).toContainEqual(expect.stringContaining("Read public pages"));
});

it("keeps tracking and held-placement notes out of copyable social text", () => {
  const copy = "Large photos can be slow to share. Choose what happens to your originals before reducing them. Read the actual app details: https://business.example/apps/file-slim";
  const output = { ...usefulStepResult, drafts: [{ title: "Owned post", kind: "social_post" as const, body: "TRACKING METHOD: a future guide URL is unknown.\n\nOWNED-CHANNEL POST (uses a real product link):\n\n" + copy + "\n\nHELD COMMUNITY PLACEMENT: rules could not be read." }] };
  const result = normalizeStepWork(output);
  expect(result.drafts[0].body).toBe(copy);
  expect(result.drafts[0].notes).toContain("rules could not be read");
  expect(result.drafts[0].notes).toContain("TRACKING METHOD");
  expect(normalizeStepWork(result)).toEqual(result);
});
