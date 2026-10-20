# Platform rules and refreshable eligibility

A platform-rule reference is evidence for a check; it is not a grant of execution permission. All rows were checked on October 20, 2026. The Meta page could not be retrieved and remains explicitly unresolved. Source publication dates and retrieval dates are separate.

| Rule | Authoritative source | Verification | Proposed preflight |
|---|---|---|---|
| RULE-01 | [Google Search](https://developers.google.com/search/docs/essentials) | primary_page_read | Check crawl and index eligibility for the actual URL. Check current spam policy before scaling templated content. Do not promise ranking or indexing. |
| RULE-02 | [Apple product page optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/) | primary_page_read | Verify the actual app platform, distribution state, role and supported experiment surface. Record tested assets, version and locale. Use a supported alternative when the desired native experiment is unavailable. |
| RULE-03 | [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10) | primary_page_read | Verify approved product access and exact scope. Verify current author resource and organization role. Bind owner approval to destination, artifact, schedule and action. |
| RULE-04 | [Meta Pages publishing](https://developers.facebook.com/docs/pages-api/posts/) | retrieval_blocked | Fetch the current official Page publishing documentation before implementation. Verify app review, token type, role, scope and endpoint for the exact action. Keep execution blocked while eligibility is unresolved. |
| RULE-05 | [Resend sending eligibility](https://resend.com/legal/acceptable-use) | primary_page_read | Verify recipient eligibility and current suppression immediately before dispatch. Check provider content and sending-statistics policies for the actual campaign. Owner approval cannot override provider prohibition. |
| RULE-06 | [Gmail sender requirements](https://support.google.com/mail/answer/81126?hl=en) | primary_page_read | Identify recipient-domain and sender-volume scope. Verify current authentication, alignment, transport and unsubscribe requirements. Monitor applicable deliverability metrics using their actual definitions. |

Exact scoped findings, update dates and refresh triggers are in [platform_rules.json](platform_rules.json). No numeric delivery limit is generalized across providers.

## Runtime rule behavior

Resolve the intended action first. Find the official policy that applies to that platform, account type, format, market, and API version. Compare the source scope with current integration evidence. A retrieved document does not prove an account has access; a token does not prove the owner approved the action. Record both independently.

Represent policy states as verified applicable, verified inapplicable, unknown, stale, conflicting, or retrieval blocked. Unknown states can permit read-only analysis or draft preparation where appropriate, while the dependent external action remains blocked. Do not treat an old case study or training video as the current technical permission contract.

When a rule changes, invalidate only affected plans and approvals. For example, a publishing-format change may require replacing an adapter payload and re-reviewing an asset, while historical interview evidence remains valid. Preserve prior policy versions so an incident can be reconstructed.

## Proposed storage contract

Store tenant, platform resource, action type, API version, policy evidence ID, verification time, checked scope, eligibility result, reason, and next refresh trigger. Keep credentials outside knowledge documents. Enforce access in trusted server code; generated JSON cannot self-certify approval.

## Refresh and monitoring

Use change notifications and documented version lifecycles where available, plus an implementer-defined freshness policy. Recheck after role changes, new audiences, unusual provider responses, or material action changes. Avoid inventing a universal daily or monthly cadence. A high-consequence new action may require a fresh check even when yesterday's source is available.

If retrieval is blocked, preserve the attempted official URL, time, and limitation. Request a permitted documentation capture or use another authoritative official route. Never replace the missing rule with a confidently inferred limit. No live integration was exercised in creating this registry.
