#!/usr/bin/env python3
"""Build local section records. No network or external dependencies."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'integration' / 'retrieval_sections.jsonl'
rows = []
for path in sorted((ROOT / 'books').glob('*.md')):
    text = path.read_text(encoding='utf-8')
    parts = re.split(r'(?m)^(## .+)$', text)
    sections = [('Introduction', parts[0])]
    sections += [(parts[i].removeprefix('## '), parts[i + 1]) for i in range(1, len(parts), 2)]
    for number, (heading, body) in enumerate(sections):
        if not body.strip():
            continue
        content = body.strip()
        digest = hashlib.sha256(content.encode()).hexdigest()
        rows.append({'id': f'{path.stem}:{number}:{digest[:12]}', 'book_id': path.name[:2],
                     'path': path.relative_to(ROOT).as_posix(), 'heading': heading,
                     'research_cutoff': '2026-10-19', 'content': content, 'sha256': digest})
OUT.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows), encoding='utf-8')
print(json.dumps({'sections': len(rows), 'output': str(OUT)}))
