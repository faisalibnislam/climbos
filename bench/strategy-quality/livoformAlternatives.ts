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
