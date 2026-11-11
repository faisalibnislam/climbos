/** Acceptance briefs are inputs, not claims about live businesses or expected output to copy. */
export interface StrategyQualityCase {
  id: string;
  industry: string;
  businessType: string;
  businessWebsite?: string;
  brief: string;
  facts: string[];
  research: { notes: string; sources: { url: string; title: string }[] };
  reviewQuestions: string[];
}

const synthetic = (id: string, industry: string, businessType: string, brief: string, reviewQuestions: string[]): StrategyQualityCase => ({
  id, industry, businessType, brief: `SYNTHETIC ACCEPTANCE CASE. ${brief} Owner asks for a distinctive longer-term growth direction and the best next moves over 90 days. Ad budget is zero in this scenario; owner time, unit economics and current customer counts are unknown unless stated. No audience, publishing or contact permission is assumed.`, facts: [], research: { notes: "No external research supplied. Names, audience data, current platform rules and commercial results are unknown. Recommend a scoped research step when a specific target has not been verified.", sources: [] }, reviewQuestions,
});

export const STRATEGY_QUALITY_CASES: StrategyQualityCase[] = [
  {
    id: "livoform", industry: "software", businessType: "b2b_saas", businessWebsite: "https://livoform.com/",
    brief: "PUBLIC-SOURCE ACCEPTANCE CASE, checked 2026-11-09. Livoform is a form-building product. The owner wants stronger paying-customer growth recommendations, not a marketing checklist. Current customers, actual conversion, retention, margin, owner time and acquisition performance are unknown. For this comparison only, assume no paid-media budget and a 90-day planning horizon; this is a test constraint, not a statement of the owner's real budget. Website claims below are source-reported, not owner-confirmed product behavior or proof of demand. Example dashboards on marketing pages are not measured business data.",
    facts: [],
    research: {
      notes: "Source-reported homepage statements: Livoform offers AI-generated forms, branching logic, payments and responses sent into other tools. The page lists Free, Core at $2/company/month, Pro at $6/company/month, and Business at $19/seat/month. It advertises assistant/API support and use cases for agencies, sales, educators and events. These are website claims only. The homepage links to existing templates, use-case, integration and comparison sections; their content has not been inspected in this frozen evidence pack. Customer demand, search volume and channel performance are unknown.",
      sources: [{ url: "https://livoform.com/", title: "Livoform homepage, checked 2026-11-09" }],
    },
    reviewQuestions: ["Does it choose a precise customer job and offer/distribution wedge instead of every listed use case?", "Does it explain how low prices affect paid acquisition without ruling out one-to-many earned distribution?", "Does SEO start with an existing URL to inspect and a buyer task, while demand stays unknown?", "Are G2 and Product Hunt conditional comparison/launch options, rather than automatic recurring chores?"],
  },
  synthetic("mac-app", "desktop software", "desktop_app", "An independent developer makes a local Mac utility that helps video editors prepare project folders before handing work to a collaborator. It is a one-time purchase, but price and sales volume have not been supplied. The developer wants distribution beyond posting feature announcements.", ["Does it investigate Mac-workflow YouTube creators and explain a useful demonstration angle?", "Does it explicitly leave the shortlist unverified when no source is supplied, without inventing creators or outreach permission?", "Does it distinguish earned coverage, affiliate arrangements and paid sponsorship?"]),
  synthetic("education", "education", "education", "A small provider teaches practical science workshops for secondary-school teachers, who may need a school to approve payment. It has lesson materials and an instructor, but no supplied enrollment data or location.", ["Does it distinguish teacher/user from school/payer and their purchase timing?", "Does it explore reusable teaching assets, school partnerships and evidence of learning rather than default consumer social ads?", "Does it avoid assumed access to students or permission to collect minors' data?"]),
  synthetic("healthcare", "healthcare", "healthcare", "A physiotherapy practice offers return-to-running assessments and follow-up appointments. Clinical qualifications, service area, spare appointment capacity and patient outcomes have not been supplied.", ["Does it investigate service geography, clinician trust, referral fit and available appointment capacity?", "Does it avoid invented clinical outcomes, guaranteed recovery, patient stories or permission to contact patients?", "Is there a distinct service or referral mechanism, not just a local SEO checklist?"]),
  synthetic("science", "science and technical B2B", "consulting", "A laboratory service performs materials testing for small hardware teams preparing a new component for manufacturing. Tests need an engineer's technical specification and purchasing approval. No certification, turnaround guarantee or customer list has been provided.", ["Does it address technical proof, engineer versus procurement buyer, and qualification?", "Does it consider design/manufacturing partners or expert education with a concrete customer mechanism?", "Does it avoid invented certifications, compliance claims and instant ecommerce conversion assumptions?"]),
  synthetic("retail", "physical retail", "physical_retail", "An independent homeware shop wants more repeat purchases and local customers. It can hold small product demonstrations, but stock, location, margins and staffing are unknown.", ["Does it connect catchment, purchase occasion, replenishment or local partnerships to the offer?", "Does it check stock and staffing before proposing an event or promotion?", "Does it avoid treating online reach as measured store visits?"]),
  synthetic("ecommerce", "ecommerce", "dtc_ecommerce", "An online shop sells repair kits for frequently replaced household items and wants profitable repeat customers. It has product instructions but no supplied margin, return-rate, sales or traffic data.", ["Does it consider proof through repair demonstrations, useful instructions and repeat/replenishment needs?", "Does it preserve unknown contribution and returns rather than prescribing discounts or broad ads?", "Do social formats demonstrate a real job rather than recite product features?"]),
  synthetic("creator", "creator business", "media_creator", "An independent illustrator has a public portfolio and wants to develop sustainable income from teaching and useful drawing resources. Audience size, email permission, teaching demand and capacity are unknown.", ["Does it connect audience trust to a distinctive paid offer and a small willingness-to-pay test?", "Does it consider collaborations and a reusable learning experience rather than follower growth alone?", "Does each selected social format serve a concrete reader/viewer situation?"]),
];

export function selectStrategyQualityCases(ids?: string): StrategyQualityCase[] {
  if (!ids) return STRATEGY_QUALITY_CASES;
  return ids.split(",").map((id) => {
    const found = STRATEGY_QUALITY_CASES.find((item) => item.id === id);
    if (!found) throw new Error(`Unknown strategy quality case: ${id}`);
    return found;
  });
}

// Public creator evidence added for a second, sourced Mac acceptance condition.
// Publication age and topic coverage establish a research lead, never sponsorship availability or buyer demand.
const macCase = STRATEGY_QUALITY_CASES.find((item) => item.id === "mac-app")!;
macCase.research = {
  notes: "Public creator sources checked 2026-11-09: MacMost's about page identifies it as a website and YouTube channel for Mac tutorials, hosted by Gary Rosenzweig. Its homepage lists recent Finder/file-management topics including renaming files (2026-10-29) and selecting files across folders (2026-10-21). Mark Ellis Reviews published an article about essential Mac productivity apps, updated 2024-04-15, with a YouTube link; this is historical topic evidence, not proof of recent relevant coverage. Possible fit with a video-editor handoff utility is an inference and should be checked against actual recent work. Audience demographics, reach, rates, interest, contact permission and placement availability are unknown. These are public-source leads only; no contact details are supplied.",
  sources: [{ url: "https://macmost.com/about", title: "MacMost identity and channel description, checked 2026-11-09" }, { url: "https://macmost.com/", title: "MacMost dated tutorial topics, checked 2026-11-09" }, { url: "https://markellisreviews.com/reviews/my-4-essential-mac-productivity-apps/", title: "Mark Ellis Mac productivity article, updated 2024-04-15; checked 2026-11-09" }],
};
macCase.reviewQuestions[1] = "Does it name sourced creator leads with a specific demonstration angle, preserve the old publication date for Mark Ellis and require a current-fit check rather than invent reach, rates or interest?";
