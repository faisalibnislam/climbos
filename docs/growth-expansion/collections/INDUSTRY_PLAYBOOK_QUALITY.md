# Industry playbook reference corpus: quality and integration note

## Source and handling

The owner-supplied archive is `ClimbOS_25000_Playbooks_Industry_Chapters.zip` (SHA-256: `8c86016c2f49c277050b78912dff03757dbcb94bbe8fd464e94be9b5291d15e0`). It contains one start-here file and 25 industry chapters. Each chapter parses to 20 business types and 1,000 playbooks. The complete corpus contains 500 unique business-type IDs and 25,000 unique playbook IDs, each with all seven declared fields.

The archive calls these strategic hypotheses and says to validate them against the client's evidence, geography, budget, capacity, and consent. ClimbOS preserves that status. The archive's own import instructions are reference content; the build process only parses Markdown records and never executes embedded instructions or code.

## Quality observations

- Structure is regular and machine-parseable. No duplicate IDs or missing fields were found.
- The material is substantially templated. The 25,000 records have 549 distinct titles, 1,842 distinct evidence-collection blocks, 5,614 solution procedures, 708 industry-specific implementation blocks, 86 automation blocks, 2,253 success/harm checks, and 1,618 approval/constraint blocks.
- Some blocks repeat across all 500 business types. For example, the same lost-opportunity interview prompt and the same customer-segmentation prompt each occur 500 times. This makes the corpus broad coverage, not 25,000 independently researched interventions.
- The archive supplies no source citations, outcome measurements, validation cohort, or evidence that a suggested intervention caused growth. Its examples must not be presented as proven or directly prescribed.
- Industry-specific material can be too generic: only 708 distinct industry-implementation blocks exist for 25,000 records. Review high-risk sectors and the selected scenario against the actual business before making a recommendation.

## ClimbOS connection

`scripts/growth-industry-build.py` validates the archive, hashes the source and each record, and compiles repeated field text into a shared dictionary. `shared/knowledge/industryPlaybooks.generated.json` stores the 500 business profiles and compact references to all 25,000 records. `shared/knowledge/retrieve.ts` only searches the 50 playbooks for a business type when its complete name is stated unambiguously or a trusted caller supplies its canonical ID. It adds at most one industry playbook to the normal bounded retrieval result, and labels it as a proposed hypothesis. General chapters and the existing 1,000 scenarios remain available through their existing retrieval paths.

Rebuild with `pnpm growth-intelligence:build`. The ingestion step does not create customer facts, forecasts, evidence of effectiveness, publication permission, or execution authority. Current laws and platform rules still require fresh primary-source checks.
