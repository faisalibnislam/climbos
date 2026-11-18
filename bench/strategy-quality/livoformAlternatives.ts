/** Public documentation read for a separately selectable evaluation pack, never customer evidence. */
export const LIVOFORM_ALTERNATIVE_SOURCES = [
  {
    url: "https://tally.so/help/payment-forms",
    title: "Tally payment forms",
    retrievedAt: "2026-11-18T04:29:34.801947Z",
    publishedAt: null,
    responseSha256: "9e6844e93e7c8d637b129b58a84bc29a59f40a88a8f37c413cce15ba4b455b7e",
    claims: "Tally documents payments with a free or Pro Tally account and a Stripe account. It says Stripe charges apply, including applicable currency/account/country charges, and Tally adds no extra fee. The page says Stripe test cards are not supported yet and recurring payments are unavailable. This is published documentation, not a tested payment flow, eligibility determination or evidence of customer choice.",
  },
  {
    url: "https://tally.so/help/free-ai-form-builder",
    title: "Tally free AI form builder",
    retrievedAt: "2026-11-18T04:29:55.319652Z",
    publishedAt: null,
    responseSha256: "42fda3c39727c148505481669d72fb50ea1eb0d95e5862f87baf7a32b100022e",
    claims: "Tally advertises building/editing forms from prompts and recreating a form from a screenshot or PDF. It describes form creation/editing/management inside MCP-compatible assistants including Claude, ChatGPT and Cursor. The page explicitly says these connections and Tally AI are free on all plans, with no upgrade or card required for AI. Detailed fair-use limits, output quality and actual behavior have not been verified. These claims challenge a feature-only paid-value premise; they do not prove equivalent results, switching preference or worldwide novelty/absence of another mechanism.",
  },
  {
    url: "https://www.jotform.com/help/873-how-to-update-the-pdf-through-smart-pdf-forms/",
    title: "Jotform updating Smart PDF Forms",
    retrievedAt: "2026-11-18T04:30:16.019573Z",
    publishedAt: "2025-04-23",
    responseSha256: "2209b89ac4f5b326dbefdf66e2a65744f5a62e6a02c79eb9b47ea810eb636567",
    claims: "The article's displayed update date is April 23, 2025. It describes retaining mapped online-form fields when an original PDF is updated. It says PDF import creates online fields but does not copy the PDF's design into the online form. Current plan prices and end-to-end behavior were not checked. An HTTP Last-Modified header matching retrieval is not substituted for the article's displayed date.",
  },
  {
    url: "https://help.typeform.com/hc/en-us/articles/54296893018900-Autofill-answers",
    title: "Typeform autofill answers",
    retrievedAt: "2026-11-18T04:30:17.588891Z",
    publishedAt: null,
    responseSha256: "42c1b9ad841dac54865ba644e93a712ff263cb034f63a2a9a05bdb7b10f8f073",
    claims: "The help page describes prefilling open-text answers using URL parameters or enrichment variables; enrichment needs the respondent's email address. Its claimed completion/friction benefits are vendor claims, not measured effects here. Plan eligibility, limits, actual behavior and any cross-owner data portability were not verified. A failed search-tool open was followed by a successful direct public-page read.",
  },
] as const;

export function livoformAlternativesResearch() {
  return `Evidence-pack addendum public-alternatives-20261118. These current first-party competitor pages supplement the older Livoform documentation; they are not an exhaustive market review, customer interviews or tested feature comparisons. No account was accessed. Owner time, audience access and willingness to pay remain unknown. No action is authorized.\n\n${LIVOFORM_ALTERNATIVE_SOURCES.map(source => `${source.url}\nRetrieved ${source.retrievedAt}; publisher update date ${source.publishedAt ?? "unknown"}; response SHA-256 ${source.responseSha256}. Source-reported claims:\n${source.claims}`).join("\n\n")}`;
}

/** Additional reads requested by the failed comparison; never silently added to older packs. */
export const LIVOFORM_COMPARISON_SOURCES = [
  {
    url: "https://tally.so/help/plans-and-pricing",
    title: "Tally plans and pricing",
    retrievedAt: "2026-11-18T04:53:46.425903Z",
    responseSha256: "c5512819c32e604c748534de37c1ae947d810f88fa74ae2f4c30c2acf2d197a7",
    claims: "The official help page displays Tally Pro at $29/month and lists removal of Tally branding, custom domains, partial submissions and team collaboration as Pro features. This verifies a published plan claim, not tested restrictions, checkout availability, equal functionality or buyer preference. Do not infer anyone needs a paid branding feature simply because it is listed.",
  },
  {
    url: "https://tally.so/pricing",
    title: "Tally pricing page",
    retrievedAt: "2026-11-18T04:54:06.603698Z",
    responseSha256: "0a30cbf0f7f0a728e49d19df157d1d934f9717dad3febd01ac6c11a65dba1546",
    claims: "The pricing page lists payments among free features, subject to fair use. Its Pro section advertises hiding Tally branding and hosting forms on a custom subdomain. The retrieved text displays $24 per month beside monthly/yearly choices, but the selected billing mode was not established by this text-only read. Preserve that display separately from the help page's $29/month; do not turn an apparent annual equivalent into a monthly charge or declare a price conflict resolved. Taxes, checkout and the buyer's location remain unverified. No customer testimonial or example count is business evidence for Livoform.",
  },
  {
    url: "https://tally.so/help/billing-and-payment-info",
    title: "Tally billing and payment information",
    retrievedAt: "2026-11-18T05:07:24.261166Z",
    responseSha256: "bd7f71d926d00eb807e8ab8fc791bfa05e44baf87804bc9ff3e0ad19b0a90ac2",
    claims: "Tally says paid plans are charged upfront and recur for the selected month or year. Billing is in USD or EUR based on IP location; no customer geography is established here. The page explicitly says it does not offer free trials. These are published billing terms, not an accessed account or a tested purchase. Reconfirm the exact currency, billing interval, taxes and relevant plan at checkout before any public numerical comparison. Do not assume a free Pro trial or compare unlike billing periods.",
  },
] as const;

export function livoformComparisonResearch() {
  return `Evidence-pack addendum public-comparison-20261118. The earlier limitation about unchecked competing plan terms is superseded only for the dated public claims below. Product behavior, actual buyer need, account access and owner time remain unverified; no action is authorized.\n\n${LIVOFORM_COMPARISON_SOURCES.map(source => `${source.url}\nRetrieved ${source.retrievedAt}; publisher update date unknown; response SHA-256 ${source.responseSha256}. Source-reported claims:\n${source.claims}`).join("\n\n")}`;
}

/** First-party use-case evidence, not proof of demand or tested product behavior. */
export const LIVOFORM_AGENCY_SOURCES = [{
  url: "https://livoform.com/use-cases/agencies",
  title: "Livoform forms for agencies and freelancers",
  retrievedAt: "2026-11-18T06:11:52.571897Z",
  responseSha256: "9a8a72f004d0a24a89b8ec91e33bd906514a50b090cc0203969721c9a94e2471",
  claims: "The agency page describes a company per client, with separate forms, members and plan, and switching between companies. This is a product claim, not tested isolation, ownership transfer or client demand. It explicitly says a client's own logo can be put on a form on any plan, including two logos for joint work. Adding a customer logo is therefore not by itself an evidenced paid upgrade: distinguish it from removing Livoform branding, a custom domain and the appearance of a Stripe-hosted checkout. The page describes Core calculations for estimates and payments for deposits, with Pro AI replies from a supplied price list. It lists client onboarding, creative brief, quote request, website questionnaire, project handover and project feedback templates and links an onboarding kit. The template and kit destinations were not opened or tested here. Published completion times, 'complete briefs' and 'quote faster' language are not measured outcomes. No customer names, customer results or existing assets belonging to the owner are inferred from the illustrated sample. Willingness to pay, account access, founder time and operating costs remain unknown.",
}] as const;

export function livoformAgencyResearch() {
  return `Evidence-pack addendum public-agencies-20261118. The earlier limitation that the agency use-case page was uninspected is superseded only by this dated public read. Other linked pages, product behavior and buyer demand remain unverified.\n\n${LIVOFORM_AGENCY_SOURCES.map(source => `${source.url}\nRetrieved ${source.retrievedAt}; publisher update date unknown; response SHA-256 ${source.responseSha256}. Source-reported claims:\n${source.claims}`).join("\n\n")}`;
}
