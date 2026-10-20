# Proposed skill revisions (not applied)

Edition 2026-10-20. The owner asked for skill changes as **reviewable proposals**, to be applied only after approval and, ideally, a bench run. Nothing under `skills/` has been changed.

- Each `.diff` applies cleanly to `growth-engine-v2` at `1321d8e`. Check with `git apply --check -p1 <file>`; apply with `git apply -p1 <file>`, then run `pnpm skills:build`.
- Each `.md` is a rationale table (change | sources | rule class | why) plus the book proposals that were rejected, with reasons.
- New rules are tagged with their framework id (e.g. [BK15-K1]). Heuristics are marked "context:". Book benchmarks appear only as dated context.
- ClimbOS policy beats any book tactic. The conflicts are listed in each rationale. The owner confirmed: no pattern-guessed email address for any person.

**Before applying:**
- Update the matching rubrics. The growth-strategy rubric's G3 and focus anchor still say "1 primary + 1 secondary". The positioning rubric still gates on the swap test and requires a pitch narrative.
- Run a bench comparison, since every changed skill changes its hash. Paid runs need a cost cap.
- Code items the diffs depend on (test play kind, channel test status, stickiness gate) are in [../BACKLOG.md](../BACKLOG.md).

| Skill file | Lines + / − | Books | Diff | Rationale |
|---|---|---|---|---|
| [skills/cold-outreach/SKILL.md](../../../../skills/cold-outreach/SKILL.md) | +14 / −9 | BK09a, BK14 | [cold-outreach.diff](cold-outreach.diff) | [cold-outreach.md](cold-outreach.md) |
| [skills/competitor-teardown/SKILL.md](../../../../skills/competitor-teardown/SKILL.md) | +4 / −3 | BK07, BK11 | [competitor-teardown.diff](competitor-teardown.diff) | [competitor-teardown.md](competitor-teardown.md) |
| [skills/conversion-audit/SKILL.md](../../../../skills/conversion-audit/SKILL.md) | +7 / −2 | BK13 | [conversion-audit.diff](conversion-audit.diff) | [conversion-audit.md](conversion-audit.md) |
| [skills/copy-fundamentals/SKILL.md](../../../../skills/copy-fundamentals/SKILL.md) | +7 / −2 | BK10, BK11, BK13 | [copy-fundamentals.diff](copy-fundamentals.diff) | [copy-fundamentals.md](copy-fundamentals.md) |
| [skills/experiment-design/SKILL.md](../../../../skills/experiment-design/SKILL.md) | +8 / −2 | BK06, BK13, BK15 | [experiment-design.diff](experiment-design.diff) | [experiment-design.md](experiment-design.md) |
| [skills/growth-plays/SKILL.md](../../../../skills/growth-plays/SKILL.md) | +7 / −3 | BK07, BK10, BK11, BK12, BK15 | [growth-plays.diff](growth-plays.diff) | [growth-plays.md](growth-plays.md) |
| [skills/growth-plays/reference/base-rates.md](../../../../skills/growth-plays/reference/base-rates.md) | +19 / −5 | BK09b, BK10, BK12 (cited by title) | [growth-plays__base-rates.diff](growth-plays__base-rates.diff) | [growth-plays__base-rates.md](growth-plays__base-rates.md) |
| [skills/growth-strategy/SKILL.md](../../../../skills/growth-strategy/SKILL.md) | +29 / −15 | BK07, BK08, BK09a, BK09b, BK10, BK11, BK12, BK15 | [growth-strategy.diff](growth-strategy.diff) | [growth-strategy.md](growth-strategy.md) |
| [skills/instagram-posts/SKILL.md](../../../../skills/instagram-posts/SKILL.md) | +4 / −3 | BK11 | [instagram-posts.diff](instagram-posts.diff) | [instagram-posts.md](instagram-posts.md) |
| [skills/landing-pages/SKILL.md](../../../../skills/landing-pages/SKILL.md) | +17 / −6 | BK08, BK13, BK14 | [landing-pages.diff](landing-pages.diff) | [landing-pages.md](landing-pages.md) |
| [skills/lead-magnets/SKILL.md](../../../../skills/lead-magnets/SKILL.md) | +5 / −3 | BK09a, BK13, BK14 | [lead-magnets.diff](lead-magnets.diff) | [lead-magnets.md](lead-magnets.md) |
| [skills/meta-ads/SKILL.md](../../../../skills/meta-ads/SKILL.md) | +9 / −7 | BK10, BK11 | [meta-ads.diff](meta-ads.diff) | [meta-ads.md](meta-ads.md) |
| [skills/plays-ecommerce-consumer/SKILL.md](../../../../skills/plays-ecommerce-consumer/SKILL.md) | +5 / −1 | BK10, BK11, BK12, BK15 | [plays-ecommerce-consumer.diff](plays-ecommerce-consumer.diff) | [plays-ecommerce-consumer.md](plays-ecommerce-consumer.md) |
| [skills/plays-local/SKILL.md](../../../../skills/plays-local/SKILL.md) | +6 / −4 | BK07, BK10, BK11 | [plays-local.diff](plays-local.diff) | [plays-local.md](plays-local.md) |
| [skills/plays-saas-b2b/SKILL.md](../../../../skills/plays-saas-b2b/SKILL.md) | +3 / −0 | BK09a, BK09b, BK10, BK12 | [plays-saas-b2b.diff](plays-saas-b2b.diff) | [plays-saas-b2b.md](plays-saas-b2b.md) |
| [skills/positioning/SKILL.md](../../../../skills/positioning/SKILL.md) | +17 / −11 | BK07, BK08, BK09a, BK10, BK11, BK14 | [positioning.diff](positioning.diff) | [positioning.md](positioning.md) |
| [skills/prospecting/reference/jurisdiction-rules.md](../../../../skills/prospecting/reference/jurisdiction-rules.md) | +10 / −2 | BK09a | [prospecting-jurisdiction-rules.diff](prospecting-jurisdiction-rules.diff) | [prospecting.md](prospecting.md) |
| [skills/prospecting/SKILL.md](../../../../skills/prospecting/SKILL.md) | +14 / −7 | BK09a | [prospecting.diff](prospecting.diff) | [prospecting.md](prospecting.md) |
| [skills/reply-handling/SKILL.md](../../../../skills/reply-handling/SKILL.md) | +8 / −4 | BK09a, BK09b | [reply-handling.diff](reply-handling.diff) | [reply-handling.md](reply-handling.md) |
| [skills/retention-lifecycle/SKILL.md](../../../../skills/retention-lifecycle/SKILL.md) | +10 / −0 | BK07, BK08, BK09b, BK10, BK11, BK12 | [retention-lifecycle.diff](retention-lifecycle.diff) | [retention-lifecycle.md](retention-lifecycle.md) |
| [skills/sales-follow-up/SKILL.md](../../../../skills/sales-follow-up/SKILL.md) | +18 / −5 | BK09a, BK09b, BK14 | [sales-follow-up.diff](sales-follow-up.diff) | [sales-follow-up.md](sales-follow-up.md) |
| [skills/short-video-scripts/SKILL.md](../../../../skills/short-video-scripts/SKILL.md) | +5 / −2 | BK11 | [short-video-scripts.diff](short-video-scripts.diff) | [short-video-scripts.md](short-video-scripts.md) |
| [skills/social-calendar/SKILL.md](../../../../skills/social-calendar/SKILL.md) | +4 / −3 | BK11 | [social-calendar.diff](social-calendar.diff) | [social-calendar.md](social-calendar.md) |
| [skills/social-visual-briefs/SKILL.md](../../../../skills/social-visual-briefs/SKILL.md) | +5 / −5 | BK10, BK11 | [social-visual-briefs.diff](social-visual-briefs.diff) | [social-visual-briefs.md](social-visual-briefs.md) |
| [skills/voc-research/SKILL.md](../../../../skills/voc-research/SKILL.md) | +13 / −4 | BK08, BK11, BK12, BK13 | [voc-research.diff](voc-research.diff) | [voc-research.md](voc-research.md) |
