/**
 * Small, source-checked creative-strategy precedent set. This is deliberately
 * not padded to 100: the source corpus currently supports eighteen reviewed cases.
 * Additions require claim-level source verification and editorial review.
 */
export interface CreativePrecedent {
  id: string;
  title: string;
  organization: string;
  sector: string;
  geography: string;
  approximateScale: string;
  businessModel: string;
  period: string;
  families: string[];
  /** Editorial transfer tags, not claims reported by the source organization. */
  transferProfile: { audiences: string[]; goals: string[]; constraints: string[]; scale: string[]; geographies: string[]; businessModels: string[] };
  convention: string;
  choice: string;
  mechanism: string;
  distinctiveness: string;
  outcome: string;
  evidenceClass: string;
  causalLimit: string;
  conditions: string[];
  transferRisk: string;
  smallBusinessAdaptation: string;
  reversibleTest: string;
  editorialStatus: "verified_primary_and_secondary" | "verified_primary";
  researchConfidence: "medium" | "low";
  accessedAt: string;
  sources: { title: string; url: string; publisher: string; publicationDate: string; accessedAt: string; sourceRole: "company_primary" | "creator_primary" | "independent_secondary"; claimRole: "action" | "outcome" | "action_and_outcome" | "context"; supports: string }[];
}

export interface CreativePrecedentContext {
  task: string;
  brief: string;
  facts: string[];
  industryBusinessTypeId?: string;
  constraints?: {
    monthlyAdBudgetUsd?: number;
    ownerHoursPerWeek?: number;
    newCustomersPerMonth?: number;
    emailAudience?: number;
    serviceArea?: string;
    businessTypes?: string[];
  };
}

export const CREATIVE_PRECEDENTS: readonly CreativePrecedent[] = [
  {
    id: "CP-001", title: "Airbnb's election cereal boxes", organization: "Airbnb", sector: "Travel marketplace / early startup", geography: "United States", approximateScale: "Pre-seed startup", businessModel: "Two-sided accommodation marketplace (then pre-launch)", period: "2008",
    families: ["distribution_partnership", "constraint_transformation", "spectacle_earned_attention"],
    transferProfile: { audiences: ["early adopters", "investors", "press"], goals: ["runway", "fundraising", "earned attention", "launch"], constraints: ["low budget", "resource constrained", "fast production", "timely hook"], scale: ["pre-launch", "pre-seed", "small startup"], geographies: ["United States"], businessModels: ["marketplace", "early venture", "consumer startup"] },
    convention: "A cash-constrained startup should focus only on its core product and conventional fundraising.",
    choice: "The founders created and sold limited election-themed cereal boxes, using design and a current cultural moment to raise cash and create a memorable story.",
    mechanism: "A productized story turned a severe funding constraint into a saleable artifact and a conversation opener. The later investor conversation is part of the reported sequence, not proof the stunt caused Airbnb's later scale.",
    distinctiveness: "It translated a live company constraint into an object people could buy and retell, using the founders' design skill and an election moment that was already salient.",
    outcome: "Airbnb says cereal proceeds kept the early company afloat; co-founder reporting describes using the proceeds to pay company debt. The exact total and counterfactual are not independently established here.",
    evidenceClass: "Company-reported action and outcome; independently reported founder account; no causal evidence for later growth.",
    causalLimit: "The cereal story coincided with other startup activity, including hosting during a large convention and accelerator fundraising. Do not infer that a stunt is a repeatable acquisition channel.",
    conditions: ["A real story that fits the product", "Fast, low-volume production", "A timely cultural hook", "An audience willing to buy or share the artifact"],
    transferRisk: "A novelty object can distract from the product, create inventory cost, or exploit a political topic without audience fit.",
    smallBusinessAdaptation: "Turn an existing customer problem, craft process, or useful tool into a small paid artifact that also demonstrates the business's point of view; do not copy the election or cereal expression.",
    reversibleTest: "Offer a preorder for a tiny batch to a small, permissioned audience; stop before production unless paid demand covers the stated cost.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "A letter from co-founder Nathan Blecharczyk", url: "https://news.airbnb.com/a-letter-from-co-founder-nathan-blecharczyk", publisher: "Airbnb Newsroom", publicationDate: "2022", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action", supports: "Founders made Obama O's and Captain McCain's; the unusual story was shared in the Y Combinator interview." },
      { title: "Airbnb's Surprising Path to Y Combinator", url: "https://www.wired.com/2017/02/airbnbs-surprising-path-to-y-combinator/", publisher: "WIRED", publicationDate: "2017-02-23", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "action_and_outcome", supports: "Independent retrospective account of the cereal effort and early company context." },
    ],
  },
  {
    id: "CP-002", title: "Patagonia's 'Don't Buy This Jacket' message", organization: "Patagonia", sector: "Outdoor apparel", geography: "United States", approximateScale: "Established specialist retailer", businessModel: "Premium branded apparel retail", period: "2011 onward",
    families: ["distinctive_identity", "customer_experience_retention", "product_service_design"],
    transferProfile: { audiences: ["sustainability minded buyers", "durability focused customers"], goals: ["trust", "differentiation", "retention", "brand meaning"], constraints: ["credible operations", "repair capability", "mission consistency", "long term proof"], scale: ["established retailer", "specialist brand"], geographies: ["United States"], businessModels: ["premium retail", "apparel", "durable products"] },
    convention: "A retailer should maximize immediate sales messaging during the largest shopping weekend.",
    choice: "Patagonia ran a Black Friday ad asking customers to consider the environmental cost and buy less, while connecting the message to repair, reuse, and product durability practices.",
    mechanism: "The message could signal consistency between a stated environmental position and customer guidance. The fit depended on prior practices and a durable product proposition, not contrarian wording alone.",
    distinctiveness: "The counter-message was linked to Patagonia's stated footprint position and repair/reuse practices; a provocative headline without those operating choices would not be the same mechanism.",
    outcome: "An IMD case-study summary reports sales rose about 30% in the nine months after the ad. This is a before/after association, not evidence that the ad caused the rise. Patagonia's own retrospective confirms the ad and its stated purpose.",
    evidenceClass: "Action company-reported and independently documented; outcome secondary case-study report; causal effect unestablished.",
    causalLimit: "No counterfactual isolates the ad from product, brand, distribution, seasonality, or other concurrent factors. The sales statistic is secondary and should not become an expected uplift.",
    conditions: ["Credible, long-standing customer value beyond the message", "Operational practices that support the claim", "Customers who value restraint and durability"],
    transferRisk: "Anti-selling without credible proof can look manipulative or damage demand; a sales lift is not guaranteed and may conflict with business economics.",
    smallBusinessAdaptation: "Identify a purchase the customer should delay, avoid, repair, or configure differently when that is truly in their interest; explain the tradeoff and provide a useful alternative.",
    reversibleTest: "Compare one honest, evidence-backed decision guide against the usual sales message with a small audience; measure qualified inquiries and returns/support guardrails, not clicks alone.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Don't Buy This Jacket, Black Friday and the New York Times", url: "https://www.patagonia.com/stories/planet/activism/dont-buy-this-jacket-black-friday-and-the-new-york-times/story-18615.html", publisher: "Patagonia Stories", publicationDate: "2011-11-25 (updated 2022)", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action", supports: "Ad, date, and company's stated purpose and rationale." },
      { title: "Patagonia's sustainability strategy: Don't buy our products", url: "https://www.imd.org/research-knowledge/sustainability/case-studies/patagonia-s-sustainability-strategy-don-t-buy-our-products/", publisher: "IMD", publicationDate: "2016", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "outcome", supports: "Secondary report of the approximate post-ad sales change and its time window." },
    ],
  },
  {
    id: "CP-003", title: "Nike's waffle-sole product experiment", organization: "Nike", sector: "Athletic footwear", geography: "United States", approximateScale: "Early-stage footwear company; exact scale not verified", businessModel: "Designed and sold athletic footwear", period: "1971–1975",
    families: ["product_service_design", "constraint_transformation", "customer_participation"],
    transferProfile: { audiences: ["athletes", "product users", "builders"], goals: ["product differentiation", "performance", "product learning"], constraints: ["prototype", "field test", "low cost iteration", "external expertise"], scale: ["early stage", "small team"], geographies: ["United States"], businessModels: ["physical product", "footwear", "consumer product"] },
    convention: "Running traction should be solved through familiar footwear design and conventional development resources.",
    choice: "Bill Bowerman used a waffle-iron pattern as a prototype prompt, iterated with local tradespeople, and let athletes test early versions before the product evolved into the Waffle Trainer.",
    mechanism: "A constraint-led prototype borrowed a pattern from outside the category, then moved through repeated field tests. The transferable mechanism is cross-domain observation plus low-cost iteration, not copying the shoe design.",
    distinctiveness: "The waffle pattern was converted from an outside-domain observation into repeated athlete-tested prototypes that changed the product, rather than used as a surface-level campaign reference.",
    outcome: "Nike's archive reports the Waffle Trainer became its most popular running model and that orders topped 100,000 units by 1975. This is company-reported historical evidence, not independent causal analysis.",
    evidenceClass: "Company-reported historical account; quantitative outcome stated by Nike; no independent reanalysis.",
    causalLimit: "The product success reflects several design, athlete, distribution, and market factors; the waffle inspiration alone cannot be isolated as causal.",
    conditions: ["A real customer problem with an observable performance constraint", "Access to a small group of users for safe prototypes", "Capability to iterate and produce reliably"],
    transferRisk: "Analogy can become superficial; prototyping an untested change can introduce safety or quality defects.",
    smallBusinessAdaptation: "Observe how customers solve the problem with tools from another domain; prototype one small improvement with a few consenting users before scaling.",
    reversibleTest: "Build a non-production mock or supervised prototype and test task completion, failure modes, and willingness to continue with a small user group.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "From Waffle Iron to World Stage: The True Story of the Nike Moon Shoe", url: "https://about.nike.com/en/magazine/nike-moon-shoe-waffle-iron-true-history", publisher: "NIKE, Inc. Archives", publicationDate: "2025-09-15", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "Prototype mechanism, athlete testing, product sequence, and reported 100,000 orders." },
    ],
  },
  {
    id: "CP-004", title: "Mario: designing a character around constraints and reuse", organization: "Nintendo", sector: "Video games and entertainment", geography: "Japan / global", approximateScale: "Established game maker; exact initial scale not verified", businessModel: "Video-game design and publishing", period: "1981 onward",
    families: ["distinctive_identity", "constraint_transformation", "product_service_design"],
    transferProfile: { audiences: ["players", "children", "families", "game audiences"], goals: ["recognition", "character recall", "product differentiation"], constraints: ["hardware limits", "technical limits", "reusable assets", "limited visual detail"], scale: ["early game development", "established publisher"], geographies: ["Japan", "global"], businessModels: ["video game", "entertainment", "digital product"] },
    convention: "A character's design should begin with detailed realism or a fully developed backstory.",
    choice: "Miyamoto describes designing Mario within severe sprite limits: a hat reduced the need to draw hair, a moustache avoided a detailed mouth, and overalls separated body parts. He also described wanting a character he could use across games.",
    mechanism: "Visible constraints produced a simple, recognizable form that could recur across different game contexts. This is a design mechanism under a particular medium and production system, not evidence that every brand needs a mascot.",
    distinctiveness: "The visual details solved concrete sprite constraints and supported reuse across different games; Mario's later cultural status is not evidence that a newly invented mascot will perform similarly.",
    outcome: "Nintendo's official history documents Mario titles spanning decades, while its character page describes the red cap, blue overalls, and moustache as instantly recognizable. These are company statements; no causal estimate links the original design choices to business outcomes.",
    evidenceClass: "Creator interview and company history; recognition claim company-reported; no causal or independent brand-equity estimate.",
    causalLimit: "The character's endurance also depends on game quality, distribution, Nintendo's IP stewardship, and repeated releases. A small business cannot infer that mascot creation will create recognition.",
    conditions: ["A recurring product or service context where the identity can accrue meaning", "Clear audience recognition cues", "Consistent use and stewardship over time"],
    transferRisk: "A forced mascot can feel childish, generic, expensive to maintain, or legally too similar to existing IP. Never copy Mario's expression, design, name, or trade dress.",
    smallBusinessAdaptation: "Test a distinctive recurring character, founder voice, or visual cue derived from the business's own customer language and operating quirks, while keeping the offer legible.",
    reversibleTest: "Show two original, legally reviewed identity directions to a small set of target customers; measure unaided recall and correct offer comprehension before investing in a full system.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Iwata Asks: The Reason Mario Wears Overalls", url: "https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-New-Super-Mario-Bros-Wii/Volume-1/2-The-Reason-Mario-Wears-Overalls/2-The-Reason-Mario-Wears-Overalls-210759.html", publisher: "Nintendo UK", publicationDate: "2009", accessedAt: "2026-10-25", sourceRole: "creator_primary", claimRole: "action", supports: "Miyamoto's description of pixel constraints and design decisions." },
      { title: "E3 Video: Miyamoto talks about creating Mario", url: "https://www.latimes.com/archives/blogs/technology-blog/story/2009-06-04/e3-video-miyamoto-talks-about-creating-mario", publisher: "Los Angeles Times", publicationDate: "2009-06-04", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "action", supports: "Interview report that Miyamoto wanted a character usable across his games." },
      { title: "The official home of Super Mario: History", url: "https://mario.nintendo.com/history/", publisher: "Nintendo", publicationDate: "Undated", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "context", supports: "Official chronology of releases from 1985 onward." },
    ],
  },
  {
    id: "CP-005", title: "LEGO turns fan submissions into a bounded product-development route", organization: "The LEGO Group", sector: "Toys and construction play", geography: "Japan, then global", approximateScale: "Established global manufacturer; exact pilot scale not verified", businessModel: "Consumer products with a fan-supported licensing and product-selection program", period: "2008 onward",
    families: ["customer_participation", "product_service_design", "distribution_partnership"],
    transferProfile: { audiences: ["fans", "collectors", "product enthusiasts"], goals: ["co creation", "product validation", "community participation", "product development"], constraints: ["community moderation", "intellectual property", "selection rules", "long development cycle"], scale: ["pilot", "established manufacturer"], geographies: ["Japan", "global"], businessModels: ["consumer products", "toys", "licensing"] },
    convention: "Product development is primarily an internal process; customers can provide feedback but should not help select products.",
    choice: "LEGO piloted CUUSOO with a Japanese crowdsourcing platform, then developed LEGO Ideas so fans could submit concepts and build support before a review board selected products.",
    mechanism: "A permissioned participation funnel can surface committed fan interest before internal product review while also giving fans a visible role. Support thresholds are an input to review, not proof of broad demand or a guarantee of production.",
    distinctiveness: "The company formalized a recurring fan-to-review-to-product pathway, rather than using one-off ideation contests as a substitute for product research.",
    outcome: "LEGO reports that the pilot exceeded half a million members and led to a more robust platform. In 2018 it reported more than one million members, over 26,000 submitted ideas, and 23 released sets across CUUSOO/Ideas. These are company-reported counts, not causal evidence of incremental sales.",
    evidenceClass: "Company-reported history and participation metrics; no independent causal estimate of product success or revenue impact.",
    causalLimit: "Membership and submission volume do not establish buyer demand, incremental sales, or representative customer preferences; selected products also face LEGO's review and production constraints.",
    conditions: ["Customers have relevant creative knowledge or strong product use", "The organization can review, prototype, and fulfill selected ideas", "Rules, ownership, eligibility, and selection criteria are transparent"],
    transferRisk: "An open call can attract low-fit ideas, overrepresent highly engaged fans, create IP or moderation burdens, and raise expectations that every popular idea will ship.",
    smallBusinessAdaptation: "Invite a small, relevant customer group to submit or rank one narrowly scoped improvement, while clearly stating that feedback informs but does not guarantee a roadmap decision.",
    reversibleTest: "Run a two-week, permissioned request for one product improvement with a small customer cohort; compare useful, feasible suggestions and follow-up behavior with normal feedback, then stop before promising delivery.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "LEGO Ideas | LEGO History", url: "https://www.lego.com/en-us/history/articles/j-lego-ideas", publisher: "The LEGO Group", publicationDate: "Undated", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "CUUSOO pilot in Japan, global expansion, two pilot ideas becoming sets, growth beyond half a million members, and the 2014 transition to LEGO Ideas." },
      { title: "Celebrating 10 Years of Crowdsourcing and Co-creation with LEGO Fans", url: "https://www.lego.com/en-us/aboutus/news/2019/october/ideas-10th-anniversary", publisher: "The LEGO Group", publicationDate: "2018-11-08", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "outcome", supports: "Company-reported 1 million members, 26,000 ideas, 166 ideas reaching 10,000 supporters, and 23 sets released." },
    ],
  },
  {
    id: "CP-006", title: "Amazon keeps negative product reviews visible", organization: "Amazon.com", sector: "Online retail", geography: "United States", approximateScale: "Early online retailer; launched in 1995, scale at feature launch not specified in the source", businessModel: "Online marketplace and retailer", period: "1995 onward; described in 2004",
    families: ["customer_experience_retention", "product_service_design", "constraint_transformation"],
    transferProfile: { audiences: ["online shoppers", "product researchers", "buyers seeking trustworthy feedback"], goals: ["purchase confidence", "trust", "customer decision quality"], constraints: ["moderation", "negative feedback", "short term lost sales", "authentic reviews"], scale: ["early online retailer", "small commerce"], geographies: ["United States"], businessModels: ["online retail", "marketplace", "consumer commerce"] },
    convention: "A seller should suppress customer criticism that may reduce immediate purchases.",
    choice: "Amazon introduced customer product reviews shortly after launch and continued to allow negative or lukewarm reviews despite vendor complaints and acknowledged short-term lost sales.",
    mechanism: "Visible mixed feedback can help customers make a more informed decision, even when it lowers conversion on some products. The mechanism is decision usefulness and trust, not indiscriminate display of every unverified claim.",
    distinctiveness: "The choice accepted short-term lost sales in service of a stated long-term customer decision benefit; the shareholder letter explicitly describes the tradeoff.",
    outcome: "In a 2004 shareholder letter, Jeff Bezos described reviews as a routine site practice and said negative reviews had sometimes changed his own purchase decisions; the letter makes no measured estimate of the feature's net long-term effect.",
    evidenceClass: "Primary company-reported retrospective account; qualitative adoption and founder-reported experience; no quantified causal outcome for reviews.",
    causalLimit: "A shareholder letter states management's rationale but does not independently establish customer trust, incremental sales, or net long-run value caused by reviews.",
    conditions: ["Reviews are authentic, relevant, and governed by clear moderation rules", "Customers need decision evidence that the seller cannot credibly provide alone", "The business can tolerate and respond to accurate criticism"],
    transferRisk: "Unmoderated abuse, fake reviews, privacy disclosures, or misleading claims can harm customers and violate platform rules or law. Review requests must remain neutral and ungated.",
    smallBusinessAdaptation: "Provide a fair, transparent way to surface verified customer feedback, including criticism, and respond with specific fixes rather than filtering by sentiment.",
    reversibleTest: "For one eligible product or service, publish a neutral feedback summary with consent and moderation safeguards; measure qualified questions, returns or complaint resolution, while tracking trust and privacy concerns.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "2003 Annual Report: Letter to Shareholders", url: "https://ir.aboutamazon.com/files/doc_financials/annual/Annual_Report_2003041304.pdf", publisher: "Amazon.com, Inc.", publicationDate: "2004", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "Reviews launched shortly after the 1995 site launch; vendor objections, founder-reported effect of negative reviews on purchase decisions, and the qualitative short-term sales tradeoff." },
    ],
  },
  {
    id: "CP-007", title: "REI closes on Black Friday and invites people outdoors", organization: "REI Co-op", sector: "Outdoor retail and recreation", geography: "United States", approximateScale: "Large cooperative retailer; 143 stores and about 12,000 employees in 2015", businessModel: "Member-owned specialty retailer with outdoor classes, trips, and nonprofit partnerships", period: "2015 onward",
    families: ["distinctive_identity", "distribution_partnership", "customer_participation", "constraint_transformation", "spectacle_earned_attention"],
    transferProfile: { audiences: ["outdoor community", "local customers", "employees", "nonprofit partners"], goals: ["community participation", "brand trust", "earned attention", "shared ritual"], constraints: ["missed sales day", "employee time", "local partner capacity", "safe accessible activity"], scale: ["large retailer", "small business adaptation"], geographies: ["United States", "local"], businessModels: ["specialty retail", "cooperative", "community service"] },
    convention: "A retailer should open on Black Friday to capture one of the busiest shopping days.",
    choice: "REI closed its stores, headquarters, and distribution centers, paid employees for the day off, and invited the public and partner organizations to spend Black Friday outdoors.",
    mechanism: "A costly operating choice made the brand's outdoor purpose observable, then gave customers, nonprofits, parks, and community groups a simple shared ritual. Participation is evidence of resonance, not evidence of incremental sales.",
    distinctiveness: "The company altered its own operations and employee schedule instead of making only a promotional claim, and invited partners to turn a brand message into a local activity.",
    outcome: "REI's 2015 report says more than 1.4 million supporters and 175 organizations and companies joined the first campaign; its November 2015 newsroom report described nearly one million endorsements before Black Friday. These are company-reported participation figures, not independently audited customer or revenue outcomes.",
    evidenceClass: "Company-reported action and participation, with dated contemporary reporting; no causal sales estimate.",
    causalLimit: "The participation counts do not establish new customers, sales lift, or that the campaign alone created longer-term brand value. REI had a large member base, employees, stores, and outdoor nonprofit relationships that most small businesses lack.",
    conditions: ["A real business purpose that customers already value", "Ability to absorb the missed trading day and pay employees", "A safe, accessible activity customers can join", "Local partners who can add useful participation"],
    transferRisk: "Copying the closure without financial capacity or authentic connection to the mission may harm revenue and look performative. Outdoor activities also require accessibility and safety planning.",
    smallBusinessAdaptation: "Replace a promotional day with a small, relevant customer ritual, service day, or partner activity tied to a real business value; keep the scale and cost within actual capacity.",
    reversibleTest: "Run one low-cost local event or useful service ritual on a traditionally promotional date; track eligible attendance, qualified inquiries, repeat participation, partner effort, and the opportunity cost of time or sales.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "REI’s #OptOutside Movement Close to 1 Million Mark as Black Friday Approaches", url: "https://www.rei.com/newsroom/article/reis-optoutside-movement-close-to-1-million-mark-as-black-friday-approaches", publisher: "REI Co-op Newsroom", publicationDate: "2015-11-23", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "The 2015 closure, paid day off for about 12,000 employees, store and distribution-center scope, nearly one million endorsements before Black Friday, and partner participation." },
      { title: "2015 Stewardship Report", url: "https://www.rei.com/dam/18553215_impact-report-2015.pdf", publisher: "REI Co-op", publicationDate: "2016", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "outcome", supports: "REI's reported post-campaign count of more than 1.4 million supporters and 175 organizations and companies." },
    ],
  },
  {
    id: "CP-008", title: "Dollar Shave Club coordinates a founder-led launch video", organization: "Dollar Shave Club", sector: "Personal care and subscription commerce", geography: "United States", approximateScale: "Early startup at launch; size not reported", businessModel: "Direct-to-consumer razor subscription", period: "2012",
    families: ["founder_presence", "content_entertainment", "distribution_partnership", "constraint_transformation"],
    transferProfile: { audiences: ["early adopters", "value seeking buyers", "press"], goals: ["launch awareness", "subscriber acquisition", "earned media", "explain offer"], constraints: ["low production budget", "founder time", "website capacity", "fulfillment capacity"], scale: ["early startup", "small team"], geographies: ["United States"], businessModels: ["subscription", "direct to consumer", "personal care"] },
    convention: "A new commodity product needs conventional product advertising and a large production budget to introduce itself.",
    choice: "The founder starred in a low-cost comedic YouTube video explaining the offer, coordinating the release with the website relaunch, a seed-funding announcement, and the week before SXSW.",
    mechanism: "A clear value proposition and founder's comic delivery created a distinctive story; coordinated timing gave press multiple reasons to cover the launch. The traffic spike also overwhelmed the company's site, exposing an operational dependency.",
    distinctiveness: "The founder acted as the brand's recognizable narrator and combined the product explanation, fundraising news, website relaunch, and a relevant media moment into one launch window.",
    outcome: "In a 2015 first-person interview, founder Michael Dubin said the video cost about $4,500, the site crashed for 24 hours, then gained 12,000 subscribers by the next day and reached three million views within days. These are founder-reported retrospective figures; the video was not tested against a counterfactual.",
    evidenceClass: "Founder-reported action and early metrics published in an independent interview; no causal estimate beyond the reported launch sequence.",
    causalLimit: "The launch also included a financing announcement, website relaunch, press timing, product demand, and other work. Views and signups in one launch do not show that comedy or founder presence alone caused adoption or predict a result for another business.",
    conditions: ["A founder who can explain the product clearly and comfortably", "A real customer pain point with a concise offer", "Reliable checkout, inventory, and service capacity for a traffic spike", "A distribution moment with relevant press or audience fit"],
    transferRisk: "Copying the tone or viral-video format can look derivative, attract unqualified attention, or expose a fragile fulfillment system. Humor may not fit a sensitive or high-trust purchase.",
    smallBusinessAdaptation: "Have the owner demonstrate one useful product truth in their natural voice, using an inexpensive, short format only if the audience consumes that format; make capacity checks part of launch planning.",
    reversibleTest: "Show one low-cost founder explanation to a small relevant audience before a broad launch; compare qualified visits, checkout starts, signups, and support load with the usual product explanation.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "How Dollar Shave Club Rode a Viral Video to Sales Success", url: "https://www.inc.com/magazine/201507/diana-ransom/how-youtube-crashed-our-website.html", publisher: "Inc.", publicationDate: "2015-06-23", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "action_and_outcome", supports: "A first-person founder account of the $4,500 production, coordinated launch timing, 24-hour site outage, 12,000 new subscribers the next day, and three million views within days." },
    ],
  },
  {
    id: "CP-009", title: "Warby Parker lets online eyewear shoppers try frames at home", organization: "Warby Parker", sector: "Eyewear retail", geography: "United States and Canada", approximateScale: "Early online-only retailer when launched; later a public omnichannel company", businessModel: "Direct-to-consumer eyewear with later retail and eye-care services", period: "2010–2025",
    families: ["product_service_design", "customer_experience_retention", "constraint_transformation"],
    transferProfile: { audiences: ["online eyewear shoppers", "buyers with product uncertainty"], goals: ["conversion", "purchase confidence", "brand awareness"], constraints: ["shipping cost", "return logistics", "inventory", "customer support capacity"], scale: ["early online retailer", "small business pilot"], geographies: ["United States", "Canada"], businessModels: ["direct to consumer", "eyewear", "retail"] },
    convention: "Prescription eyewear is difficult to sell online because customers need to see frames on their own face before choosing.",
    choice: "Warby Parker shipped a set of five selected frames for a five-day at-home try-on, free to the customer, while it initially sold frames online.",
    mechanism: "The physical trial reduced uncertainty and returned an offline product-selection behavior to an online purchase path. It also required reverse logistics, inventory, and customer support, so the mechanism depended on operational capability.",
    distinctiveness: "It made the product's biggest online limitation—the inability to try eyewear in person—into a branded acquisition and decision experience rather than hiding the limitation.",
    outcome: "The company's 2022 SEC-filed annual report described Home Try-On as a viral brand-awareness program and reported an exceptionally high conversion rate among Home Try-On purchases. In 2025, the company said it sunset the program as its omnichannel presence scaled, while describing it as foundational to the brand. The conversion description is company-reported and unquantified; the later sunset shows the model's usefulness can change with stage and channel mix.",
    evidenceClass: "Company-reported in SEC filings; qualitatively described business role, with no public causal estimate for incremental sales.",
    causalLimit: "The filing does not publish the conversion rate or isolate Home Try-On's effect from its design, price, marketing, service, or retail expansion. Its later sunset is not proof that trial programs are generally ineffective.",
    conditions: ["A product with high pre-purchase uncertainty that a sample can resolve", "Affordable shipping, cleaning, return, and inventory processes", "A clear return path and time limit", "Enough conversion or learning value to justify fulfillment cost"],
    transferRisk: "A free sample can create high return cost, damage, fraud, or an unprofitable customer-acquisition path if trial users do not convert or the item is expensive to fulfill.",
    smallBusinessAdaptation: "Offer a tiny, trackable sample, consultation, or reversible demonstration for one high-uncertainty purchase, and set an explicit cost and capacity limit before launch.",
    reversibleTest: "Pilot the smallest sample set with a bounded group; compare qualified conversion and returns/support cost against a matched standard path, then stop if contribution or capacity guardrails fail.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Warby Parker 2022 Annual Report", url: "https://www.sec.gov/Archives/edgar/data/1504776/000150477623000006/wrby-20221231.htm", publisher: "U.S. Securities and Exchange Commission", publicationDate: "2023-03-01", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "Five frames for five days at home, the company's claim that the program built brand awareness and had a high conversion rate, and the described online uncertainty it was designed to reduce." },
      { title: "Warby Parker 2025 Annual Report", url: "https://www.sec.gov/Archives/edgar/data/1504776/000110465926050446/tm2612757d2_ars.pdf", publisher: "U.S. Securities and Exchange Commission", publicationDate: "2026", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "context", supports: "The company says it sunset Home Try-On at the end of 2025 as its omnichannel presence scaled and calls the program foundational to its brand." },
    ],
  },
  {
    id: "CP-010", title: "Liquid Death gives canned water a heavy-metal identity", organization: "Liquid Death", sector: "Beverages", geography: "United States", approximateScale: "Small company at product launch; later venture-backed national brand", businessModel: "Packaged water and beverages sold direct and through retail", period: "2017–2023",
    families: ["distinctive_identity", "content_entertainment", "constraint_transformation", "customer_participation"],
    transferProfile: { audiences: ["identity seeking consumers", "younger beverage buyers", "social audiences"], goals: ["differentiation", "attention", "community", "distribution"], constraints: ["brand safety", "retail eligibility", "packaging cost", "production capacity"], scale: ["small company", "venture backed"], geographies: ["United States"], businessModels: ["beverage", "consumer brand", "packaged goods"] },
    convention: "Water brands should foreground purity, luxury, or wellness cues, and product advertising should wait until physical product is available.",
    choice: "Liquid Death tested a humorous, heavy-metal brand concept and mock-up cans online before manufacturing product, then sold water in tallboy-style aluminum cans with a deliberately provocative name and visual identity.",
    mechanism: "The presentation made a low-differentiation commodity legible as an identity and entertainment choice; pre-product reactions gave the founders cheap directional feedback. Attention and follower counts are not evidence of repeat purchase or profit.",
    distinctiveness: "It transferred visual and verbal codes associated with music and energy drinks into still water, including a bold brand name and can format that invited people to notice and discuss the product.",
    outcome: "The Washington Post reported that the pre-product concept was tested with about $2,000 in Facebook ads and attracted followers/comments; first-year sales after launch reached $3 million, and by 2023 the brand was sold in 90,000 locations. The dollar and distribution figures are source-reported, not audited causal effects of the branding.",
    evidenceClass: "Independent secondary reporting of founder-reported actions and business figures; qualitative evidence of attention and distribution, not causal evidence that the brand expression alone produced sales.",
    causalLimit: "The company also raised capital, expanded retail distribution, added product variants, and operated with a team and marketing capabilities that smaller businesses may not have. Followers, locations, and sales are different measures and should not be treated as interchangeable.",
    conditions: ["An audience segment that welcomes irreverent identity cues", "A product and fulfillment system that can meet demand", "A brand voice that can be sustained across product, service, and community", "Honest, substantiated environmental claims if packaging is positioned as a sustainability benefit"],
    transferRisk: "Provocation can alienate important buyers or partners; an edgy name can create regulatory, retail, or brand-safety friction. Aluminum's environmental impact is not automatically lower in every lifecycle context.",
    smallBusinessAdaptation: "Test one ownable, audience-fit point of view using a mock-up, concept page, or small batch before committing to expensive packaging, inventory, or brand change.",
    reversibleTest: "Present two clearly labeled concepts to qualified target buyers and measure comprehension, preference with reasons, and willingness to take a meaningful next step; do not treat social reactions as sales evidence.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Liquid Death is a mindset. And also just canned water.", url: "https://www.washingtonpost.com/lifestyle/2023/06/17/liquid-death-water-brand/", publisher: "The Washington Post", publicationDate: "2023-06-17", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "action_and_outcome", supports: "Founder context for the unusual water brand and tallboy packaging; reported $2,000 pre-product concept test, first-year sales, 2023 retail distribution, and the distinction between early attention and later product availability." },
    ],
  },
  {
    id: "CP-011", title: "Spotify turns personal listening history into a shareable annual ritual", organization: "Spotify", sector: "Music streaming", geography: "Global", approximateScale: "Large global subscription and advertising platform", businessModel: "Freemium music streaming with subscription and advertising revenue", period: "Annual Wrapped campaigns; 2025 share count reported in 2026",
    families: ["personalization", "customer_participation", "content_entertainment", "referral_word_of_mouth"],
    transferProfile: { audiences: ["existing users", "fans", "social audiences", "music listeners"], goals: ["retention", "sharing", "referral", "personalization", "community"], constraints: ["reliable first-party data", "privacy", "annual cadence", "shareable format", "editorial review"], scale: ["large platform", "established product"], geographies: ["global", "multi-market"], businessModels: ["subscription", "freemium", "digital product", "media"] },
    convention: "A year-end campaign should mainly advertise the product or summarize aggregate company performance.",
    choice: "Spotify packages each user's listening history into a personalized annual experience and shareable creative, then supports that ritual with broader editorial and real-world campaign work.",
    mechanism: "A useful personal reflection becomes an identity-bearing artifact the user can choose to share. The mechanism depends on meaningful underlying data, an output users understand, consent-aware controls, and a product that can generate the experience reliably; sharing itself is not a customer or revenue outcome.",
    distinctiveness: "The audience is invited to distribute a story about itself, rather than repeat a brand slogan. The recap is grounded in a user's actual product behavior and returns that data in a designed format.",
    outcome: "Spotify reported that Wrapped generated more than 620 million shares in 2025. That is a company-reported sharing count, not a count of unique people, new customers, incremental subscriptions, or revenue caused by Wrapped.",
    evidenceClass: "Company-reported product and campaign description plus company-reported share count; no causal estimate of retention, acquisition, or revenue impact.",
    causalLimit: "The public source does not define whether shares are unique, how repeat shares are counted, or what conversion followed. Spotify has exceptional first-party data, global reach, and distribution; those conditions do not transfer to a small business by default.",
    conditions: ["A permissioned, accurate first-party data source", "A customer-level insight that is useful or identity-relevant", "A share format that reveals no sensitive information by default", "A clear follow-up path that does not make sharing a condition of product value"],
    transferRisk: "A thin recap can feel like surveillance or vanity content; incorrect data can damage trust. A high share count may produce no qualified visits or customers, and a forced-sharing mechanic can undermine customer experience.",
    smallBusinessAdaptation: "Create an optional, accurate milestone or progress recap from data the customer already expects the business to use, and make the private view useful even if it is never shared.",
    reversibleTest: "Offer one opt-in recap to a small eligible customer group; measure successful delivery, customer comprehension, voluntary shares, qualified visits, signups, and support/privacy concerns separately. Continue only if the recap is accurate and customers find it useful; stop on a material privacy or trust issue.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "The Art and Science Behind Spotify Wrapped", url: "https://newsroom.spotify.com/2024-12-04/the-art-and-science-behind-spotify-wrapped/", publisher: "Spotify Newsroom", publicationDate: "2024-12-04", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action", supports: "Spotify describes Wrapped as a personalized look back at listening behavior combining user-specific data and editorial context." },
      { title: "Spotify's 2026 Investor Day Recap", url: "https://newsroom.spotify.com/2026-05-21/investor-day-recap/", publisher: "Spotify Newsroom", publicationDate: "2026-05-21", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "outcome", supports: "Spotify reports more than 620 million shares of Wrapped in 2025; it does not establish unique sharers or incremental commercial impact." },
    ],
  },
  {
    id: "CP-012", title: "IKEA connects product resale with a customer buyback service", organization: "IKEA U.S.", sector: "Furniture retail", geography: "United States; participating stores only", approximateScale: "Large national retailer", businessModel: "Furniture retail with store-credit buyback and resale", period: "FY2024 program and current service description",
    families: ["product_service_design", "customer_experience_retention", "circular_distribution", "distinctive_identity"],
    transferProfile: { audiences: ["value-conscious shoppers", "existing customers", "sustainability-minded buyers"], goals: ["retention", "repeat purchase", "affordability", "product lifecycle", "differentiation"], constraints: ["reverse logistics", "inspection", "resale space", "local eligibility", "inventory handling"], scale: ["established retailer", "multi-location operator"], geographies: ["United States", "local markets"], businessModels: ["retail", "physical product", "furniture", "resale"] },
    convention: "A retailer's customer relationship ends at the original sale, while used products are handled outside the brand's commerce system.",
    choice: "IKEA buys back eligible used furniture from members for store credit and offers accepted items for resale through participating stores' As-Is areas; it also describes parts and circular services as related customer offers.",
    mechanism: "A resale path can address affordability and give an existing product another use while creating a return visit and recirculating inventory through the retailer. This requires inspection, local eligibility, handling capacity, and a financially workable resale path.",
    distinctiveness: "The customer can return a product to the same brand's system for a second commercial life, connecting after-sale service, resale supply, and a new purchase opportunity.",
    outcome: "IKEA U.S. reported that almost all its U.S. stores had implemented Buy back & resell by the end of FY2024 and that more than 2,700 products were eligible for buyback and resale in-store and online. These are company-reported operational counts, not proof of incremental profit, environmental impact, or customer retention.",
    evidenceClass: "Company-reported service description and FY2024 operational counts; no public causal estimate of sales, margin, retention, or environmental impact.",
    causalLimit: "The cited company report does not disclose the program's unit economics, resale sell-through, total customer use, or a comparison group. Availability is local, item eligibility is limited, and IKEA's store network and logistics are not transferable to most small businesses.",
    conditions: ["Products retain resale, repair, refill, or reuse value", "The business can inspect and safely handle returned items", "Local law and product rules permit the resale route", "The economics include collection, storage, refurbishment, and support costs"],
    transferRisk: "Reverse logistics can cost more than resale value; poorly assessed goods create safety, quality, warranty, or fraud issues. Sustainability claims require lifecycle evidence rather than assuming resale is always better.",
    smallBusinessAdaptation: "For a durable product or equipment business, test a limited trade-in, repair, refill, or certified-preowned offer with clear condition rules and a cost cap before promising broad eligibility.",
    reversibleTest: "Run a small, owner-reviewed pilot for one eligible product class in one service area; record offers accepted, inspection time, resale time, net contribution, customer questions, and unsold inventory. Stop if handling costs or safety exceptions exceed the preset limit.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "IKEA U.S. Annual Summary FY24", url: "https://www.ikea.com/us/en/files/pdf/6c/17/6c17e4d6/us_annual_summary_fy24.pdf", publisher: "IKEA U.S.", publicationDate: "2024", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "outcome", supports: "IKEA reports near-nationwide store implementation by FY2024 year end, over 2,700 products eligible for resale, and a related integrated marketing campaign." },
      { title: "IKEA Buyback & Resell Service", url: "https://www.ikea.com/us/en/circular/buy-back/", publisher: "IKEA U.S.", publicationDate: "Undated; current service page", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action", supports: "Current service description, participating-location limits, membership eligibility, inspection, and store-credit mechanics." },
    ],
  },
  {
    id: "CP-013", title: "Duolingo and Netflix connect a popular series to language learning", organization: "Duolingo and Netflix", sector: "Language learning and entertainment", geography: "United States with digital distribution", approximateScale: "Large consumer apps and global entertainment franchise", businessModel: "Freemium education app and licensed entertainment partnership", period: "2021–2024",
    families: ["distribution_partnership", "distinctive_identity", "content_entertainment", "product_service_design"],
    transferProfile: { audiences: ["fans", "language learners", "younger social audiences", "existing app users"], goals: ["activation", "product engagement", "cultural relevance", "partnership", "brand distinctiveness"], constraints: ["licensed intellectual property", "partner approval", "product localization", "cultural accuracy", "campaign timing"], scale: ["large consumer platform", "established brand"], geographies: ["United States", "global entertainment audience"], businessModels: ["freemium app", "education technology", "entertainment", "licensing partnership"] },
    convention: "A product's educational or functional benefit should be promoted separately from entertainment culture and brand characters.",
    choice: "For Squid Game season two, Duolingo and Netflix combined an update to Duolingo's Korean course with a licensed campaign starring Duo the Owl as a Pink Guard, including social videos, a music collaboration, an interactive filter, and outdoor creative.",
    mechanism: "A timely shared audience interest can become a product-relevant participation path when the partnership changes the experience itself, not just the ad. The mascot made the cross-over recognizable, while Korean lessons supplied the product action. The campaign's creative stunts are not evidence of learning, conversion, or retention impact.",
    distinctiveness: "The partnership translated a major entertainment release into additional course content and interactive learning prompts, using a deliberately characterful mascot in a licensed role rather than merely placing two logos together.",
    outcome: "Duolingo's release says Korean learners increased 40% just after Squid Game season one; this is a company-reported before/after observation without a disclosed method or causal attribution. The 2024 release describes campaign assets but does not report their resulting signups, lesson completion, or revenue.",
    evidenceClass: "Company press release describing the partnership and campaign; learner-change figure is company-reported and method-unspecified; no campaign outcome estimate reported.",
    causalLimit: "The reported change followed a hit series and may reflect broader interest, season timing, press, course changes, or other factors. The 2024 campaign source is promotional and does not quantify campaign performance. Do not infer a lift for another brand or claim that mascot provocation is universally suitable.",
    conditions: ["A verified overlap between the partner's audience and the business's target customers", "Rights and partner approval for characters, marks, music, and content", "A product or useful action that makes the collaboration meaningful", "Cultural and category review, plus capacity to serve resulting interest"],
    transferRisk: "A large partner can dominate the relationship; rights and launch timing create dependency. A threatening or edgy character voice may alienate learners, especially when detached from the specific brand and licensed context.",
    smallBusinessAdaptation: "Find a complementary organization, local event, creator, or cultural moment already relevant to customers, then co-create a genuinely useful experience that connects directly to the product; use only original or licensed assets.",
    reversibleTest: "Before production, validate audience overlap and partner interest with a small co-designed lesson, guide, demo, or event concept. Measure qualified participation, product activation, and partner effort; treat views and reactions as reach signals only, and stop if rights, cultural fit, or delivery capacity are unresolved.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Duolingo and Netflix Partner Launch 'Learn Korean or Else' Campaign", url: "https://investors.duolingo.com/news-releases/news-release-details/duolingo-and-netflix-partner-launch-learn-korean-or-else", publisher: "Duolingo Investor Relations", publicationDate: "2024-12-10", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "Duolingo's company-reported 40% increase in Korean learners after season one and description of the licensed 2024 course update, mascot, social, music, interactive, and out-of-home campaign; no 2024 campaign results are reported." },
    ],
  },
  {
    id: "CP-014", title: "Burger King redirects a competitor-location moment into app ordering", organization: "Burger King / Restaurant Brands International", sector: "Quick-service restaurants", geography: "United States", approximateScale: "National multi-location restaurant chain", businessModel: "Franchised restaurant network with app-based ordering and promotions", period: "December 2018",
    families: ["location_based_offer", "competitor_distribution", "product_led", "spectacle_earned_attention"],
    transferProfile: { audiences: ["nearby restaurant customers", "mobile-order users", "deal-seeking diners"], goals: ["app adoption", "first purchase", "competitive displacement", "earned attention"], constraints: ["location permission", "app reliability", "redemption economics", "participating locations", "privacy and advertising rules"], scale: ["national chain", "multi-location business"], geographies: ["United States", "local catchment areas"], businessModels: ["restaurant", "franchise", "mobile ordering", "local commerce"] },
    convention: "A competitor's larger store footprint is an insurmountable disadvantage for a smaller restaurant brand, and app promotion should focus only on the brand's own locations.",
    choice: "Burger King's Whopper Detour unlocked a one-cent Whopper offer in its app when a customer was within roughly 600 feet of a McDonald's location, then directed the customer to a nearby Burger King for pickup. The promotion ran for nine days and supported a redesigned app with mobile ordering.",
    mechanism: "The competitor's locations became a time-and-place trigger for a valuable offer that introduced a customer to Burger King's own app and ordering path. The transferable idea is to connect a verified buying moment to a genuinely useful next step; the geofence, price, and competitor target are not portable templates.",
    distinctiveness: "Instead of buying reach around its own stores, Burger King used the rival's footprint as a contextual signal and turned the customer journey itself into the campaign story.",
    outcome: "Restaurant Brands International's CEO reported over 1.5 million campaign-attributed app downloads and top app-store rankings during the period. These are company-reported downloads and rankings; the cited earnings-call source does not establish unique new customers, incremental profit, or long-term retention caused by the campaign.",
    evidenceClass: "Campaign creator case submission plus parent-company CEO statement reported in an earnings-call transcript; download totals and rankings are company-reported; no causal profit estimate in the cited evidence.",
    causalLimit: "The app was redesigned, mobile ordering was newly available, and the one-cent offer, media, novelty, and broad restaurant network operated together. Downloads, impressions, and rankings are not paying customers or incremental revenue. No public comparison isolates the geofence from these other factors.",
    conditions: ["A useful destination offer and operational capacity near the trigger location", "A working mobile order and redemption path", "Transparent, optional location permission and compliant data handling", "A promotion whose subsidy and repeat-purchase economics are understood", "Current legal, privacy, advertising-platform, and franchise approval"],
    transferRisk: "Deep discounts can destroy contribution, attract one-time bargain seekers, or overload nearby staff. Location targeting can feel invasive if permission is unclear; competitor-directed claims can create legal or platform-policy risk. Do not copy the campaign's exact name, price, creative, or geofencing plan.",
    smallBusinessAdaptation: "Find a legitimate moment when the customer is already solving the relevant problem—such as a nearby event, complementary service, or scheduled need—and offer a useful, capacity-limited next step through an existing permissioned channel.",
    reversibleTest: "First test the trigger without sensitive location tracking: ask one complementary venue or event partner to share a trackable, useful offer with an eligible audience. Measure qualified visits, completed purchases, contribution after discount and operating time; compare with the ordinary path and stop if margin, privacy, partner fit, or service capacity fails its preset guardrail.",
    editorialStatus: "verified_primary_and_secondary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "The Whopper Detour", url: "https://www.oneclub.org/awards/theoneshow/-award/33593/the-whopper-detour/", publisher: "The One Club for Creativity (campaign case submitted by the credited agency team)", publicationDate: "2019", accessedAt: "2026-10-25", sourceRole: "creator_primary", claimRole: "action_and_outcome", supports: "The credited agency case describes the app relaunch, geofencing around 14,000 McDonald's locations, one-cent offer, navigation to Burger King pickup, and its reported 1.5 million downloads in nine days." },
      { title: "Burger King's 'Whopper Detour' generated 1.5M app downloads", url: "https://www.restaurantdive.com/news/burger-kings-whopper-detour-generated-15m-app-downloads/548249/", publisher: "Restaurant Dive", publicationDate: "2019-02-12", accessedAt: "2026-10-25", sourceRole: "independent_secondary", claimRole: "outcome", supports: "Reports that RBI CEO José Cil attributed more than 1.5 million app downloads to the initiative and describes the campaign period and offer mechanics; the figure is company-reported and does not establish incremental customers or profit." },
    ],
  },
  {
    id: "CP-015", title: "Michelin built a useful travel guide to grow the category around its product", organization: "Michelin", sector: "Tires, mobility, travel information, and dining discovery", geography: "France, then international", approximateScale: "Established manufacturer; exact guide-team scale at launch is unknown", businessModel: "Tire manufacturing with a complementary travel-information product", period: "1900 onward",
    families: ["owned_content", "category_development", "customer_utility", "adjacent_business_model"],
    transferProfile: { audiences: ["current customers", "prospective category users", "travelers", "people learning a new market"], goals: ["category development", "customer utility", "repeat usage", "authority", "complementary revenue"], constraints: ["low category adoption", "limited customer knowledge", "trustworthy information", "editorial independence"], scale: ["early category", "established manufacturer", "small service business"], geographies: ["France", "local market", "tourism destination"], businessModels: ["physical product", "manufacturer", "owned content", "directory", "publisher"] },
    convention: "Marketing should focus on the product itself and reach customers only when they are already ready to buy.",
    choice: "Michelin's founders created a travel guide to encourage motorists to take road trips. It combined tire-maintenance information with practical help such as maps, fuel stops, lodging, and restaurants. The guide was initially free, then sold from 1920; Michelin says the later guide removed paid advertising and used anonymous restaurant inspectors.",
    mechanism: "A complementary information product made more trips practical, helping develop use of the category in which Michelin sold tires. The guide also earned an audience and editorial authority over time. Michelin reports the original commercial intention; the source does not isolate how much tire demand the guide caused.",
    distinctiveness: "The company made customer education and travel planning part of the product ecosystem, then separated its recommendations from paid advertising and used anonymous inspectors.",
    outcome: "Michelin's company history says the guide was created to encourage trips and support car and tire sales. It reports that more than 30 million guides have been sold worldwide since and that its current guide rates over 30,000 establishments in more than 30 territories. These are company-reported historical and current scale figures, not a causal estimate of tire sales or profit.",
    evidenceClass: "Company history describes the strategy, mechanics, and current scale; no independent causal estimate of category growth or tire sales is included.",
    causalLimit: "The guide's later reputation developed over more than a century alongside broader changes in automobile ownership, tourism, Michelin's business, and restaurant culture. Current scale cannot be attributed to the initial guide alone.",
    conditions: ["A real customer task that occurs before, during, or after product use", "Reliable information the business can maintain", "A clear relationship between the utility and the category without disguising promotion as neutral advice", "Editorial standards strong enough to preserve customer trust"],
    transferRisk: "A guide can become costly to update, stale, biased, or a distraction from the core offer. A business must disclose commercial interests and avoid claiming independence it does not have.",
    smallBusinessAdaptation: "Create one compact, genuinely useful checklist, local guide, calculator, or maintenance resource that helps customers complete a task related to the category; state the business's role clearly and keep the advice useful without a purchase.",
    reversibleTest: "Publish one small, dated resource for a defined customer segment. Ask users whether it helped with the task, record qualified follow-up and repeat use separately from page views, track maintenance hours, and stop or revise it if customers find it inaccurate or mainly promotional.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "About the MICHELIN Guide", url: "https://guide.michelin.com/us/en/about-us", publisher: "MICHELIN Guide", publicationDate: "Undated; current company history page", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "Michelin states the guide was made to encourage motorists to travel and thereby support automobile and tire purchases; describes its free period, 1920 paid guide, removal of paid advertisements, anonymous inspectors, and current reported guide scale." },
      { title: "Michelin Heritage", url: "https://www.michelin.com/en/group/heritage", publisher: "Michelin Group", publicationDate: "Undated; current company history page", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "context", supports: "Company history dates the first Guide Michelin to 1900 and describes its practical tire-care and travel information." },
    ],
  },
  {
    id: "CP-016", title: "Domino's paired a product reset with unusually candid customer feedback", organization: "Domino's Pizza, Inc.", sector: "Quick-service restaurants and pizza delivery", geography: "United States, with later use in other markets", approximateScale: "Large franchised restaurant network", businessModel: "Franchised pizza delivery and carryout with centrally coordinated product and marketing changes", period: "2009 onward",
    families: ["customer_feedback_to_product_change", "product_service_design", "transparent_communication", "brand_repositioning"],
    transferProfile: { audiences: ["existing customers", "lapsed customers", "skeptical prospects", "frontline operators"], goals: ["product improvement", "trust repair", "repeat purchase", "positioning change"], constraints: ["negative feedback", "operational consistency", "franchisee alignment", "product economics", "credible proof"], scale: ["multi-location business", "franchised network", "established brand"], geographies: ["United States", "multi-market business"], businessModels: ["restaurant", "franchise", "consumer product", "food service"] },
    convention: "When customers criticize the offer, increase promotion or defend the existing product before changing the underlying experience.",
    choice: "Domino's changed its core pizza recipe after hearing criticism and paired the product relaunch with a candid campaign that showed the company had heard negative feedback. It also used a website to explain the recipe changes and collect customer feedback.",
    mechanism: "A public response can be more credible when it names the criticism, changes the product, explains what changed, and invites follow-up. The operational change and franchisee participation were central; confession-style advertising without a real fix would not transfer the same mechanism.",
    distinctiveness: "The company described listening to harsh criticism and responding with a recipe change rather than only buying more advertising, then made the feedback part of its communication.",
    outcome: "Domino's 2010 Form 10-K reports media and social attention and positive domestic same-store sales growth alongside the recipe launch and campaign. The filing does not isolate the campaign's or recipe's incremental causal effect. A later company annual report says the recipe change contributed to reorder, traffic, and sales growth; that remains the company's attribution, not an independent causal estimate.",
    evidenceClass: "Company SEC filings describe the product change, communication, franchise context, and observed commercial outcomes; causal contribution is company-attributed and not independently isolated.",
    causalLimit: "Recipe changes, advertising, customer feedback, the broader menu, franchisee support, and existing brand scale occurred together. The reported sales movement does not establish the effect of candid advertising alone or prove that public criticism should always be amplified.",
    conditions: ["A real product or service change that addresses a substantiated customer complaint", "Enough operational control to deliver the improved experience consistently", "Willingness to communicate the change plainly", "A feedback path and owner capacity to respond", "Careful separation of customer research from public performance claims"],
    transferRisk: "Publicly repeating a complaint can reinforce a negative association if the fix is weak or inconsistent. A large chain's media scale and franchise system are not available to most businesses.",
    smallBusinessAdaptation: "Choose one recurring, well-supported customer complaint; fix the underlying step where feasible, show the change with specific evidence, and invite customers to test whether it solved the problem.",
    reversibleTest: "Pilot the service or product change with a small customer group before making a broad claim. Track complaint recurrence, successful completion, repeat purchase, refunds, support time, and customer-reported usefulness; publish only what the observed sample supports.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Domino's Pizza, Inc. 2010 Form 10-K", url: "https://ir.dominos.com/static-files/c2ce0038-e69b-4662-9f10-9f11f67d5365", publisher: "Domino's Pizza, Inc. / U.S. Securities and Exchange Commission filing", publicationDate: "2011", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "The filing describes the 2009 improved core recipe, the Oh Yes We Did campaign, website recipe explanations and customer feedback, media attention, positive same-store sales during the broader initiatives, franchisee marketing contributions, and operating context." },
      { title: "Domino's Pizza, Inc. 2018 Form 10-K", url: "https://ir.dominos.com/static-files/32b760c2-4719-4b19-8d6b-9d788dcde100", publisher: "Domino's Pizza, Inc. / U.S. Securities and Exchange Commission filing", publicationDate: "2019", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "The filing says company leaders were inspired by harsh criticism, changed the recipe rather than relying on advertising alone, and communicated that they had heard customer feedback; it also reports the company's view that the recipe contributed to later reorder, traffic, and sales growth." },
    ],
  },
  {
    id: "CP-017", title: "IKEA integrated flat-pack design with customer assembly", organization: "IKEA", sector: "Furniture retail and home furnishing", geography: "Sweden, later multi-market", approximateScale: "Growing mail-order furniture retailer in the 1950s; scale at adoption not independently quantified", businessModel: "Designed and sold furniture through mail order and retail, with customers taking home and assembling products", period: "1950s onward",
    families: ["constraint_transformation", "product_service_design", "customer_participation", "distribution_redesign", "compact_packaging", "customer_assembly", "bulky_delivery"],
    transferProfile: { audiences: ["price-conscious households", "customers willing to assemble", "self-service buyers"], goals: ["reduce delivery friction", "lower product cost", "faster fulfillment", "operating efficiency"], constraints: ["bulky delivery", "shipping damage", "storage space", "customer effort", "clear instructions"], scale: ["small retailer", "growing mail-order business", "multi-location retailer"], geographies: ["Sweden", "Europe", "global"], businessModels: ["furniture retail", "mail order", "physical product", "self-service retail"] },
    convention: "Furniture should be fully assembled before it is shipped to the customer; the seller must absorb the whole delivery and assembly burden.",
    choice: "IKEA combined flat packaging, product design, self-service distribution, and customer assembly. Company history says it adopted flat-packing in the 1950s to address costly and damage-prone furniture transport; the IKEA Museum describes customer assembly as part of the resulting business model.",
    mechanism: "The product, packaging, delivery path, and division of work were designed together. Customers invested assembly time in exchange for a more compact product and a lower-cost, faster take-home route. The idea was not inventing flat-pack furniture; the strategic move was integrating it into how products were designed, distributed, and sold.",
    distinctiveness: "A packaging and fulfillment constraint became a product-system choice that shifted part of delivery work to customers while making the trade-off legible and repeatable across a retail model.",
    outcome: "IKEA's corporate history says flat-pack furniture helped solve costly transport problems, and its museum describes it as central to a business model built around customer assembly. These are company-reported historical interpretations; no controlled estimate of incremental savings, demand, or profit is established here.",
    evidenceClass: "Company histories describe the adoption, operational problem, and business-model mechanism; reported benefit is not independently quantified or causally isolated.",
    causalLimit: "Packaging, product design, supplier relationships, retail operations, customer willingness, pricing, and market expansion changed together. This record does not quantify the independent effect of flat-packing or show that transferring work to customers always improves value.",
    conditions: ["A product that can be safely disassembled and reassembled", "Customers who accept the assembly trade-off", "Instructions and parts that reduce failure and support burden", "A real transport, storage, damage, or fulfillment constraint"],
    transferRisk: "Self-service can feel like uncompensated labor, increase returns or support cost, or create safety and quality problems. Do not move work to customers unless the resulting price, speed, access, or customization benefit is real and clear.",
    smallBusinessAdaptation: "For one suitable product or service, redesign the package or workflow so customers can complete a low-risk final step themselves in return for a concrete benefit such as faster pickup, lower delivery cost, or more choice.",
    reversibleTest: "Pilot a compact, customer-assembled version with a few existing buyers. Compare transport damage, delivery or storage cost, setup time, completion failures, support contacts, returns, and repeat purchase with the current path; stop if customers do not value the trade-off or quality declines.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "From humble origins to global brand – a brief history of IKEA", url: "https://www.ikea.com/us/en/this-is-ikea/about-us/from-humble-origins-to-global-brand-a-brief-history-of-ikea-pubad29a981/", publisher: "IKEA", publicationDate: "Undated; current company history page", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "IKEA says high furniture transport costs and damage rates were a problem, that it adopted flat-packing in 1953, and that self-assembly products helped solve those transport problems." },
      { title: "How IKEA took flatpacks to a whole new level", url: "https://ikeamuseum.com/en/explore/the-story-of-ikea/flatpacks/", publisher: "IKEA Museum", publicationDate: "Undated; current museum history page", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "The museum says IKEA did not invent flat-packing, but integrated it into a business model in which customers assembled furniture themselves." },
    ],
  },
  {
    id: "CP-018", title: "Dropbox let collaboration carry adoption into teams", organization: "Dropbox", sector: "Cloud file storage and collaboration software", geography: "United States, then global", approximateScale: "At its 2018 filing: company-reported 500 million registered users and 11 million paying users", businessModel: "Freemium cloud storage and collaboration subscriptions", period: "2007–2018",
    families: ["product_led_distribution", "collaboration_distribution", "bottom_up_adoption", "workflow_embedded_growth", "user_invitation"],
    transferProfile: { audiences: ["individual users", "collaborators", "teams", "organizations"], goals: ["acquisition", "activation", "team adoption", "self-serve conversion"], constraints: ["product must deliver individual value", "sharing must be useful", "recipient onboarding", "privacy and access control"], scale: ["early software startup", "freemium product", "growing software company"], geographies: ["United States", "global", "multi-market"], businessModels: ["SaaS", "freemium software", "collaboration product", "subscription software"] },
    convention: "Business software acquisition must begin with a top-down sales pitch before employees can try or spread a product.",
    choice: "Dropbox built around file access, sharing, and collaboration. In its 2018 SEC filing, the company described users sharing content and collaborating, introducing and inviting new users, and individual users signing up for work before wider organizational adoption.",
    mechanism: "A product's normal use created a relevant invitation path: a user shared work with someone who needed to access or collaborate on it. This let adoption travel through actual workflows and organizations, while self-serve purchasing provided a separate conversion path. The filing is company reporting and does not isolate the causal contribution of any individual sharing feature.",
    distinctiveness: "Distribution was connected to the job users were already doing together, so the recipient encountered the product in context rather than through a generic referral message.",
    outcome: "Dropbox reported 500 million registered users, 11 million paying users, millions of individual users signing up at work each year, and more than 90% of revenue from self-serve channels in its 2018 S-1. These are company-reported scale and channel figures; they do not establish how much growth was caused by sharing, invitations, or any single product feature.",
    evidenceClass: "Company SEC filing reports product-sharing behavior, user invitations, bottom-up organizational adoption, and self-serve revenue share.",
    causalLimit: "The filing describes Dropbox's own interpretation of its growth. Product utility, timing, freemium access, brand, distribution, collaboration, and market conditions changed together; the record provides no controlled estimate of the invite loop's incremental acquisition or revenue effect.",
    conditions: ["A product or service whose use naturally involves another person", "A recipient gets clear value from the shared item or workflow", "Simple and trustworthy access controls", "A recipient onboarding path that does not create avoidable friction", "A business model that can support free or self-serve use when appropriate"],
    transferRisk: "Forced invites can feel spammy, create privacy concerns, or attract users who never become customers. A solo-use product may have no natural collaboration loop, and a free tier may be uneconomic.",
    smallBusinessAdaptation: "For a product or service with a genuine shared task, make one useful customer deliverable easy to share with the collaborator who needs it. Offer a clear, optional next step for that recipient; do not add generic contact-import prompts or assume sharing equals demand.",
    reversibleTest: "With a small, permissioned customer cohort, test an optional shareable artifact or collaborative step. Measure qualified recipient visits, recipient activation, paid conversion, support or privacy complaints, and operating time. Compare with the existing path and stop if recipients do not gain value or complaints rise.",
    editorialStatus: "verified_primary", researchConfidence: "medium", accessedAt: "2026-10-25",
    sources: [
      { title: "Dropbox, Inc. Form S-1/A", url: "https://www.sec.gov/Archives/edgar/data/1467623/000119312518089786/d553522ds1a.htm", publisher: "Dropbox, Inc. / U.S. Securities and Exchange Commission", publicationDate: "2018-03-21", accessedAt: "2026-10-25", sourceRole: "company_primary", claimRole: "action_and_outcome", supports: "The filing's 'Viral, bottom-up adoption' and sales-and-marketing sections say users shared content and collaborated, introduced and invited users, individuals signed up for work, bottom-up adoption was important, and over 90% of revenue came from self-serve channels; it also reports 500 million registered users and 11 million paying users." },
    ],
  },

];

const STOP = new Set(["and", "the", "for", "with", "from", "into", "that", "this", "business", "company", "customer", "strategy", "strategic", "growth", "marketing"]);
const words = (s: string) => new Set((s.toLocaleLowerCase("en-US").normalize("NFKC").match(/[a-z0-9]{3,}/g) ?? []).map((term) => STOP.has(term) || term.length <= 4 || term.endsWith("ss") ? term : term.endsWith("s") ? term.slice(0, -1) : term));
const SCALE_ALIASES: Record<string, string[]> = { small: ["startup", "early", "resource", "limited"], startup: ["early", "small"], micro: ["small", "limited"] };

function contextFor(value: string | CreativePrecedentContext): { core: Set<string>; audience: Set<string>; goals: Set<string>; constraints: Set<string>; geography: Set<string>; scale: Set<string>; model: Set<string> } {
  if (typeof value === "string") {
    const core = words(value);
    return { core, audience: new Set(), goals: new Set(), constraints: new Set(), geography: new Set(), scale: new Set(), model: new Set() };
  }
  const evidenceText = [value.brief, ...value.facts].join("\n");
  const task = words(value.task);
  const evidence = words(evidenceText);
  // Business profile facts help rank transferability, but must not masquerade
  // as a mechanism request (e.g. "local retail" matching an unrelated case).
  const core = task;
  const constraint = value.constraints;
  const constraintText = [
    ...(constraint?.monthlyAdBudgetUsd === undefined ? [] : [`monthly ad budget ${constraint.monthlyAdBudgetUsd}`]),
    ...(constraint?.ownerHoursPerWeek === undefined ? [] : [`owner hours per week ${constraint.ownerHoursPerWeek}`]),
    ...(constraint?.newCustomersPerMonth === undefined ? [] : [`capacity new customers per month ${constraint.newCustomersPerMonth}`]),
    ...(constraint?.emailAudience === undefined ? [] : [`consented email audience ${constraint.emailAudience}`]),
    constraint?.serviceArea ?? "",
    ...(constraint?.businessTypes ?? []),
  ].join(" ");
  const geography = words([constraint?.serviceArea ?? "", evidenceText].join(" "));
  const scale = words([value.industryBusinessTypeId ?? "", ...(constraint?.businessTypes ?? []), evidenceText].join(" "));
  for (const term of [...scale]) for (const alias of SCALE_ALIASES[term] ?? []) scale.add(alias);
  return {
    core,
    audience: evidence,
    goals: task,
    constraints: words(`${constraintText} ${evidenceText}`),
    geography,
    scale,
    model: words([value.industryBusinessTypeId ?? "", ...(constraint?.businessTypes ?? []), evidenceText].join(" ")),
  };
}

function overlap(context: Set<string>, sourceText: string, weight: number, max = 1.5): { score: number; matched: string[] } {
  if (!context.size) return { score: 0, matched: [] };
  const source = words(sourceText);
  const matched = [...context].filter((term) => !STOP.has(term) && source.has(term));
  return { score: Math.min(max, matched.length * weight), matched: matched.slice(0, 4) };
}

/** Retrieval by mechanism and transferable constraints, never industry match alone. */
export function retrieveCreativePrecedents(query: string | CreativePrecedentContext, limit = 2): { precedent: CreativePrecedent; score: number; matchReasons: string[] }[] {
  const context = contextFor(query);
  const queryTerms = [...context.core].filter((term) => !STOP.has(term));
  if (!queryTerms.length) return [];
  return CREATIVE_PRECEDENTS.map((precedent) => {
    const mechanisms = overlap(context.core, `${precedent.families.join(" ")} ${precedent.convention} ${precedent.choice} ${precedent.mechanism} ${precedent.transferProfile.goals.join(" ")} ${precedent.transferProfile.constraints.join(" ")}`, 0.75, 3);
    // Require a mechanism match so geography, company names, or sector alone cannot create a false analogy.
    const audience = overlap(context.audience, `${precedent.transferProfile.audiences.join(" ")} ${precedent.sector} ${precedent.conditions.join(" ")} ${precedent.smallBusinessAdaptation}`, 0.2);
    const goals = overlap(context.goals, `${precedent.transferProfile.goals.join(" ")} ${precedent.mechanism} ${precedent.outcome} ${precedent.reversibleTest}`, 0.2);
    const constraints = overlap(context.constraints, `${precedent.transferProfile.constraints.join(" ")} ${precedent.conditions.join(" ")} ${precedent.transferRisk} ${precedent.reversibleTest}`, 0.2);
    const geography = overlap(context.geography, `${precedent.transferProfile.geographies.join(" ")} ${precedent.geography}`, 0.35, 0.7);
    const scale = overlap(context.scale, `${precedent.transferProfile.scale.join(" ")} ${precedent.approximateScale} ${precedent.smallBusinessAdaptation}`, 0.2, 0.7);
    const model = overlap(context.model, `${precedent.transferProfile.businessModels.join(" ")} ${precedent.businessModel}`, 0.2, 0.7);
    const score = mechanisms.score + audience.score + goals.score + constraints.score + geography.score + scale.score + model.score;
    const matchReasons = [
      ...(mechanisms.matched.length ? [`mechanism: ${mechanisms.matched.join(", ")}`] : []),
      ...(audience.matched.length ? [`audience/context: ${audience.matched.join(", ")}`] : []),
      ...(goals.matched.length ? [`goal: ${goals.matched.join(", ")}`] : []),
      ...(constraints.matched.length ? [`constraint: ${constraints.matched.join(", ")}`] : []),
      ...(geography.matched.length ? [`geography: ${geography.matched.join(", ")}`] : []),
      ...(scale.matched.length ? [`scale: ${scale.matched.join(", ")}`] : []),
      ...(model.matched.length ? [`business model: ${model.matched.join(", ")}`] : []),
    ];
    return { precedent, score, matchReasons, mechanismScore: mechanisms.score };
  }).filter(({ score, mechanismScore }) => mechanismScore >= 1.5 && score >= 1.5)
    .sort((a, b) => b.score - a.score || a.precedent.id.localeCompare(b.precedent.id))
    .slice(0, Math.max(1, Math.min(3, limit)))
    .map(({ precedent, score, matchReasons }) => ({ precedent, score, matchReasons }));
}

export function formatCreativePrecedents(query: string | CreativePrecedentContext, limit = 2): string {
  const matches = retrieveCreativePrecedents(query, limit);
  if (!matches.length) return "No sufficiently relevant sourced creative precedent was retrieved. Generate an original hypothesis from this business's own evidence and label the uncertainty.";
  return matches.map(({ precedent: p, matchReasons }) => [
    `[${p.id} · precedent, not a forecast] ${p.title} — ${p.organization} (${p.period}; ${p.geography}; ${p.approximateScale})`,
    `Why retrieved: ${matchReasons.join("; ") || "mechanism relevance"}`,
    `Category convention: ${p.convention}`,
    `Choice and mechanism: ${p.choice} ${p.mechanism}`,
    `Documented outcome: ${p.outcome}`,
    `Evidence class and causal limit: ${p.evidenceClass} ${p.causalLimit}`,
    `Transfer conditions: ${p.conditions.join("; ")}`,
    `Transfer risk: ${p.transferRisk}`,
    `Small-business adaptation: ${p.smallBusinessAdaptation}`,
    `Reversible test: ${p.reversibleTest}`,
    `Sources (accessed 2026-10-25; cite only for this precedent, never as evidence about the target business): ${p.sources.map((s) => `${s.title} — ${s.publisher}, ${s.publicationDate}: ${s.supports} ${s.url}`).join(" | ")}`,
  ].join("\n")).join("\n\n");
}

/** Runtime entry point: every growth-plays generation receives a bounded context, even if its task label changes. */
export function creativePrecedentsForAgent(agentId: string, task: string, businessContext: string | CreativePrecedentContext): string {
  if (agentId !== "growth_plays" && !/STRATEGY EXPLORATION|CREATIVE STRATEGY EXPLORATION/i.test(task)) return "";
  return formatCreativePrecedents(businessContext, 2);
}
