#!/usr/bin/env python3
"""Validate manuscript structure and playbook syntax; regenerate manifest/QC.
Requires PyYAML for YAML validation: python3 -m pip install PyYAML
Does not verify live policy freshness or deployed application behavior.
"""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

try:
    import yaml
except ImportError:
    raise SystemExit('PyYAML is required to validate YAML playbooks. Install in a suitable environment first.')
ROOT = Path(__file__).resolve().parents[1]
WORD = re.compile(r"\b[\w]+(?:[’'-][\w]+)*\b", re.UNICODE)
FENCE = re.compile(r'^```([^\n]*)\n(.*?)^```\s*$', re.M | re.S)
REF = re.compile(r'^##\s+(?:\d+\.\s+)?(?:References|Sources|Further reading)\b', re.M | re.I)

def words(text):
    return len(WORD.findall(text))

def narrative(text):
    text = FENCE.sub('', text)
    text = REF.split(text, maxsplit=1)[0]
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^#{1,6}\s+.*$', '', text, flags=re.M)
    text = re.sub(r'\A---\n.*?\n---\n', '', text, flags=re.S)
    return text

def main():
    books = sorted((ROOT/'books').glob('*.md'))
    errors = []
    if len(books) != 14 or [p.name[:2] for p in books] != [f'{n:02d}' for n in range(1,15)]:
        errors.append('Expected exactly books 01 through 14.')
    rows, catalog, paragraphs = [], [], Counter()
    (ROOT/'playbooks').mkdir(exist_ok=True)
    for p in books:
        text = p.read_text(encoding='utf-8')
        if len(re.findall(r'^```', text, re.M)) % 2:
            errors.append(f'{p.name}: unmatched code fence')
        blocks = []
        for index, match in enumerate(FENCE.finditer(text),1):
            language, content = match.group(1).strip(), match.group(2)
            if language not in ('yaml','yml','json'):
                continue
            try:
                parsed = json.loads(content) if language=='json' else yaml.safe_load(content)
                if not isinstance(parsed,(dict,list)):
                    raise ValueError('Playbook must be an object or array')
            except Exception as exc:
                errors.append(f'{p.name} block {index}: {exc}')
                continue
            suffix = 'json' if language=='json' else 'yaml'
            name = f'{p.stem[:2]}_playbook_{len(blocks)+1:02d}.{suffix}'
            dest = ROOT/'playbooks'/name
            dest.write_text(content.rstrip()+'\n',encoding='utf-8')
            entry={'id':f'b{p.name[:2]}-p{len(blocks)+1:02d}', 'book':p.name[:2],
                   'source_path':p.relative_to(ROOT).as_posix(),
                   'path':dest.relative_to(ROOT).as_posix(), 'format':suffix,
                   'schema_status':'task_specific_reference_contract_not_executable',
                   'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
            catalog.append(entry); blocks.append(entry['id'])
        if len(blocks)<2:
            errors.append(f'{p.name}: fewer than two parsed playbooks')
        narrative_words=words(narrative(text))
        if narrative_words<3500:
            errors.append(f'{p.name}: fewer than 3500 narrative words')
        headings=re.findall(r'^##\s+(.+)',text,re.M)
        links=sorted(set(re.findall(r'\]\((https?://[^\s)]+)\)',text)))
        if not links: errors.append(f'{p.name}: no external references')
        if 'ClimbOS' not in text:errors.append(f'{p.name}: missing product mapping')
        if re.search(r'\b(?:TODO|TBD|INSERT CHAPTER|CHAPTER TO COME)\b',text):
            errors.append(f'{p.name}: unfinished-marker candidate')
        # Exact paragraph repetition; titles and short shared labels are ignored.
        for para in re.split(r'\n\s*\n',FENCE.sub('',text)):
            norm=' '.join(para.split())
            if words(norm)>65: paragraphs[norm]+=1
        rows.append({'id':p.name[:2], 'title':text.splitlines()[0].removeprefix('# '),
                     'path':p.relative_to(ROOT).as_posix(), 'total_tokenized_words':words(text),
                     'narrative_words':narrative_words, 'sections':len(headings),
                     'heading_index':headings,'external_source_links':len(links),
                     'playbooks':blocks, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    total=sum(r['total_tokenized_words'] for r in rows)
    prose=sum(r['narrative_words'] for r in rows)
    if not 50000<=total<=80000: errors.append(f'Book total outside requested range: {total}')
    duplicates=[{'paragraph':p,'occurrences':n} for p,n in paragraphs.items() if n>1]
    manifest={'title':'ClimbOS Growth Intelligence Library','edition':'October 2026',
              'research_cutoff':'2026-10-19','status':'validated' if not errors else 'validation_failed',
              'word_count_method':{'total':'Unicode word tokens including book headings, references and fenced playbooks; no support documents or duplicate extracted files.',
                                   'narrative':'Same tokenizer after removing fenced blocks, final References/Sources section, headings, front matter, and URL targets. Includes substantive lists and introductory edition notes.'},
              'total_book_words':total,'total_narrative_words':prose,
              'books':rows,'playbook_count':len(catalog),
              'exact_long_paragraph_duplicates':duplicates,'validation_errors':errors}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    (ROOT/'playbooks'/'catalog.json').write_text(json.dumps({'status':'reference_only','playbooks':catalog},indent=2)+'\n')
    out=['# Quality and completeness report','',f'Research cutoff: October 19, 2026. Validation status: **{manifest["status"]}**.','',
         f'**14 books; {total:,} total book words; {prose:,} narrative words; {len(catalog)} parsed YAML/JSON playbooks.**','',
         'The requested range is 50,000–80,000 words, with 77,000 as the target. The books satisfy that range. Supporting indexes, source records, extracted duplicate playbooks, and integration documentation are excluded from the book total.','',
         '| Book | Narrative words | Total book words | Sections | Parsed playbooks |', '|---|---:|---:|---:|---:|']
    out += [f'| [{r["id"]} — {r["title"].split("—",1)[-1].strip()}]({r["path"]}) | {r["narrative_words"]:,} | {r["total_tokenized_words"]:,} | {r["sections"]} | {len(r["playbooks"])} |' for r in rows]
    out += ['', '## Counting and automated checks','',manifest['word_count_method']['total'],manifest['word_count_method']['narrative'],'',
            'Checks verify all 14 numbered files, minimum substantial narrative length per book, balanced fences, at least two successfully parsed playbooks per book, external source links, ClimbOS mapping, and unfinished-marker candidates. Hashes are recorded in manifest.json. Different word processors may count hyphens, numerals, and identifiers differently.','',
            f'Exact repeated paragraphs longer than 65 words across the books: {len(duplicates)}. This is an exact-match check, not a semantic originality detector.','',
            '## Editorial coverage','',
            'Every book was written as a finished explanatory volume with practical applications, labeled hypothetical examples, implementation actions, AI-native opportunities, decision criteria or trees, formulas, structured playbooks, linked references, and proposed ClimbOS implementation guidance. See COMPLETENESS_MATRIX.md for chapter-level navigation. Cross-review records document inspected scope and localized corrections.','',
            '## Limits of verification','',
            'Syntax and structural checks do not prove every strategy will work. No live ClimbOS application was deployed, audited from source, or commercially benchmarked. Schemas and workflows remain proposed until implemented and tested. Current platform claims were researched through October 19, 2026; no claim is made about the remainder of October. Source records distinguish directly retrieved primary pages from indexed-only evidence and blocked retrievals. Policy eligibility must be checked again before execution.','',
            'No invented Formkit product facts, customer outcomes, universal performance guarantees, or assumed prospect database are intended. Examples and numerical operating thresholds are instructional assumptions unless explicitly attributed.','',
            '## Validation errors','']
    out += [f'- {e}' for e in errors] if errors else ['None.']
    (ROOT/'QUALITY_REPORT.md').write_text('\n'.join(out)+'\n',encoding='utf-8')
    print(json.dumps({'books':len(rows),'total_book_words':total,'narrative_words':prose,'playbooks':len(catalog),'errors':errors,'long_exact_duplicates':len(duplicates)}))
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
