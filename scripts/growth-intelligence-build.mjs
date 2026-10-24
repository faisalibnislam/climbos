import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libraryRoot = path.join(root, "docs/growth-intelligence");
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

const output = path.join(root, "shared/knowledge/growthLibrary.generated.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ edition: manifest.edition, researchCutoff: manifest.research_cutoff, records }, null, 2)}\n`);
console.log(JSON.stringify({ books: manifest.books.length, playbooks: catalog.playbooks.length, records: records.length, output: path.relative(root, output) }));
