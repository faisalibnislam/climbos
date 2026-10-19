# Research ledger

What each source establishes and its limits.

- **Who checked what:** "Prompt author" means the V2 prompt's author accessed the source on 2026-10-19. "Not re-fetched" means Claude hasn't opened it in this program yet.
- **Before relying on a source:** re-fetch it and record the date here.
- **Vendor pages:** these show what a vendor advertises. They don't prove performance or grant ClimbOS any API access.

## Market and product (parity matrix input)

| Source | Establishes | Limits | Used by | Status |
|---|---|---|---|---|
| [RankYak](https://rankyak.com/) | SEO workflow: site context, calendar, publishing, refresh | Vendor claims | S9, S10 | Prompt author, not re-fetched |
| [Sintra](https://www.sintra.ai/) | SMB role agents, context, integrations | Vendor claims | S5, S12 | Prompt author, not re-fetched |
| [Marblism Sonny](https://www.marblism.com/ai-employees/sonny) | Social planning, brand context, scheduling, feedback loop | Vendor claims | S12 | Prompt author, not re-fetched |
| [Marblism Penny](https://www.marblism.com/ai-employees/penny) | Keyword, article, publish | Vendor claims | S9 | Prompt author, not re-fetched |
| [Blaze](https://www.blaze.ai/) | Platform scope; software vs managed service | Vendor claims | S8 | Prompt author, not re-fetched |
| [Averi](https://www.averi.ai/) | Content workflow, brand, CMS, analytics | Vendor claims | S8, S10 | Prompt author, not re-fetched |
| [HubSpot Agent Hub](https://www.hubspot.com/products/artificial-intelligence) | CRM-grounded agents | Vendor claims | S6, S12 | Prompt author, not re-fetched |
| [Jasper platform](https://www.jasper.ai/platform) | Shared context and governance | The help centre needs sign-in, so it wasn't inspected | S8 | Prompt author, not re-fetched |
| [Surfer internal linking](https://docs.surferseo.com/en/articles/9154320-automated-internal-linking-tool) | Linking workflow and review dependencies | Product documentation | S9 | Prompt author, not re-fetched |
| [SparkToro](https://sparktoro.com/) | Audience-affinity discovery categories | Vendor claims | S6 | Prompt author, not re-fetched |
| [Modash overview](https://help.modash.io/en/articles/13714522-what-is-modash-and-how-does-it-work) | Boundaries for creator discovery, outreach and tracking | Vendor documentation | S6 (REQ-CREATOR) | Prompt author, not re-fetched |
| [Modash audience insights](https://help.modash.io/en/articles/13715083-understanding-audience-demographics-and-insights) | Demographic feature scope | Access and data limits unverified | REQ-CREATOR-02 | Not inspected |
| [HighLevel reputation](https://www.gohighlevel.com/reputation-management) | Review requests and reply help | Vendor claims | S11 | Prompt author, not re-fetched |

## Platform and search

| Source | Establishes | Limits | Used by | Status |
|---|---|---|---|---|
| [Google review data](https://developers.google.com/my-business/content/review-data) | Official review list and reply operations, plus prerequisites | API access needs Google approval | S11 (REQ-REV-01) | Prompt author, not re-fetched |
| [GBP notifications](https://developers.google.com/my-business/content/notification-setup) | Pub/Sub notifications | Needs a Cloud project | S11 | Prompt author, not re-fetched |
| [G2 Review Activity](https://documentation.g2.com/g2/docs/review-activity) | Seller replies happen inside my.G2 | No public reply-write API shown | S11 (REQ-REV-06) | Prompt author, not re-fetched |
| [G2 syndication](https://documentation.g2.com/partners/docs/get-started-with-g2-review-syndication) | Partner key and review read | Not a reply API | S11 | Prompt author, not re-fetched |
| [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | Limits on link spam and scaled content | — | S9, S10 | Prompt author, not re-fetched |
| [Google on generative content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) | Content guidance | — | S9 | Prompt author, not re-fetched |
| [Gmail sender guidelines](https://support.google.com/mail/answer/81126?hl=en) | Sender requirements | Applicability depends on volume | REQ-COPY, outbound | Prompt author, not re-fetched |
| [FTC influencer disclosures](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers) | US endorsement disclosure | US only | REQ-CREATOR-05/06 | Prompt author, not re-fetched |

## OpenAI (exact schemas: re-check before coding)

[Models](https://developers.openai.com/api/docs/models) · [Pricing](https://developers.openai.com/api/docs/pricing) · [Tools](https://developers.openai.com/api/docs/guides/tools) · [Function calling](https://developers.openai.com/api/docs/guides/function-calling) · [Agents](https://developers.openai.com/api/docs/guides/agents) · [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [Batch](https://developers.openai.com/api/docs/guides/batch) · [Evaluation](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

- **Prices:** the price snapshot from 2026-10-19 matches `shared/ai/models.ts` (see [evaluation-and-cost.md](evaluation-and-cost.md)).
- **REQ-API-02:** the reasoning-item handling across tool calls still needs to be checked against the current function-calling guide.

## Strategy and method

| Source | Establishes | Limits | Status |
|---|---|---|---|
| [Rumelt interview](https://www.lennysnewsletter.com/p/good-strategy-bad-strategy-richard) | Diagnosis, guiding policy, coherent action, the crux | Interview only. No full book or transcript reading is claimed | Prompt author |
| [Dunford positioning](https://www.aprildunford.com/post/a-quickstart-guide-to-positioning) | Positioning steps | Author summary | Prompt author |
| [Christensen JTBD](https://www.christenseninstitute.org/theory/jobs-to-be-done/) | Circumstance and the progress the customer wants | Theory | Prompt author |
| [Cialdini principles](https://www.influenceatwork.com/7-principles-of-persuasion/) | Persuasion principles | Apply honestly | Prompt author |
| [Microsoft SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/) | Check data quality before reading effects | — | Prompt author |

## In-repo research (claims to revalidate)

| File | Contents | Limit |
|---|---|---|
| `docs/research/strategy-positioning.md` | Strategy frameworks | Re-check citations |
| `docs/research/channel-content.md` | Channel craft and benchmarks | Benchmarks need a source, date, context and denominator (REQ-COPY, S8) |
| `docs/research/plays/*.md` | Base rates by business type | Historical vendor numbers. They are labelled `benchmark`, never `research`, in plans |
| `docs/research/acquisition-framework.md` | 30 business types, channel library, 8-factor scoring | Scores are decision aids, not calibrated probabilities (REQ-STRAT-08) |
| `docs/research/anthropic-platform.md` | Retired Anthropic routing notes | **Stale:** ClimbOS is OpenAI-only (REQ-COST-12) |

## Measured runs (our own evidence)

| Run | Date | Establishes | Limit |
|---|---|---|---|
| `bench/results/2026-10-18-13-31-tune-v2.*` | 2026-10-18 | One Formkit strategy: Basic about $0.214 vs Expert about $0.991. The judge preferred Basic | One case. The judge is the same model family. The report heading said "Opus" while the metadata said Sol ([evaluation-and-cost.md](evaluation-and-cost.md) §5) |
| `bench/results/2026-10-19-01-09-provenance-e2e.*` | 2026-10-19 | Formkit, Basic + Expert, $1.18 in total. Zero research tags and zero owner tags reached the checks | One case. The research-verification path wasn't exercised |
