/**
 * Small, source-checked creative-strategy precedent set. This is deliberately
 * not padded to 100: the source corpus currently supports four usable cases.
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
  sources: { title: string; url: string; publisher: string; publicationDate: string; supports: string }[];
}

export const CREATIVE_PRECEDENTS: readonly CreativePrecedent[] = [
  {
    id: "CP-001", title: "Airbnb's election cereal boxes", organization: "Airbnb", sector: "Travel marketplace / early startup", geography: "United States", approximateScale: "Pre-seed startup", businessModel: "Two-sided accommodation marketplace (then pre-launch)", period: "2008",
    families: ["distribution_partnership", "constraint_transformation", "spectacle_earned_attention"],
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
      { title: "A letter from co-founder Nathan Blecharczyk", url: "https://news.airbnb.com/a-letter-from-co-founder-nathan-blecharczyk", publisher: "Airbnb Newsroom", publicationDate: "2022", supports: "Founders made Obama O's and Captain McCain's; the unusual story was shared in the Y Combinator interview." },
      { title: "Airbnb's Surprising Path to Y Combinator", url: "https://www.wired.com/2017/02/airbnbs-surprising-path-to-y-combinator/", publisher: "WIRED", publicationDate: "2017-02-23", supports: "Independent retrospective account of the cereal effort and early company context." },
    ],
  },
  {
    id: "CP-002", title: "Patagonia's 'Don't Buy This Jacket' message", organization: "Patagonia", sector: "Outdoor apparel", geography: "United States", approximateScale: "Established specialist retailer", businessModel: "Premium branded apparel retail", period: "2011 onward",
    families: ["distinctive_identity", "customer_experience_retention", "product_service_design"],
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
      { title: "Don't Buy This Jacket, Black Friday and the New York Times", url: "https://www.patagonia.com/stories/planet/activism/dont-buy-this-jacket-black-friday-and-the-new-york-times/story-18615.html", publisher: "Patagonia Stories", publicationDate: "2011-11-25 (updated 2022)", supports: "Ad, date, and company's stated purpose and rationale." },
      { title: "Patagonia's sustainability strategy: Don't buy our products", url: "https://www.imd.org/research-knowledge/sustainability/case-studies/patagonia-s-sustainability-strategy-don-t-buy-our-products/", publisher: "IMD", publicationDate: "2016", supports: "Secondary report of the approximate post-ad sales change and its time window." },
    ],
  },
  {
    id: "CP-003", title: "Nike's waffle-sole product experiment", organization: "Nike", sector: "Athletic footwear", geography: "United States", approximateScale: "Early-stage footwear company; exact scale not verified", businessModel: "Designed and sold athletic footwear", period: "1971–1975",
    families: ["product_service_design", "constraint_transformation", "customer_participation"],
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
      { title: "From Waffle Iron to World Stage: The True Story of the Nike Moon Shoe", url: "https://about.nike.com/en/magazine/nike-moon-shoe-waffle-iron-true-history", publisher: "NIKE, Inc. Archives", publicationDate: "2025-09-15", supports: "Prototype mechanism, athlete testing, product sequence, and reported 100,000 orders." },
    ],
  },
  {
    id: "CP-004", title: "Mario: designing a character around constraints and reuse", organization: "Nintendo", sector: "Video games and entertainment", geography: "Japan / global", approximateScale: "Established game maker; exact initial scale not verified", businessModel: "Video-game design and publishing", period: "1981 onward",
    families: ["distinctive_identity", "constraint_transformation", "product_service_design"],
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
      { title: "Iwata Asks: The Reason Mario Wears Overalls", url: "https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-New-Super-Mario-Bros-Wii/Volume-1/2-The-Reason-Mario-Wears-Overalls/2-The-Reason-Mario-Wears-Overalls-210759.html", publisher: "Nintendo UK", publicationDate: "2009", supports: "Miyamoto's description of pixel constraints and design decisions." },
      { title: "E3 Video: Miyamoto talks about creating Mario", url: "https://www.latimes.com/archives/blogs/technology-blog/story/2009-06-04/e3-video-miyamoto-talks-about-creating-mario", publisher: "Los Angeles Times", publicationDate: "2009-06-04", supports: "Interview report that Miyamoto wanted a character usable across his games." },
      { title: "The official home of Super Mario: History", url: "https://mario.nintendo.com/history/", publisher: "Nintendo", publicationDate: "Undated; accessed 2026-10-25", supports: "Official chronology of releases from 1985 onward." },
    ],
  },
];

const words = (s: string) => new Set(s.toLocaleLowerCase("en-US").normalize("NFKC").match(/[a-z0-9]{3,}/g) ?? []);
const STOP = new Set(["and", "the", "for", "with", "from", "into", "that", "this", "business", "company", "customer", "strategy", "strategic", "growth", "marketing"]);

/** Retrieval by mechanism and transferable constraints, never industry match alone. */
export function retrieveCreativePrecedents(query: string, limit = 2): { precedent: CreativePrecedent; score: number }[] {
  const queryTerms = [...words(query)].filter((term) => !STOP.has(term));
  if (!queryTerms.length) return [];
  return CREATIVE_PRECEDENTS.map((precedent) => {
    const searchable = words([
      precedent.title, precedent.sector, precedent.families.join(" "), precedent.convention,
      precedent.choice, precedent.mechanism, precedent.conditions.join(" "), precedent.smallBusinessAdaptation,
    ].join(" "));
    let score = 0;
    for (const term of queryTerms) if (searchable.has(term)) score += 1 + (precedent.families.some((family) => family.includes(term)) ? 0.5 : 0);
    // Context relevance is a weak tie-breaker only; a sector name alone cannot qualify a case.
    if (queryTerms.some((term) => words(precedent.sector).has(term))) score += 0.35;
    return { precedent, score };
  }).filter(({ score }) => score >= 2.5).sort((a, b) => b.score - a.score || a.precedent.id.localeCompare(b.precedent.id)).slice(0, Math.max(1, Math.min(3, limit)));
}

export function formatCreativePrecedents(query: string, limit = 2): string {
  const matches = retrieveCreativePrecedents(query, limit);
  if (!matches.length) return "No sufficiently relevant sourced creative precedent was retrieved. Generate an original hypothesis from this business's own evidence and label the uncertainty.";
  return matches.map(({ precedent: p, score }) => [
    `[${p.id} · score ${score} · precedent, not a forecast] ${p.title} — ${p.organization} (${p.period}; ${p.geography}; ${p.approximateScale})`,
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
