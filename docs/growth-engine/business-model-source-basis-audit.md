# Business-model evidence labels and original sources

17 November 2026. Original requirements 2/4/6/9/10 and the owner's business viability, pivoting, protected creative-strategy and evidence instructions. Engine `v3.135-business-model-source-basis`.

## Existing workflow and confirmed gaps

The actual path is owner-started `businessModel.start` → reserved, metered `jobs.businessModelCheck` → existing job context and deterministic first-party signals → bounded research and shared strategy specialist → schema/lint/revision → final validation → verified workflow output → `businessModel.latest` → Business model check page. Recorded tests stay tied to their original check and alternative; later planning receives labeled judgments and owner-reported outcomes. Input hashes prevent changed context from mixing with cached research on retry. References already required exact supplied fact indexes or URLs read in the run. No recommendation applies a price, sends, publishes or changes operations.

Confirmed gaps:

- A valid citation could still be labeled measured even when its recorded provenance was owner-supplied or published. Market signals also accepted uncited owner reports. Segment-fit ratings had the same source-class gap.
- Economic input rows carried a label and value but no per-input reference. An overall alternative citation did not identify the evidence for a particular price or cost.
- Business-model fact citations used the shared link to a general plan's sources. This page did not retain the original ordered fact text, so that link could not establish the evidence for this historical report.
- Workspace export contained business-model test notes but omitted the corresponding reports and their original inputs. A regression reproduced that omission.

## Implemented behavior

The existing deterministic validator now checks every reference against its recorded source class for market signals, segment-fit dimensions and evidenced economics inputs. Owner reports mentioning analytics remain owner reports; a retrieved page stays a published source claim. Missing provenance cannot become measured evidence. Mixing correctly labeled and differently sourced references in one finding fails rather than letting one reference validate the others. Interpretations can remain inference, and unprovided business inputs can remain unknown.

Economic rows now support `evidenceRefs`. They are optional for reading historical reports but mandatory for new owner-reported, measured or research assertions during validation. The actual task explains these requirements; both revision lint and the existing final non-fixture v2 acceptance check enforce them. A passing model critique cannot waive an error. Rejected output never becomes the verified report or a later planning recommendation. No new model, provider or agent was added.

The first input snapshot now retains the exact ordered facts and their provenance labels from trusted job context. The existing write-once snapshot and context hash retain retry behavior; current fact edits or deletion cannot silently substitute new source text into an old report. The authorized read returns this snapshot. Inline expandable fact citations show the original wording and label; reports without a snapshot explicitly say the original text is unavailable instead of linking to another plan. Economic citations use the same component. Other plan views retain their existing reference behavior.

Workspace export now includes up to 100 recent business-model runs, their statuses, fixture labels, parsed verified reports and parsed evidence snapshots, with an explicit history-limit flag. Raw run inputs, connector secrets and arbitrary output are not added. Existing tenant-scoped workflow purge removes the snapshots with their runs. Test reports retain their independent existing 1,000-row export limit; an older report referenced by a test may be outside the model-check export window.

## Protected strategy and permissions

Grounded, adjacent and bold alternatives remain mandatory. A novel bold idea needs no precedent or direct evidence. The change checks claims of evidence, not novelty, confidence, feasibility or the verdict itself. No composite ranking was introduced. Existing verdict labels, independent dimensions, owner decisions, original test history, meter reservation, tenant checks and action boundaries remain in place. A reported outcome or source label does not authorize adoption or execution.

## Verification

See the dated entry in [Verification](../Verification.md) for the final commands and results. Seven new regressions first reproduced the label/reference gaps. The export regression initially failed because the report snapshot was missing; it passed after using the existing export path. One existing workflow test hit its 20-second timeout under concurrent local validation, requiring a focused rerun. Type checking also caught a nullable freshness assertion in the new test, corrected without runtime changes.

Coverage includes real job acceptance despite a mocked passing model critique, source-class propagation, no external effects, correctly sourced economics, unknown economics, preserved bold options, snapshot identity after current facts change, tenant isolation, export and purge, original/legacy source display, desktop/mobile review, and existing metering/permission/history behavior. Provider/model responses and browser business evidence are synthetic; no paid model or live business action was used.

## Remaining limits

Source-class correctness and citation existence do not prove that the cited words support a particular number, date, demand claim or recommendation. Semantic entailment, customer representativeness, complete first-party data, independently measured willingness to pay, real model judgment quality, calibrated viability/pivot decisions and actual business outcomes remain unverified. Existing calculated first-party signals retain their coverage and heuristic limitations.

Historical reports are preserved rather than relabeled. Old snapshots cannot recover missing original facts. The new source snapshot retains text/provenance but not the entire original external page; links may later change. Export is bounded and has not been production load-tested. Automated accessibility checks do not establish full conformance. This batch does not complete the full 410 requirements or the later owner specifications.
