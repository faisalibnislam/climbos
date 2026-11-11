/** Human source corrections to the saved AI draft. Offline; no website edits or AI calls. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {SeoBriefV2Schema} from "../../shared/agents/specs";
const root=resolve("bench/cache/anthropic-real-2026-11-09");
const base=JSON.parse(readFileSync(resolve(root,"livoform-seo-v6-seo.json"),"utf8")).result.output;
const livo="https://livoform.com/compare/tally",pricing="https://livoform.com/pricing",tally="https://tally.so/pricing",template="https://livoform.com/templates/client-onboarding",kit="https://livoform.com/resources/client-onboarding-kit";
const draft=`# Livoform or Tally: choose by the job

Keep Tally if its document-style editor suits you and its free connections already support your work. Try Livoform if a shared client form needs partial answers, question-level drop-off information or version history on the free plan.

We make Livoform. This comparison describes the products' published plan details, rather than independent product tests.

## What do the published plans include?

Both products publish free form-building plans. The useful difference is which features your work needs.

| What you need | Tally's published plans | Livoform's published plans |
| --- | --- | --- |
| Conditional form logic | Included free | Included free; calculations are on Core |
| Partial answers and drop-off information | Listed on Pro | Listed on every plan |
| Team collaboration | Listed on Pro | Listed on the free plan |
| A custom domain | Listed on Pro | Listed on Core |
| External connections | Several listed on the free plan | Listed on Core |

Plan details can change. Check each product's current pricing before deciding. We have left a savings calculation out: different currencies and billing options do not make a fair price comparison.

## Is a hosted form link the same as your own domain?

No. A link such as livoform.com/your-name/your-form is hosted by Livoform. It is different from publishing on your company's own domain. Compare those two needs separately.

## Which should an agency try?

Start with the handoff you need to improve. The existing client-onboarding template asks who the main contact is, what you are building, which brand details are fixed and who signs off. Read the questions before moving a real client workflow.

If free external connections are your priority, check Tally first. If shared form work and the response features above matter more, check Livoform against that same job. There is no reason to switch a form that already does what you need.

[Preview the free client-onboarding template](${template})`;
const output=SeoBriefV2Schema.parse({...base,
  title:"Livoform vs Tally: Compare Free Plans for Client Work",
  metaDescription:"Compare Livoform and Tally for client forms: team access, partial answers, connections and custom domains. See when to keep Tally or try Livoform.",
  primaryKeyword:"Livoform vs Tally",secondaryKeywords:["Tally alternative for agencies","free client onboarding form"],pageType:"comparison",intentStage:"evaluation",searchIntent:"Compare two form builders for a client-work decision.",intentEvidence:"A comparison-query hypothesis and an existing comparison URL; no SERP or measured Search Console query data supplied.",
  recommendedAction:"refresh_existing_page",targetPageUrl:livo,recommendationReason:"The directly read comparison already serves this decision. Clarify hosted links versus custom domains and retain an honest reason to keep the alternative, rather than duplicate the page.",
  answerFirst:"Keep Tally when its editor and free external connections meet your needs. Compare Livoform when shared client-form work, partial answers or version history on a free plan matter. These are published plan claims, not independently tested results.",
  outline:[{heading:"What do the published plans include?",points:["Compare the same feature and plan basis; omit unsupported MCP and payment comparisons."]},{heading:"Is a hosted form link the same as your own domain?",points:["Separate a Livoform-hosted handle from a custom domain."]},{heading:"Which should an agency try?",points:["Use the already-existing client template as one next step."]}],
  draft,internalLinks:[pricing,template,kit],
  faqs:[
    {question:"When should I keep Tally?",answer:"Keep it if the editor and its free external connections already fit your workflow. A second tool having similar features is not a reason to switch.",factIndexes:[],sourceUrls:[tally,livo]},
    {question:"Is a Livoform-hosted link a custom domain?",answer:"No. A livoform.com handle remains hosted on Livoform's domain. Its comparison and pricing pages list a custom domain separately on Core.",factIndexes:[],sourceUrls:[livo,pricing]},
    {question:"Where can I see the client-onboarding questions?",answer:"The existing template page lists the questions, including the main contact, brand details and who signs off. Preview those questions before moving a client workflow.",factIndexes:[],sourceUrls:[template]},
  ],
  originalContribution:"Correct a misleading like-for-like comparison of hosted handles and custom domains. Add a practical agency decision using a directly observed existing template, without invented savings, customer outcomes or an untested migration story.",
  originalContributionEvidence:{status:"evidence_linked",factIndexes:[],sourceUrls:[livo,pricing,tally,template]},
  citableClaims:[{statement:"Livoform's published comparison distinguishes its hosted handle from a custom domain on Core.",factIndexes:[],sourceUrls:[livo,pricing]},{statement:"Tally's pricing page lists external connections on its free plan.",factIndexes:[],sourceUrls:[tally]}],factIndexes:[],
  ownerEvidenceNeeded:["Confirm that the product still delivers the published plan features before publishing the comparison. No independent application test has been performed."],
  eeatSignals:["Disclose that Livoform publishes the comparison.","Primary plan pages inspected on 10 November 2026; this is a source-check date, not business-owner review.","Keep credentials, testimonials, product test claims and customer results out of the draft because none were supplied."],
  measurementPlan:"Propose one owner-reviewed LinkedIn document about the hosted-link distinction, linked to this existing comparison only after publication is approved. No audience or reach is assumed. If Search Console and first-party events become available, record dated comparison visits and attempts to preview the template. Compare actual observations across later cycles; sparse traffic is inconclusive. Rankings, sales and AI citations are unknown, not promised.",
  publishingDetails:{suggestedPath:"/compare/tally",proposedByline:"The Livoform team",reviewStatus:"draft_unreviewed",schemaTypes:["WebPage"],schemaNote:"Describe supported visible page content only. No review markup or rich-result/AI-citation guarantee; keep an owner-reviewed date absent until review actually occurs.",inboundLinks:[{fromUrl:"https://livoform.com/",anchor:"Compare Livoform and Tally"},{fromUrl:pricing,anchor:"Compare free form plans"},{fromUrl:kit,anchor:"Choose a form tool for client work"}]},
});
writeFileSync(resolve(root,"livoform-seo-source-corrections.json"),JSON.stringify(output,null,2));
console.log(`Prepared human source corrections: title ${output.title.length}, description ${output.metaDescription.length}. No external changes.`);
