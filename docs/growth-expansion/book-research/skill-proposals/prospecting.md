# prospecting: proposed revision (BK09a, BK10)

Files: `skills/prospecting/SKILL.md` (+16% words), `skills/prospecting/reference/jurisdiction-rules.md` (+25%, mostly the new "Check before calling" note). Diffs: `prospecting.diff`, `prospecting-jurisdiction-rules.diff`. Status: proposal. Not applied, not benched.

## Changes

| Change | Refs | Rule class | Why |
|---|---|---|---|
| Tag each must-have as observable or not. Hidden traits (budget, who signs) become discovery or form questions, not filters | BK09a-K3, F27 | contextual_heuristic | Stops fit-3 holds for traits that can never be found publicly |
| Fit-3 anchor now reads "one observable must-have not yet found" | BK09a-K3 | contextual_heuristic | Matches the observable split |
| Tag current solution (none / process / provider / product); already paying is a nice-to-have | BK09a-K2 | contextual_heuristic | Cheap, observable demand signal |
| Visible paid tiers (paid listing, public ad-library ads, paid booking tool) count as a willingness-to-pay signal, with URL | BK09a-K3, F28 | contextual_heuristic | Database-free signal |
| One primary source per campaign; account-first vs contact-first by the cheapest gating trait | BK09a-K3, F28, F30 | strategic_preference / contextual_heuristic | Discipline and cost |
| First list: mid-size accounts, owner's area; no picking for ease of reach; friends pass the same ICP | BK09a-F26, F29 | contextual_heuristic | Avoids easy-to-reach, poor-fit lists |
| One primary contact per account; one complementary contact only after the primary sequence ends; never parallel | BK09a-K4, F31 | strategic_preference | Book's "grab them all" cascade risks several cold emails into one firm |
| No bought, rented or scraped lists without a recorded lawful basis; imports keep provenance | BK09a-K3; policy | external_requirement | Policy |
| Remove pattern-inferred addresses (was: up to 3 candidates). Only published-verbatim or operator imports with provenance. No personal (non-business) addresses | policy; BK09a-K4 | external_requirement | Policy "no guessed personal emails". Code already sends only published addresses (`shared/outbound/index.ts:188-192` "never guessed"), so the skill was looser than the product |
| Reference: new "Check before calling" note; status unknown_to_investigate; lists questions for counsel, states no legal facts | BK09a-K4, F23, F32, F37 | unknown_to_investigate | Book is phone-first for local SMBs; library has no verified phone rules |
| Checklist: observable must-haves; one source; one contact at a time; no bought lists or guessed addresses | as above | — | Keeps checklist aligned |

## Conflicts with policy (policy wins)

- BK09a-F32: personal addresses are fine and pattern-guessing is standard. Rejected. Also removes the skill's own pattern-inference allowance.
- BK09a-F28/F32: LinkedIn premium search, email-finder plugins. Rejected (no LinkedIn scraping).
- BK09a-F44: TalentBin sold crawled personal emails. Rejected; flagged as a lawful-basis conflict.

## Rejected or deferred

| Proposal | Reason |
|---|---|
| Phone section with TPS/CTPS and US mobile rules stated as rules | Not sourced; only a "check before calling" note is added |
| List vendors / data providers | Book itself calls them stale; policy |
| BK10-K3 light buyers / Pareto | B2B fit-based targeting stays; no change |
| BK09a-K1 owner-hours requirement | Playbook (`PB-cold-outreach.requires`), not skill |

## Open question for the owner

- "No guessed personal emails" is read here as "no guessed addresses for a person, and no private addresses". If the owner meant only private (non-business) addresses, restore the old 3-candidate row for work addresses. Code already matches the stricter reading.
