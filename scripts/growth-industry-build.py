#!/usr/bin/env python3
"""Validate and compile the owner-supplied industry playbook archive."""

from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/growth-expansion/collections/ClimbOS_25000_Playbooks_Industry_Chapters.zip"
OUTPUT = ROOT / "shared/knowledge/industryPlaybooks.generated.json"
FIELD_ORDER = [
    "Problem",
    "Evidence to collect",
    "Solution procedure",
    "Industry-specific implementation",
    "ClimbOS automation",
    "Success and harm checks",
    "Approval / constraints",
]


def sha256(value: bytes | str) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def parse_fields(block: str) -> dict[str, str]:
    matches = list(re.finditer(r"^\*\*([^*]+):\*\*\s*", block, re.MULTILINE))
    result: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        result[match.group(1).strip()] = block[match.end() : end].strip()
    return result


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing industry playbook source archive: {SOURCE}")

    businesses: list[dict[str, str]] = []
    playbooks: list[dict[str, object]] = []
    values: dict[str, list[str]] = {field: [] for field in FIELD_ORDER}
    value_ids: dict[str, dict[str, int]] = {field: {} for field in FIELD_ORDER}

    def intern(field: str, value: str) -> int:
        index = value_ids[field].get(value)
        if index is None:
            index = len(values[field])
            values[field].append(value)
            value_ids[field][value] = index
        return index

    with zipfile.ZipFile(SOURCE) as archive:
        chapter_paths = sorted(
            name for name in archive.namelist() if re.fullmatch(r"industries/\d{2}-[^/]+\.md", name)
        )
        if len(chapter_paths) != 25:
            raise SystemExit(f"Expected 25 industry chapters; found {len(chapter_paths)}")

        for chapter_path in chapter_paths:
            markdown = archive.read(chapter_path).decode("utf-8")
            industry_match = re.search(r"^# ClimbOS Playbooks — (.+)$", markdown, re.MULTILINE)
            if not industry_match:
                raise SystemExit(f"Missing industry title in {chapter_path}")
            industry = industry_match.group(1).strip()
            business_matches = list(
                re.finditer(r"^### (BT-\d{3}) · (.+)$", markdown, re.MULTILINE)
            )
            if len(business_matches) != 20:
                raise SystemExit(f"Expected 20 business types in {chapter_path}; found {len(business_matches)}")

            for business_index, business_match in enumerate(business_matches):
                start = business_match.end()
                end = business_matches[business_index + 1].start() if business_index + 1 < len(business_matches) else len(markdown)
                business_block = markdown[start:end]
                profile = re.search(r"^\*\*Profile:\*\*\s*(.+)$", business_block, re.MULTILINE)
                if not profile:
                    raise SystemExit(f"Missing business profile for {business_match.group(1)}")
                businesses.append(
                    {
                        "id": business_match.group(1),
                        "name": business_match.group(2).strip(),
                        "industry": industry,
                        "path": f"docs/growth-expansion/collections/ClimbOS_25000_Playbooks_Industry_Chapters.zip#{chapter_path}",
                        "profile": profile.group(1).strip(),
                    }
                )

                playbook_matches = list(
                    re.finditer(r"^#### (BT-\d{3}-PB-\d{2}) — (.+)$", business_block, re.MULTILINE)
                )
                if len(playbook_matches) != 50:
                    raise SystemExit(f"Expected 50 playbooks for {business_match.group(1)}; found {len(playbook_matches)}")

                for playbook_index, playbook_match in enumerate(playbook_matches):
                    body_start = playbook_match.end()
                    body_end = playbook_matches[playbook_index + 1].start() if playbook_index + 1 < len(playbook_matches) else len(business_block)
                    fields = parse_fields(business_block[body_start:body_end])
                    if set(fields) != set(FIELD_ORDER):
                        raise SystemExit(f"Unexpected fields for {playbook_match.group(1)}: {sorted(fields)}")
                    refs = [intern(field, fields[field]) for field in FIELD_ORDER]
                    canonical = json.dumps(
                        [playbook_match.group(1), playbook_match.group(2).strip(), [fields[field] for field in FIELD_ORDER]],
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    playbooks.append(
                        {
                            "id": playbook_match.group(1),
                            "businessTypeId": business_match.group(1),
                            "heading": playbook_match.group(2).strip(),
                            "fieldRefs": refs,
                            "sha256": sha256(canonical),
                        }
                    )

    business_ids = [business["id"] for business in businesses]
    playbook_ids = [playbook["id"] for playbook in playbooks]
    if len(business_ids) != 500 or len(set(business_ids)) != 500:
        raise SystemExit(f"Expected 500 unique business types; found {len(business_ids)} records")
    if len(playbook_ids) != 25_000 or len(set(playbook_ids)) != 25_000:
        raise SystemExit(f"Expected 25,000 unique playbooks; found {len(playbook_ids)} records")

    payload = {
        "edition": "Owner-supplied 25,000 Playbooks",
        "sourceSha256": sha256(SOURCE.read_bytes()),
        "evidenceClass": "proposed_scenario",
        "fieldOrder": FIELD_ORDER,
        "businesses": businesses,
        "fieldValues": values,
        "playbooks": playbooks,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "businessTypes": len(businesses),
                "playbooks": len(playbooks),
                "uniqueFieldValues": {field: len(items) for field, items in values.items()},
                "sourceSha256": payload["sourceSha256"],
                "output": str(OUTPUT.relative_to(ROOT)),
                "outputBytes": OUTPUT.stat().st_size,
            }
        )
    )


if __name__ == "__main__":
    main()
