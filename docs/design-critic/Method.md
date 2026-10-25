# ClimbOS Design Critic method

This is an inspectable, version-controlled method for website and landing-page critique. It guides questions and trade-offs; it does not prescribe one customer-facing aesthetic. `skills/conversion-audit/SKILL.md` and `ConversionAuditV2Schema` are the runtime entrypoints.

## Principles

1. **Start from the customer and page job.** Evaluate a page for its audience, offer, traffic source, desired action, and confirmed brand facts. Visual clarity and ownability serve that business context.
2. **Separate evidence from judgment.** Label directly observed defects, automated checks, heuristics, brand judgments, stylistic preferences, and measured technical behavior separately. Aesthetic preference is not an objective defect.
3. **Use distinctive expression that belongs to the business.** Look for a clear, coherent point of view in the customer's real product, people, expertise, and audience language. Do not make a customer look like another company, ClimbOS, a competitor, or a copied campaign.
4. **Make the useful next step clear.** Assess communication hierarchy, proof, trust, interaction, and responsive behavior against what the visitor is trying to do. When the evidence is incomplete, describe the gap and a reversible test.
5. **Treat accessibility as a mix of checks and human evaluation.** Use current W3C WCAG guidance as a reference. Name checks actually run; explain what still needs keyboard, screen-reader, content, or human review. A bounded automated and screenshot review is not a conformance audit.
6. **Report technical behavior only when measured.** Keep PageSpeed, CrUX, Lighthouse, static checks, and subjective visual judgments distinct. State the sampled URL, viewport, time, data type, and coverage where available.
7. **Keep exploration separate from approved brand material.** Bold art directions remain hypotheses until the owner reviews them. An idea or preview is not permission to publish or change a customer-facing site.

## Current sources

- `docs/DesignSystem.md` describes ClimbOS's own Signal UI system; it is not a template for customer websites.
- `docs/ContentDesign.md` supplies ClimbOS content-hierarchy and readability principles.
- `skills/conversion-audit/SKILL.md` contains the business-specific conversion audit procedure and evidence safeguards.
- W3C, [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/wcag/), Recommendation published 12 December 2024. Recheck official guidance when materially updating accessibility advice.

## Current runtime boundary

The existing audit reads a bounded website sample, captures the first eligible public page in synthetic 1440×900 desktop and 390×844 mobile viewports when the render service is configured, and may include post samples. If more than one responsible response is supported, the model may offer up to three distinct, explicitly hypothetical directions labeled quick fix, considered redesign, or bold alternative, with effort, assumptions, risks, trade-offs, and a measurement plan. A selected direction opens an editable design brief seeded with the finding's page/evidence, customer goal, owner-maintained workspace brand settings, unknowns, creative-range preference, and owner-entered essential elements. This creates a separate ClimbOS-hosted landing-page draft; it does not change or faithfully re-render the audited external website.

Finding feedback is saved against the immutable audit run and finding index, with source URL and supplied viewport/capture time where present. Accepted, deferred, dismissed, corrected, resolved, and reopened states are permission-checked and audited. Draft creation does not resolve a finding. Saved page edits still overwrite the draft; recoverable original/proposal/decision/approved page-version history is not implemented. A cross-page brand consistency map and opportunity queue are also not implemented. The system does not crawl every journey, run a manual screen-reader audit, or prove conversion effects. Publishing follows the existing landing-page approval control.

The existing page and outreach subject A/B workflow requires approval to start because it exposes variants. It waits for its fixed sample and outcome windows, then reports the result without changing source content. Applying B requires a separate approver action, an unchanged baseline hash, and an audit event; existing experiment rows without a saved baseline cannot be applied through this flow. The fixed sample rules are not business-calibrated power analysis, and a measured association is not a guaranteed causal effect.
