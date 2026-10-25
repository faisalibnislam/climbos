# Google Business Profile review integration readiness

Last checked against Google's official documentation: 25 October 2026. This is a compatibility and setup assessment, not evidence that ClimbOS has API access or Google approval.

## What the API supports

Google documents review listing and retrieval, and `accounts.locations.reviews.updateReply` can create or update a response on a verified location. It requires OAuth scope `https://www.googleapis.com/auth/business.manage`; a successful call returns a `ReviewReply`. Reviews now expose reply moderation state (`PENDING`, `APPROVED`, or `REJECTED`), policy-violation details, and a reply URL through documented retrieval methods.

## Access and policy conditions

- Google requires a Cloud project, an API-access application and approval, and the required Business Profile APIs enabled. The applicant must manage a verified profile that has been active for 60+ days and have a website listed on that profile.
- The API policies require prior, specific, express consent before review replies are made on an end client's behalf. They also state that end users must manually sign in and restrict third parties from using a shared developer project for automatic or programmatic changes. The permitted multi-tenant authorization and project model for a hosted ClimbOS integration is not verified here; it needs written confirmation from Google before implementation.
- Business Profile API content stored for project performance may be retained for no more than 30 calendar days, must be secure, and cannot be manipulated or aggregated. The current ClimbOS review inbox has longer-lived tenant records, so provider-sourced review text cannot simply be copied into that store.
- Google says an end client must be able to stop use of the APIs and disassociate its profile from the service and developer project; the integration design would need a tested revocation path.

## ClimbOS status and safe manual path

This repository has no Google Business Profile connection, OAuth scope, review-sync provider, or reply publisher. No API approval, eligible verified profile, account credential, or supported shared-project authorization model is established here. Therefore provider sync and reply publication are unavailable.

Owners can paste a review, optionally save its public HTTPS URL, prepare a reply in ClimbOS, open the review page, and post it themselves. Marking an item handled is not a provider receipt and must not be shown as a verified reply. This manual route does not synchronize edits or deletions and cannot confirm whether a reply was accepted or published.

Do not implement sync or reply publication until the API project is approved and Google confirms the compliant end-client access model. Any future send must be bound to the tenant, exact reviewed reply, verified location/review destination, and explicit action approval; it must read back provider state and distinguish pending, rejected, approved, and uncertain outcomes. Retain only provider data permitted by the current storage policy and provide disconnection and data-expiry behavior.

## Primary sources

All sources below are official Google documentation, accessed 25 October 2026.

- [Business Profile API prerequisites and access approval](https://developers.google.com/my-business/content/prereqs) — verified profile age, website, project, and access request requirements; page lists its last update as 28 August 2026.
- [Business Profile APIs policies](https://developers.google.com/my-business/content/policies) — third-party policy, express-consent requirement, manual sign-in, project restrictions, 30-day temporary storage limit, and disconnection obligations; page lists its last update as 28 August 2026.
- [Review reply update method](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply) — verified-location requirement, OAuth scopes, endpoint, and response contract; page lists its last update as 7 April 2026.
- [Review resource](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews) — review and reply fields, including moderation state.
- [Business Profile API latest updates](https://developers.google.com/my-business/content/latest-updates) — reply state available from 1 April 2026, policy violations from 1 July 2026, reply URLs from 24 July 2026; page lists its last update as 9 October 2026.
