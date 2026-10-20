# Customer language and objection capture

This is a working capture process and data contract. It contains no real interviews, customer quotes, contacts, testimonials, or measured outcomes. Null fields are intentionally unknown until evidence is collected. Synthetic evaluation dialogue must never enter this collection as observed customer evidence.

## A usable interview sequence

1. Ask the participant to describe the last time the relevant task occurred. Establish when, what triggered it, and what they were trying to accomplish.
2. Reconstruct the steps, people, tools, delays, and workarounds. Ask what happened when the task went wrong; distinguish an observed consequence from a feared consequence.
3. Ask what they tried, paid for, or stopped doing. Clarify who decided, who paid, and what competing priority won if no purchase occurred.
4. Ask to see an artifact where practical and permitted: a blank form, anonymized workflow, purchase process, or example of the workaround. Do not collect sensitive material merely because it is available.
5. Summarize the episode neutrally and ask what is inaccurate or missing. Do not pitch the product to rescue an inconvenient answer.
6. If appropriate, invite a concrete next step with clear terms. Record whether the participant actually completes it rather than treating polite agreement as a commitment.

These questions are original operational prompts. Use the book guides for attributed research principles. Obtain the required permission for recording, processing, retention, and quotation. A public review can inform a research hypothesis but does not automatically grant testimonial rights or establish how representative the claim is.

## Capture contract

```json
{
  "id": null,
  "tenant_id": null,
  "source_kind": null,
  "evidence_status": "not_collected",
  "participant_reference": null,
  "segment_hypothesis_id": null,
  "episode_date": null,
  "captured_at": null,
  "buying_role": null,
  "trigger": null,
  "task": null,
  "current_alternative": null,
  "observed_cost_or_consequence": null,
  "quote_exact": null,
  "quote_locator": null,
  "researcher_interpretation": null,
  "counterevidence": [],
  "commitment_requested": null,
  "commitment_observed": null,
  "permission": {
    "recording": null,
    "internal_analysis": null,
    "external_quotation": null,
    "retention_until": null
  },
  "source_artifact_hash": null,
  "reviewed_by": null
}
```

The server must derive tenant access from authenticated context. A nullable tenant field in this template does not authorize cross-tenant reads. Use a pseudonymous participant reference where sufficient and store identifying information separately with appropriate access.

## Keep four layers separate

- **Exact source:** what was said or observed, with its locator.
- **Interpretation:** what the researcher thinks it means.
- **Hypothesis:** a testable implication for the product, message, or buying process.
- **Action:** a proposed change requiring its own evidence and authorization.

For an objection such as price, do not classify automatically from a keyword. Determine whether it reflects insufficient value, lack of funds, procurement friction, a competitor's alternative, packaging, or an unqualified buyer. The interview may not resolve that distinction; preserve uncertainty.

## Review and aggregation

Group observations by task and buying situation before broad demographic labels. Retain negative and contradictory episodes. Report sample composition and recruitment route alongside counts. Ten comments from one convenience sample do not establish market prevalence. If AI clusters the material, preserve original links and require a reviewer to verify materially different clusters and dissenting cases.

Before using customer language externally, verify accuracy, context, and quotation rights. Never generate an invented testimonial to fill a missing proof section. Where evidence is absent, describe the product mechanism in supportable terms and make research the next task.

## Acceptance checks

A captured observation is useful when another reviewer can distinguish the source from interpretation, locate the episode, see permissions, understand the buying context, and identify what would change the inference. Reject synthetic material mislabeled as observed, missing quote provenance, and claims that outrun the actual evidence.
