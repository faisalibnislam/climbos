# Livoform strategy review using saved drafts

## What the agency draft missed

The 18 November agency draft proposed that completing an intake form could earn the client a capped quote. Its closest familiar alternative is an agency giving a capped quote with stated assumptions. A calculator without a commitment offers a weaker comparison. The saved rule would continue if owners committed to a ceiling on a real project. Both versions could produce that outcome. Even with a better control, counting only owners who offer a ceiling would tell us little about the client's decision or the value of the exchange.

The focused strategy writer now gets a tie scenario during ideation. The independent final review must quote the current bold mechanism, test method, metric and continue rule. A passing originality score conflicts with a reviewer finding that the same result under ordinary practice would advance the proposal. Those conflicts go back for revision through the existing workflow. A qualitative difference can justify another small test. The reviewer still exercises judgment about the strength of the alternative and the quality of the idea.

## Three options for the owner to consider

These are editorial examples from a retrospective review. The owner reported a new launch, zero traffic and zero revenue. Tester access, founder time, willingness to pay and service costs are unknown. The historical research distinguishes Livoform plan eligibility from actual access. The examples can be prepared on paper and do not require a purchase, an invitation, or a product change.

| Option | Why it might matter | Smallest useful check and decision |
|---|---|---|
| **Grounded — identify a question that changes an agency quote.** Evidence-supported inference about a possible agency use case. | An intake question earns its place if its answer changes scope or the next decision. A tool that merely reproduces a questionnaire gives an agency little reason to switch. | Take one fictional brief with two plausible answers. Use the same manual quote template for both. Mark which answer would change a deliverable, exclusion or follow-up. If neither changes anything, remove the question. A desk check can improve the sample. It cannot establish buyer interest. |
| **Adjacent — a change receipt that the client can correct.** Speculative transfer from the itemized estimates used in repair work. | When a request changes, the client sees which earlier assumption it replaced, what stays fixed, and which choice is pending. The agency may gain a usable scope record. A normal change order might already do all this. | Compare an ordinary itemized change order with the same terms and a client-editable assumption. On the same fictional change, observe which error the client can surface and whether the agency acts on it. If both documents resolve it equally well, use the simpler one. Track extra review work. |
| **Bold — let the client reserve the right to decide one thing late.** Speculative hypothesis about changing who bears uncertainty. | Ordinary intake asks the client to settle scope before the agency commits. Instead the agency offers two pre-agreed variants for one unresolved choice, names the latest safe decision point, and commits to honoring either one until then. The client gets time to learn. The agency bears an option cost and might decline. | Compare with an equally clear capped proposal listing the same variants, price and information. Change only the obligation to honor the client's later choice. In a private role-play, introduce the same new constraint after the initial brief. Record what the client can still choose and what work or risk the agency takes on under each arrangement. Continue exploration if the added right changes a useful decision and the agency can explain how it would bound the obligation. If an ordinary staged contract already grants the same right, the claimed difference disappears. Stop if neither party can bound the cost. |

The bold idea proposes an offer an agency could test. Current Livoform support for such commitments is unknown. If an owner later has consenting participants, compare their behavior separately from role-play. A successful role-play would justify a more realistic test. It would establish neither subscription value nor permission to contact customers.

## Verification

The read-only replay on 47 saved Livoform focused-plan files produced 16 output-check failures, eight retained historical review failures, ten incompatible output schemas and 13 files without sufficient replay context. No file received a new quality pass. The saved agency assessment remains 3.5/5. The excerpts and paired counterfactuals used in regression tests carry controlled reviewer annotations. They do not establish that a fresh model would supply the right annotations.

209 focused strategy, replay, workflow and permission tests passed across ten files. The two TypeScript projects and changed-file lint passed. No new model generation was run.

## Repair one option without rewriting the others

In the saved comparison-v4 revision, grounded and adjacent were identical to the first draft. The repair contract nevertheless required the writer to repeat both. The exploration alone occupied 12,159 serialized characters. Its bold-only replacement took 4,368. Before the fix the smaller patch failed validation. After the fix both patches produced the same fully validated plan from the retained original. These are measured character counts, not measured model cost, latency or quality gains.

During a focused revision, the writer can supply one or more complete changed options. Each option retains its original schema, and every merged plan still goes through full validation and independent review. An empty patch, unknown mode, deletion or a fragment of a bold option is rejected. All other top-level sections retain their existing update rules. A rerun of ten focused strategy and permission suites passed 217 tests.

## Attribute intent and payment to the right transaction

The agency sample describes a fictional deposit going to the agency’s Stripe account. A client paying for agency work and an agency paying Livoform for software would be different transactions. Similarly, an agency offering a ceiling and a client accepting it involve different decisions. These saved examples motivated counterfactual tests. The saved assessment did not claim a real charge occurred.

Previously, the review could accept a classified confirmed payment for a subscription claim without establishing the recipient or offer. It could also accept stated intent when the same review explicitly said the person expressing it was the wrong participant. The focused review now requires the payment observation to support the claimed transaction, and requires a matching participant for attributed intent. A different or unresolved transaction leaves that payment claim unverified. A demonstration can still inform comprehension, and confirmed revenue can be recorded independently of product activation. The reviewer interprets the source; code checks consistency with that interpretation.

201 tests passed across nine focused review, replay, workflow and permission suites. This batch uses synthetic counterfactuals and existing records only.

Final combined regression run: 275 tests passed across 13 files. Reproduction command for zsh or bash:

```sh
pnpm exec vitest run tests/unit/{focused-plan-eligibility,focused-measurement-review,focused-originality-review,focused-evidence-review,focused-evidence-repair,focused-section-revisions,focused-length-repair,creative-preparation,focused-plan,offline-strategy-replay}.test.ts tests/convex/{focused-plan,tenancy,safety}.test.ts
```
