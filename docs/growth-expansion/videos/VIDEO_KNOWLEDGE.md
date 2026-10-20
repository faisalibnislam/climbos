# Video knowledge for ClimbOS

Research date: October 20, 2026. These notes use retrieved transcripts, not a claim that a human watched the videos. The three YC transcripts were returned by Firecrawl's YouTube processor and contain automatic-caption errors. Apple's transcript was read on the official developer page. The pack retains source references and observed chapter timestamps, not copies of the transcripts. Recommendations labeled **ClimbOS design** are original proposed application rules, not quotations, demonstrated results, or installed features.

## V01 — Customer interviews

**Title:** How To Talk To Users | Startup School  
**Speaker / publisher:** Gustaf Alströmer / Y Combinator  
**Video:** https://www.youtube.com/watch?v=z1iF1c8w5Lg  
**Uploaded:** December 1, 2022; retrieved October 20, 2026.  
**Access:** Transcript and publisher description retrieved; audiovisual content not watched.  
**Observed chapter pointers:** 03:23 participant selection; 05:58 interview practice; 09:42 follow-up questions; 14:37 prototype sessions. These are publisher chapter boundaries, not word-level transcript alignment.

**Source lesson:** Understand present workflows and underlying problems before introducing a solution. Use follow-up questions, preserve interview notes, and distinguish customer problems from feature suggestions. Observe prototype use without coaching each interaction. [Video and transcript source](https://www.youtube.com/watch?v=z1iF1c8w5Lg).

**ClimbOS design:** Create a research brief with a specific decision, candidate customer, uncertain assumption, recruitment route, and interview method. Store each observation separately from the analyst's inference. A feature request should link to its associated workflow, frequency, consequence, and current workaround; it should not become a roadmap ticket automatically. When participants disagree, preserve their circumstances rather than averaging the disagreement away.

After synthesis, output a decision memo with strongest evidence, counterevidence, remaining uncertainty, and the smallest next test. A founder's friend providing praise is not interchangeable with an independent buyer describing recent expenditure. Recording and reuse require the appropriate participant permission. A model may propose interview questions and classify approved notes; it must not invent participants or responses. Playbook `video-interview-diagnostic` encodes this original workflow.

## V02 — First customers

**Title:** How to Get Your First Customers | Startup School  
**Speaker / publisher:** Gustaf Alströmer / Y Combinator  
**Video:** https://www.youtube.com/watch?v=hyYCn_kAngI  
**Uploaded:** December 29, 2022; retrieved October 20, 2026.  
**Access:** Transcript and publisher description retrieved; audiovisual content not watched.  
**Observed chapter pointers:** 00:44 manual early work; 03:40 founder sales; 08:45 funnel discussion; 13:50 charging; 15:24 reverse planning.

**Source lesson:** Early customer acquisition often requires direct founder involvement and hands-on onboarding. Track the steps between an initial contact and a customer receiving value, and use the observed funnel to plan activity. Early acquisition can differ from the channels used at scale. [Video and transcript source](https://www.youtube.com/watch?v=hyYCn_kAngI).

**ClimbOS design:** Offer an early-learning mode that prioritizes a reachable, high-fit segment and a bounded assisted pilot. Record labor as well as cash cost. Separate willingness to pay, payment, activation, and repeat value; none alone proves a repeatable business. Use measured stage conversions where available. If they are unknown, produce sensitivity scenarios rather than a precise contact target.

For example, **hypothetically**, a goal of three activated customers with assumed conversion rates of 20% from eligible conversation to pilot and 50% from pilot to activation implies 30 conversations in expectation: 3 / (0.20 × 0.50). This is a planning scenario, not a guarantee or an outreach authorization. It assumes compatible stages and stable rates, and excludes uncertainty and capacity constraints until modeled separately.

The talk's recommendations about B2B trials, outreach volume, and prices are context-specific opinions. ClimbOS should evaluate purchase risk, procurement, provider rules, and economics rather than turn those opinions into universal prohibitions. The intended Resend integration is not an assumed cold-prospecting route; sending eligibility requires current provider checks and valid recipient permission.

## V03 — Growth readiness and mechanism

**Title:** Gustaf Alstromer - How to Get Users and Grow  
**Speaker / publisher:** Gustaf Alströmer / Y Combinator  
**Video:** https://www.youtube.com/watch?v=T9ikpoF2GH0  
**Official supporting page:** https://www.ycombinator.com/blog/gustaf-alstromer-how-to-get-users-and-grow/  
**Uploaded / supporting-page publication:** September 12, 2018; retrieved October 20, 2026.  
**Access:** Transcript and chapter list retrieved; official supporting page also read.  
**Observed chapter pointers:** 15:38 retention; 20:10 growth and marketing responsibilities; 20:56 channels; 34:44 paid growth; 37:17 SEO; 45:00 experimentation; 46:32 experiment review.

**Source lesson:** Define an event that represents customer value and measure its recurrence at an appropriate frequency. Scaling acquisition before understanding repeat value can waste resources. Growth work includes product changes as well as distribution, and controlled comparisons can challenge intuitive product decisions. [Video](https://www.youtube.com/watch?v=T9ikpoF2GH0); [official publication record](https://www.ycombinator.com/blog/gustaf-alstromer-how-to-get-users-and-grow/).

**ClimbOS design:** Build a readiness record with the value event, expected use cadence, mature cohort window, retained contribution, onboarding burden, and channel eligibility. A payroll product and an occasional travel product should not share a daily-retention gate. A one-time utility may require evidence of successful completion, referrals, or adjacent demand rather than forced recurring use. Show the counts behind rates, especially for small cohorts.

Route the next decision according to the constraint: ambiguous need calls for research; broken first value calls for product repair; economically worthwhile retained demand can justify a bounded acquisition test. Keep exceptions visible: a small paid test may investigate demand before a mature retention curve exists, provided the learning objective and loss ceiling are explicit. Do not impose a universal minimum customer count.

This is a 2018 source. Its channel hierarchy, search-rendering assertions, vendor examples, and numeric outcomes are historical material, not current implementation rules. Use current official documentation for search, advertising, and analytics behavior. Preserve its strategic ideas while rejecting blanket extrapolation from large consumer platforms to every small business.

## V04 — App discovery and marketing

**Title:** Get started with app discovery and marketing  
**Presenters / publisher:** Meghana, App Store Scaled Engagement, and Chris, Apple Search Ads / Apple Developer. Surnames were not established from the retrieved transcript.  
**Video and transcript:** https://developer.apple.com/videos/play/tech-talks/110358/  
**Publication date:** Not established from the retrieved page; retrieved October 20, 2026.  
**Access:** Official page and transcript retrieved; audiovisual content not watched.  
**Timestamps:** Not exposed in the retrieved transcript; stored as null rather than invented.

**Source lesson:** App discovery can involve browsing, search, and external referrals. Product-page assets communicate the app's value; localized metadata and message-matched destinations can support discovery. App analytics help connect acquisition activity with later use. The presentation also introduces paid App Store promotion. [Official transcript](https://developer.apple.com/videos/play/tech-talks/110358/).

**ClimbOS design:** Create a platform-capability matrix before recommending an experiment: operating system, storefront, available destination, supported asset types, analytics coverage, and current feature eligibility. A feature described in a general App Store talk is not automatically available for a macOS app. Use current documentation and the actual account's eligible capabilities.

Map each intended audience to a verified product capability, a customer task, a primary screenshot message, a destination, and a downstream success event. Review a screenshot for accurate product depiction and comprehensible value before polishing decoration. Localize the whole journey where feasible: listing, onboarding, support, pricing context, and the product itself.

Report impressions, product-page visits, downloads, activation, and retained contribution with distinct denominators. A higher download rate can still acquire unsuitable users. Historical presentation figures about platform reach, ad performance, feature quotas, territories, and format requirements are not imported into runtime policy. The app-discovery playbook remains draft-only until current capability, evidence, destination, budget, and owner authority are verified.

## Shared implementation contract

The four playbooks in `playbooks.json` are proposed reference contracts. They do not grant tool permissions and are not executable production code. A ClimbOS adapter must validate inputs against trusted tenant data, produce an artifact for review, and check current action-specific authority before changing any external system. Preserve the existing OpenAI-first direction and Convex/Vercel/Resend stack unless the inspected repository or owner instructions establish a different scope.

Use a common evidence representation: observation; source; retrieval date; relevant population; inferred implication; confidence rationale; counterevidence; and invalidation trigger. For videos, distinguish publisher chapter boundaries from exact statement timestamps. For automatic captions, preserve ambiguity rather than silently promoting a garbled figure or company name to fact.

A useful evaluation is to give the engine the same goal under four different conditions: no usable interview evidence; a weak activation path; healthy retention but limited delivery capacity; and an app feature unsupported on the target platform. The recommendation should change for a clear reason. Merely mentioning all four videos in an answer is not evidence of improved judgment.

## Access and coverage boundaries

All four requested sources were retrieved at transcript level. No claims depend on third-party generated summaries. The package deliberately excludes complete transcripts, historic vendor benchmarks, and unverified capability limits. It is an original operational synthesis with source pointers, not a replacement for viewing the talks or checking current platform documentation.
