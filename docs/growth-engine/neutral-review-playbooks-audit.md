# Neutral review guidance in runtime playbooks — 17 November 2026

## Confirmed gap

The review invitation workflow already has neutral wording, tenant isolation, suppression/frequency checks and exact send approval. The strategy input still contradicted the owner's stricter no-rewards requirement: SaaS guidance proposed gift cards and happy active customers; ecommerce guidance proposed equal incentives, satisfaction-screened in-app prompts and review-program enrollment. General growth and lifecycle guidance allowed platform-dependent incentive exceptions. These are runtime instructions, not just an unused archive: `playCatalogsFor` → `growthPlaysSpec`/`retentionSpec` → `draftSystem` → `skillPlaybook` reads `shared/skills/generated.ts`.

## Changes

- Corrected the four source playbooks, then ran the established `pnpm skills:build` generator. No generated file was hand-edited.
- Review collection now explicitly prohibits rewards for reviews, changes, removals or ratings regardless of a platform exception; neutral invitations use the same public destination independently of sentiment, with optional private feedback equally visible.
- SaaS, ecommerce and app guidance no longer selects happy customers, proposes a sentiment pre-filter, invents review quotas or promotes review incentives. Current eligibility, rules, fees and capacity must be checked. Unknown access uses the existing manual/owner-reviewed path.
- Retained catalog identifiers for compatibility while replacing review-program enrollment with listing/feedback readiness. Creator/editorial collaborations and referral options remain distinct; disclosed editorial proposals do not require public customer reviews or a favorable verdict.
- Qualified outcomes and operating time remain separate from review counts, stars and badges. External action still requires exact tenant/content/destination/audience/scope approval and audit; this playbook update adds no execution capability.
- Historical research remains identifiable as historical source material, with explicit correction notices rather than silently treating old instructions or vendor figures as current product policy.

Engine `v3.141-neutral-review-playbooks`. This is the owner's product policy; it makes no new claim about current law or platform exceptions and does not add an integration.

## Verification

Five initial regression failures confirmed the actual writer prompts lacked consistent guidance and retained contradictory instructions. `pnpm exec vitest run tests/unit/review-playbook-policy.test.ts tests/unit/diagnosis-playbooks.test.ts tests/unit/manipulation-lint.test.ts tests/unit/strategy-prompt-cost.test.ts tests/convex/reviews.test.ts tests/convex/review-send-boundary.test.ts tests/convex/review-receipt-recovery.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — **120 tests in nine files passed, 5.42 seconds**. Actual draft-system composition is checked for software, ecommerce, local businesses and lifecycle advice, alongside existing fair invitation, send/recovery and permission coverage. Generation rebuilt 34 skills and changed four compiled playbooks/hashes. Application/Convex typecheck, scoped ESLint and diff checks passed. No UI or external send ran.

## Limits

A corrected prompt is not proof of every future model response. Existing manipulation checks and send boundaries remain; semantic quality still needs live evaluation. Historical research contains superseded claims clearly marked as such. Current third-party eligibility, policies, access and outcomes remain independently verifiable only when a specific platform/business is assessed. No credentials, production deployment, public review or customer contact occurred. Full project scope remains incomplete.
