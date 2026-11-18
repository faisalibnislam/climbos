/** Separately dated, first-party claims. No product session, payment or account was exercised. */
export const LIVOFORM_PUBLIC_DOCS = [
  {
    url: "https://livoform.com/help/payments",
    title: "Taking payments",
    retrievedAt: "2026-11-18T02:00:50.104256Z",
    updatedAt: "2026-10-15",
    claims: "The help page places Stripe payments in Core. It describes payments into the form owner's own Stripe account, with answers delivered after payment. It explicitly documents restricted test keys (rk_test_…) for testing without real money. Amounts can be fixed, calculated or payer-chosen above a minimum. It describes optional manual webhook setup, confirmation on return and periodic confirmation checks without a webhook, and refunds handled in Stripe. These are Livoform setup claims, not independent verification of Stripe requirements, permissions or a working payment flow.",
  },
  {
    url: "https://livoform.com/help/plans-overview",
    title: "Plans at a glance",
    retrievedAt: "2026-11-18T02:00:50.804399Z",
    updatedAt: "2026-10-26",
    claims: "Free includes unlimited forms/responses and limited built-in AI. Core is USD 2/company/month or 20/year: integrations, Stripe, branding/domain controls and calculations, but no built-in Livoform AI. Pro is USD 6/company/month or 60/year and explicitly includes everything in Core plus AI replies, logic, insights and other bounded AI features. Business is USD 19/seat/month or 190/year and includes Pro plus team controls. The company plan governs its forms. These are published entitlements/prices, not tested behavior, actual customer purchases or evidence of willingness to pay. The AI exclusion distinguishes Core from Free; do not assume every higher plan includes Free's AI.",
  },
  {
    url: "https://livoform.com/help/ai-credits",
    title: "AI allowances and credits",
    retrievedAt: "2026-11-18T02:00:51.643625Z",
    updatedAt: "2026-10-26",
    claims: "The page says allowances reset monthly and are shared within a company. Core has no Livoform AI allowance or use for credits. Free has 3 builds and 10 edits monthly. Pro has 50 builds, 25 edits, 20 AI responses and 3 insights runs; Business allowances are per seat. Pro/Business can build forms from a brief, uploaded document or existing form. These are inputs for form creation, not proof that collected answers become a client-ready deliverable. Paid credit packs supplement allowances; their retail prices do not establish Livoform's internal AI costs, contribution margin or any customer's usage.",
  },
  {
    url: "https://livoform.com/help/billing",
    title: "Billing and upgrades",
    retrievedAt: "2026-11-18T02:00:52.297370Z",
    updatedAt: "2026-10-26",
    claims: "The page directs an owner/admin to Settings → Plan for upgrades. Polar is described as merchant of record for the Livoform subscription, handling checkout, taxes and receipts. Core/Pro cover a company; Business is per seat. Plan changes require confirmation. Downgrades disable paid features while data and exports are described as retained. This subscription checkout is distinct from a form owner's Stripe collection of customer payments. No checkout, subscription change, billing permission or purchase has been tested or authorized by reading this page.",
  },
  {
    url: "https://livoform.com/features/ai-form-builder",
    title: "AI form builder",
    retrievedAt: "2026-11-18T02:00:52.875407Z",
    updatedAt: null,
    claims: "The feature page describes drafting questions, pages and logic from a natural-language description, then requesting edits and reviewing changes in the canvas. Pro/Business also accept briefs, documents and existing forms. Features outside the company plan are left out. Drafts are ordinary editable forms and remain unpublished until the owner publishes. These claims do not prove ClimbOS can build or publish the form, that a draft will function correctly, or that any owner has time to review it.",
  },
  {
    url: "https://livoform.com/integrations/chatgpt-claude",
    title: "ChatGPT and Claude integration",
    retrievedAt: "2026-11-18T02:00:53.932727Z",
    updatedAt: null,
    claims: "The page documents a custom connector with sign-in and selected permissions, plus API-key access for coding assistants. It describes reading/creating forms, editing drafts, publishing and response operations. Editing a draft and publishing are separate; deleting forms/responses is excluded. Connector access is described as available on all plans, with summaries/insights on Pro. This page was successfully read on November 18 after the November 17 retrieval failed. No connector has been connected or tested here, and these claims do not grant ClimbOS access or execution authority.",
  },
] as const;

export function livoformPublicDocsResearch() {
  return LIVOFORM_PUBLIC_DOCS.map(source => `${source.url}\nRetrieved ${source.retrievedAt}; publisher update date ${source.updatedAt ?? "unknown"}. Source-reported claims, not tested product behavior:\n${source.claims}`).join("\n\n");
}

/** Additional detail from the same saved page, deliberately separate from the frozen pack. */
export const LIVOFORM_PAYMENT_SETUP = `Evidence-pack addendum public-docs-setup-20261118.
https://livoform.com/help/payments
Retrieved 2026-11-18T02:00:50.104256Z; publisher update date 2026-10-15. Source-reported setup instructions, not a tested workflow:
The page directs the owner to Stripe's Developers → API keys → Create restricted key, granting Write for Checkout Sessions and Webhook Endpoints, then pasting it into the form's Settings → Payments. It documents rk_test_ keys for tests without real money. Pay and send opens Stripe checkout; the form owner receives the respondent's submitted answers after payment. It does not deliver a consultant's answer to the payer. The booking illustration's amounts and counts are sample data, not Livoform business inputs. Current Stripe permissions/terms, key creation and the end-to-end flow remain unverified here; no account was accessed and no action is authorized.`;
