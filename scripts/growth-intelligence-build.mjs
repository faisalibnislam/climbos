import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libraryRoot = path.join(root, "docs/growth-intelligence");
const scenarioPath = path.join(root, "docs/growth-expansion/collections/scenarios/ClimbOS_1000_Problem_Solution_Library.md");
const persuasionPath = path.join(root, "docs/growth-expansion/collections/MARKETING_PSYCHOLOGY.md");
const manifest = JSON.parse(await readFile(path.join(libraryRoot, "manifest.json"), "utf8"));
const catalog = JSON.parse(await readFile(path.join(libraryRoot, "playbooks/catalog.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const records = [];

for (const book of manifest.books) {
  const markdown = await readFile(path.join(libraryRoot, book.path), "utf8");
  if (sha256(markdown) !== book.sha256) throw new Error(`Book hash mismatch: ${book.path}`);
  const chunks = markdown.split(/^(## .+)$/gmu);
  const sections = [{ heading: "Introduction", body: chunks[0] ?? "" }];
  for (let i = 1; i < chunks.length; i += 2) sections.push({ heading: (chunks[i] ?? "").replace(/^## /u, ""), body: chunks[i + 1] ?? "" });
  sections.forEach((section, index) => {
    const content = section.body.trim();
    if (!content || /^references(?: and further reading)?$/iu.test(section.heading)) return;
    records.push({
      id: `${book.id}:${index}:${sha256(content).slice(0, 12)}`,
      kind: "chapter",
      bookId: book.id,
      heading: section.heading,
      path: book.path,
      content,
      sha256: sha256(content),
    });
  });
}

for (const playbook of catalog.playbooks) {
  const content = await readFile(path.join(libraryRoot, playbook.path), "utf8");
  if (sha256(content) !== playbook.sha256) throw new Error(`Playbook hash mismatch: ${playbook.path}`);
  records.push({
    id: playbook.id,
    kind: "playbook",
    bookId: playbook.book,
    heading: playbook.id,
    path: playbook.path,
    content: content.trim(),
    sha256: playbook.sha256,
  });
}

// Parse the owner-supplied scenario catalog into separately labeled retrieval
// records. These are hypotheses, not validated rules or business evidence.
const scenarioMarkdown = await readFile(scenarioPath, "utf8");
const scenarioHash = sha256(scenarioMarkdown);
const archetypes = new Map();
for (const match of scenarioMarkdown.matchAll(/^### (\d{2})\. (.+?) — 50 problems$/gmu)) {
  archetypes.set(match[1], match[2]);
}
const scenarios = [];
for (const match of scenarioMarkdown.matchAll(/^\| (\d{2}-\d{2}) \| (.+?) \| (.+?) \|$/gmu)) {
  const [, id, problem, intervention] = match;
  const archetype = archetypes.get(id.slice(0, 2));
  if (!archetype) throw new Error(`Scenario ${id} has no archetype heading.`);
  const content = `Problem to diagnose: ${problem}\nPossible diagnostic and intervention (hypothesis): ${intervention}\nEvidence status: proposed scenario; not a validated production rule. Diagnose against this business's actual evidence before recommending a tactic.`;
  scenarios.push({
    id: `scenario:${id}`,
    kind: "scenario",
    bookId: "S1",
    businessType: archetype,
    evidenceClass: "proposed_scenario",
    heading: `${archetype}: ${problem}`,
    path: "docs/growth-expansion/collections/scenarios/ClimbOS_1000_Problem_Solution_Library.md",
    content,
    sha256: sha256(content),
  });
}
if (archetypes.size !== 20 || scenarios.length !== 1_000 || new Set(scenarios.map((item) => item.id)).size !== 1_000) {
  throw new Error(`Expected 20 archetypes and 1,000 unique scenarios; found ${archetypes.size} archetypes and ${scenarios.length} scenarios.`);
}
records.push(...scenarios);

const persuasionMarkdown = await readFile(persuasionPath, "utf8");
const persuasionHash = sha256(persuasionMarkdown);
const persuasionChunks = persuasionMarkdown.split(/^### (\d{2}) — (.+)$/gmu);
const principles = [];
for (let i = 1; i < persuasionChunks.length; i += 3) {
  const id = persuasionChunks[i];
  const title = persuasionChunks[i + 1];
  const content = (persuasionChunks[i + 2] ?? "").split(/^## Sources$/mu)[0].trim();
  principles.push({
    id: `principle:marketing:${id}`,
    kind: "principle",
    bookId: "M1",
    evidenceClass: "proposed_practice",
    heading: title,
    path: "docs/growth-expansion/collections/MARKETING_PSYCHOLOGY.md",
    content,
    sha256: sha256(content),
  });
}
if (principles.length !== 15 || new Set(principles.map((item) => item.id)).size !== 15) {
  throw new Error(`Expected 15 unique marketing psychology principles; found ${principles.length}.`);
}
records.push(...principles);

const output = path.join(root, "shared/knowledge/growthLibrary.generated.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ edition: manifest.edition, researchCutoff: manifest.research_cutoff, scenarioSourceSha256: scenarioHash, persuasionSourceSha256: persuasionHash, records }, null, 2)}\n`);
console.log(JSON.stringify({ books: manifest.books.length, playbooks: catalog.playbooks.length, scenarios: scenarios.length, principles: principles.length, records: records.length, scenarioSourceSha256: scenarioHash, persuasionSourceSha256: persuasionHash, output: path.relative(root, output) }));
