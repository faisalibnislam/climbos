/**
 * The acquisition channel library (owner framework, docs/research/acquisition-framework.md).
 * Versioned with the code: business types, channel families, the master channel
 * taxonomy with stable IDs, and the attributes the scoring rules use.
 */

export const LIBRARY_VERSION = "acq-2026-10-18";

/* ---------------- intent stages and families ---------------- */

export const STAGES = ["unaware", "problem", "solution", "product", "high_intent", "returning", "existing"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  unaware: "Unaware",
  problem: "Problem aware",
  solution: "Solution aware",
  product: "Product aware",
  high_intent: "Ready to buy",
  returning: "Returning visitor",
  existing: "Existing customer",
};

export const FAMILIES = {
  organic_search: "Organic search",
  paid_search: "Paid search",
  organic_social: "Organic social",
  paid_social: "Paid social",
  content: "Content",
  video_audio: "Video & audio",
  email: "Email",
  outreach: "Direct outreach & sales",
  communities: "Communities",
  partnerships: "Partnerships",
  referral: "Referral & word of mouth",
  marketplaces: "Marketplaces & directories",
  pr: "PR & earned media",
  creators: "Influencers & creators",
  events: "Events & field",
  product_led: "Product-led",
  traditional: "Traditional advertising",
  local: "Local & location-based",
  distribution: "Distribution & channel sales",
  retargeting: "Retargeting & re-engagement",
} as const;
export type Family = keyof typeof FAMILIES;

/** Who carries it out: ClimbOS end to end, ClimbOS prepares and the owner approves, or a person. */
export type Execution = "auto" | "partial" | "human";
export const EXECUTION_LABEL: Record<Execution, string> = { auto: "ClimbOS runs it", partial: "ClimbOS prepares, you approve", human: "You do it, ClimbOS helps" };

/** Eligibility requirements a business must meet (hard checks before scoring). */
export type Requirement = "location" | "products" | "app" | "desktop" | "software" | "developer" | "ai" | "digital_goods" | "nonprofit" | "b2b" | "b2c" | "gov" | "booking" | "property" | "events";

export interface Channel {
  id: string;
  name: string;
  family: Family;
  stages: Stage[];
  learn: "days" | "weeks" | "months";
  /** Upfront cash need: 0 none … 3 high. */
  cash: 0 | 1 | 2 | 3;
  /** Organic scalability: 0 low … 2 high. */
  scale: 0 | 1 | 2;
  exec: Execution;
  /** Smallest monthly spend (USD) that can produce a readable test; 0 for organic. */
  minMonthly: number;
  /** How reliably results can be attributed (0-100). */
  measure: number;
  requires?: Requirement[];
  /** Advertising/solicitation restrictions apply in regulated industries. */
  regulatedCaution?: boolean;
}

type Defaults = Omit<Channel, "id" | "name">;
const G: Record<string, Defaults> = {
  S: { family: "organic_search", stages: ["problem", "solution", "high_intent"], learn: "months", cash: 1, scale: 2, exec: "partial", minMonthly: 0, measure: 65 },
  P: { family: "paid_search", stages: ["high_intent"], learn: "days", cash: 2, scale: 0, exec: "partial", minMonthly: 300, measure: 85, regulatedCaution: true },
  O: { family: "organic_social", stages: ["unaware", "problem"], learn: "weeks", cash: 0, scale: 1, exec: "partial", minMonthly: 0, measure: 40 },
  C: { family: "content", stages: ["problem", "solution"], learn: "months", cash: 0, scale: 2, exec: "auto", minMonthly: 0, measure: 55 },
  D: { family: "outreach", stages: ["high_intent", "product"], learn: "days", cash: 1, scale: 1, exec: "partial", minMonthly: 0, measure: 85 },
  R: { family: "partnerships", stages: ["solution", "product"], learn: "weeks", cash: 1, scale: 2, exec: "human", minMonthly: 0, measure: 60 },
  M: { family: "marketplaces", stages: ["product", "high_intent"], learn: "weeks", cash: 1, scale: 1, exec: "partial", minMonthly: 0, measure: 75 },
  N: { family: "communities", stages: ["problem", "solution"], learn: "months", cash: 0, scale: 1, exec: "human", minMonthly: 0, measure: 35 },
  E: { family: "events", stages: ["unaware", "product"], learn: "weeks", cash: 2, scale: 1, exec: "human", minMonthly: 300, measure: 35 },
  V: { family: "product_led", stages: ["product", "existing"], learn: "months", cash: 1, scale: 2, exec: "human", minMonthly: 0, measure: 70 },
};

function ch(id: string, name: string, o: Partial<Defaults> = {}): Channel {
  return { id, name, ...G[id[0]], ...o };
}

/* ---------------- the master channel taxonomy ---------------- */

export const CHANNELS: Channel[] = [
  // A. Search & discovery
  ch("S01", "Google organic search"),
  ch("S02", "Bing organic search"),
  ch("S03", "Local SEO", { family: "local", learn: "weeks", requires: ["location"] }),
  ch("S04", "Google Maps (Business Profile)", { family: "local", learn: "weeks", cash: 0, stages: ["high_intent", "product"], requires: ["location"], measure: 70 }),
  ch("S05", "Apple Maps", { family: "local", learn: "weeks", cash: 0, stages: ["high_intent"], requires: ["location"] }),
  ch("S06", "Programmatic SEO", { cash: 2 }),
  ch("S07", "Technical SEO", { exec: "partial", stages: ["high_intent"] }),
  ch("S08", "Content SEO", { exec: "auto" }),
  ch("S09", "Comparison pages", { exec: "auto", stages: ["solution", "high_intent"], measure: 70 }),
  ch("S10", "Competitor alternative pages", { exec: "auto", stages: ["high_intent"], measure: 70 }),
  ch("S11", "Product SEO", { requires: ["products"], stages: ["high_intent"] }),
  ch("S12", "Image search SEO", { stages: ["solution"], measure: 40 }),
  ch("S13", "Video SEO", { family: "video_audio", stages: ["problem", "solution"] }),
  ch("S14", "AI search visibility (ChatGPT, Perplexity, Gemini)", { stages: ["solution", "high_intent"], measure: 35 }),
  ch("S15", "Google Discover", { stages: ["unaware"], measure: 40 }),
  ch("S16", "Google News", { family: "pr", stages: ["unaware"], measure: 40 }),
  ch("S17", "Marketplace search optimization", { family: "marketplaces", learn: "weeks", requires: ["products"], stages: ["high_intent"], measure: 80 }),
  ch("S18", "App store optimization", { family: "marketplaces", learn: "weeks", requires: ["app"], stages: ["high_intent"], measure: 75 }),
  ch("S19", "Voice search optimization", { requires: ["location"], measure: 30 }),
  ch("S20", "Directory search visibility", { family: "marketplaces", learn: "weeks", stages: ["product", "high_intent"] }),
  // B. Paid advertising
  ch("P01", "Google Search Ads"),
  ch("P02", "Microsoft Search Ads", { minMonthly: 150 }),
  ch("P03", "Google Shopping Ads", { requires: ["products"] }),
  ch("P04", "Google Performance Max", { minMonthly: 600, stages: ["high_intent", "returning"] }),
  ch("P05", "Google Display Ads", { family: "paid_social", stages: ["unaware", "returning"], measure: 60 }),
  ch("P06", "YouTube Ads", { family: "paid_social", stages: ["unaware", "problem"], minMonthly: 500, measure: 60 }),
  ch("P07", "Facebook Ads (Meta)", { family: "paid_social", stages: ["unaware", "problem", "returning"], minMonthly: 300, measure: 75 }),
  ch("P08", "Instagram Ads (Meta)", { family: "paid_social", stages: ["unaware", "problem", "returning"], minMonthly: 300, measure: 75 }),
  ch("P09", "LinkedIn Ads", { family: "paid_social", learn: "weeks", cash: 3, minMonthly: 1500, stages: ["problem", "solution"], requires: ["b2b"], measure: 70 }),
  ch("P10", "TikTok Ads", { family: "paid_social", stages: ["unaware", "problem"], minMonthly: 500, measure: 65 }),
  ch("P11", "Pinterest Ads", { family: "paid_social", stages: ["problem", "solution"], minMonthly: 300, measure: 65 }),
  ch("P12", "Reddit Ads", { family: "paid_social", stages: ["problem", "solution"], minMonthly: 300, measure: 60 }),
  ch("P13", "X Ads", { family: "paid_social", stages: ["unaware"], minMonthly: 300, measure: 55 }),
  ch("P14", "Snapchat Ads", { family: "paid_social", stages: ["unaware"], minMonthly: 300, requires: ["b2c"], measure: 55 }),
  ch("P15", "Apple Search Ads", { requires: ["app"], minMonthly: 300 }),
  ch("P16", "App install ads", { family: "paid_social", requires: ["app"], minMonthly: 500 }),
  ch("P17", "Marketplace sponsored listings", { family: "marketplaces", requires: ["products"], minMonthly: 200 }),
  ch("P18", "Retail media ads", { family: "marketplaces", requires: ["products"], minMonthly: 1000 }),
  ch("P19", "Native advertising", { family: "paid_social", stages: ["unaware", "problem"], minMonthly: 1000, measure: 55 }),
  ch("P20", "Programmatic display", { family: "paid_social", stages: ["unaware"], minMonthly: 2000, measure: 45 }),
  ch("P21", "Connected TV ads", { family: "traditional", cash: 3, stages: ["unaware"], minMonthly: 5000, measure: 30 }),
  ch("P22", "Digital out-of-home ads", { family: "traditional", cash: 3, stages: ["unaware"], minMonthly: 3000, measure: 20 }),
  ch("P23", "Podcast ads", { family: "video_audio", learn: "weeks", stages: ["unaware", "problem"], minMonthly: 800, measure: 40 }),
  ch("P24", "Newsletter sponsorships", { family: "content", learn: "weeks", stages: ["problem", "solution"], minMonthly: 200, measure: 60 }),
  ch("P25", "Retargeting ads", { family: "retargeting", stages: ["returning"], minMonthly: 150, measure: 80 }),
  // C. Organic social
  ch("O01", "LinkedIn company page", { requires: ["b2b"] }),
  ch("O02", "LinkedIn personal profile (founder)", { stages: ["unaware", "problem", "solution"], scale: 2 }),
  ch("O03", "Facebook page", { exec: "auto" }),
  ch("O04", "Facebook groups", { family: "communities", exec: "human" }),
  ch("O05", "Instagram posts", { exec: "auto" }),
  ch("O06", "Instagram Reels", { exec: "auto", scale: 2 }),
  ch("O07", "Instagram Stories", { exec: "auto", stages: ["existing", "returning"] }),
  ch("O08", "TikTok", { scale: 2 }),
  ch("O09", "YouTube", { family: "video_audio", learn: "months", scale: 2, stages: ["problem", "solution"] }),
  ch("O10", "YouTube Shorts", { family: "video_audio", scale: 2 }),
  ch("O11", "X (Twitter)"),
  ch("O12", "Threads"),
  ch("O13", "Pinterest", { learn: "months", scale: 2, stages: ["problem", "solution"] }),
  ch("O14", "Reddit", { family: "communities", exec: "human", stages: ["problem", "solution"] }),
  ch("O15", "Quora", { family: "communities", exec: "human", stages: ["problem", "solution"], scale: 2 }),
  ch("O16", "Discord", { family: "communities", exec: "human" }),
  ch("O17", "Slack communities", { family: "communities", exec: "human", requires: ["b2b"] }),
  ch("O18", "Telegram communities", { family: "communities", exec: "human" }),
  ch("O19", "WhatsApp communities", { family: "communities", exec: "human", stages: ["existing", "returning"] }),
  ch("O20", "Niche social networks", { family: "communities", exec: "human" }),
  // D. Content
  ch("C01", "Blog articles"),
  ch("C02", "Educational guides"),
  ch("C03", "Case studies", { stages: ["product", "high_intent"], learn: "weeks" }),
  ch("C04", "White papers", { requires: ["b2b"], stages: ["solution"] }),
  ch("C05", "Research reports", { requires: ["b2b"], cash: 1, stages: ["unaware", "problem"] }),
  ch("C06", "Industry benchmark reports", { requires: ["b2b"], cash: 1, stages: ["problem"] }),
  ch("C07", "E-books"),
  ch("C08", "Templates", { family: "product_led", stages: ["solution", "product"], measure: 65 }),
  ch("C09", "Free tools", { family: "product_led", cash: 2, exec: "human", stages: ["problem", "solution", "product"], measure: 70 }),
  ch("C10", "Calculators", { family: "product_led", cash: 1, exec: "human", stages: ["solution", "high_intent"], measure: 70 }),
  ch("C11", "Interactive assessments", { family: "product_led", cash: 1, exec: "human", stages: ["problem", "solution"], measure: 65 }),
  ch("C12", "Infographics", { stages: ["unaware", "problem"], measure: 35 }),
  ch("C13", "Webinars", { family: "video_audio", learn: "weeks", exec: "partial", stages: ["solution", "product"], measure: 70 }),
  ch("C14", "Online workshops", { family: "video_audio", learn: "weeks", exec: "human", stages: ["solution", "product"], measure: 70 }),
  ch("C15", "Video tutorials", { family: "video_audio", exec: "partial", stages: ["solution", "product", "existing"] }),
  ch("C16", "Podcast (own show)", { family: "video_audio", exec: "human", stages: ["unaware", "problem"], measure: 30 }),
  ch("C17", "Livestreams", { family: "video_audio", learn: "weeks", exec: "human", stages: ["unaware", "product"], measure: 40 }),
  ch("C18", "Newsletter", { family: "email", learn: "weeks", stages: ["problem", "solution", "returning", "existing"], measure: 70 }),
  ch("C19", "Documentation", { requires: ["software"], stages: ["solution", "product", "existing"] }),
  ch("C20", "Knowledge base", { stages: ["product", "existing"] }),
  ch("C21", "Courses", { cash: 1, exec: "partial", stages: ["problem", "solution"] }),
  ch("C22", "Resource library", { stages: ["problem", "solution"] }),
  ch("C23", "Comparison guides", { stages: ["solution", "high_intent"], measure: 65 }),
  ch("C24", "Buyer guides", { stages: ["solution", "high_intent"], measure: 65 }),
  ch("C25", "Industry reports", { requires: ["b2b"], cash: 1, stages: ["unaware", "problem"] }),
  // E. Direct sales & outreach
  ch("D01", "Cold email"),
  ch("D02", "Cold calling", { exec: "human" }),
  ch("D03", "LinkedIn outreach", { requires: ["b2b"] }),
  ch("D04", "Personalized video outreach", { exec: "human" }),
  ch("D05", "Account-based marketing", { requires: ["b2b"], learn: "weeks", cash: 2, exec: "human", minMonthly: 1000 }),
  ch("D06", "Sales development reps (SDRs)", { requires: ["b2b"], cash: 3, exec: "human", minMonthly: 5000 }),
  ch("D07", "Founder-led sales", { exec: "human", requires: ["b2b"] }),
  ch("D08", "Field sales", { exec: "human", cash: 2, minMonthly: 2000 }),
  ch("D09", "Door-to-door", { exec: "human", requires: ["location", "b2c"] }),
  ch("D10", "Direct mail", { family: "traditional", cash: 2, exec: "partial", minMonthly: 300, measure: 55 }),
  ch("D11", "Executive networking", { exec: "human", requires: ["b2b"], measure: 40 }),
  ch("D12", "Referral introductions", { family: "referral", exec: "human", stages: ["product", "high_intent"], measure: 70 }),
  ch("D13", "Trade show prospecting", { family: "events", exec: "human", cash: 2, minMonthly: 1000, requires: ["b2b"] }),
  ch("D14", "Procurement outreach", { requires: ["b2b"], exec: "human", learn: "months" }),
  ch("D15", "Channel partner prospecting", { family: "distribution", requires: ["b2b"], exec: "partial", learn: "weeks" }),
  ch("D16", "Personalized website audits", { exec: "partial", requires: ["b2b"] }),
  ch("D17", "Personalized product demos", { exec: "human" }),
  ch("D18", "WhatsApp Business outreach", { exec: "partial", regulatedCaution: true }),
  ch("D19", "SMS outreach", { exec: "partial", regulatedCaution: true, stages: ["returning", "existing"] }),
  ch("D20", "Social selling", { exec: "human", stages: ["problem", "solution", "product"] }),
  // F. Partnerships & distribution
  ch("R01", "Affiliate program", { exec: "partial", learn: "months", measure: 85 }),
  ch("R02", "Customer referral program", { family: "referral", exec: "partial", stages: ["existing"], measure: 85 }),
  ch("R03", "Reseller program", { family: "distribution", learn: "months", requires: ["b2b"] }),
  ch("R04", "White-label partnerships", { family: "distribution", learn: "months" }),
  ch("R05", "Agency partnerships"),
  ch("R06", "Technology partnerships", { requires: ["software"] }),
  ch("R07", "Integration partnerships", { requires: ["software"], measure: 70 }),
  ch("R08", "Co-marketing"),
  ch("R09", "Co-selling", { requires: ["b2b"] }),
  ch("R10", "Strategic alliances", { learn: "months" }),
  ch("R11", "Distributor networks", { family: "distribution", learn: "months", requires: ["products"] }),
  ch("R12", "Retail partnerships", { family: "distribution", learn: "months", requires: ["products"] }),
  ch("R13", "OEM partnerships", { family: "distribution", learn: "months" }),
  ch("R14", "Franchise networks", { family: "distribution", learn: "months" }),
  ch("R15", "Industry associations", { learn: "months", measure: 40 }),
  ch("R16", "Educational partnerships", { learn: "months" }),
  ch("R17", "Corporate partnerships", { learn: "months" }),
  ch("R18", "Influencer partnerships", { family: "creators", learn: "weeks", exec: "partial", cash: 2, minMonthly: 300, stages: ["unaware", "problem", "product"] }),
  ch("R19", "Community partnerships", { measure: 45 }),
  ch("R20", "Embedded distribution", { family: "distribution", requires: ["software"], learn: "months" }),
  // G. Marketplaces & directories
  ch("M01", "Amazon", { requires: ["products"], measure: 85 }),
  ch("M02", "Etsy", { requires: ["products"], measure: 85 }),
  ch("M03", "eBay", { requires: ["products"], measure: 85 }),
  ch("M04", "Alibaba", { requires: ["products", "b2b"] }),
  ch("M05", "Faire (wholesale)", { requires: ["products", "b2b"] }),
  ch("M06", "Apple App Store", { requires: ["app"] }),
  ch("M07", "Google Play", { requires: ["app"] }),
  ch("M08", "Mac App Store", { requires: ["desktop"] }),
  ch("M09", "Microsoft Store", { requires: ["desktop"] }),
  ch("M10", "Product Hunt", { requires: ["software"], learn: "days", stages: ["unaware", "product"], measure: 60 }),
  ch("M11", "G2", { requires: ["software", "b2b"] }),
  ch("M12", "Capterra", { requires: ["software", "b2b"] }),
  ch("M13", "TrustRadius", { requires: ["software", "b2b"] }),
  ch("M14", "AlternativeTo", { requires: ["software"] }),
  ch("M15", "Clutch", { requires: ["b2b"] }),
  ch("M16", "Upwork", { exec: "human" }),
  ch("M17", "Fiverr", { exec: "human" }),
  ch("M18", "Booking platforms", { requires: ["booking"] }),
  ch("M19", "Property portals", { requires: ["property"], cash: 2 }),
  ch("M20", "Industry directories"),
  ch("M21", "Integration marketplaces", { requires: ["software"], scale: 2 }),
  ch("M22", "Cloud marketplaces", { requires: ["software", "b2b"] }),
  ch("M23", "Browser extension stores", { requires: ["software"] }),
  ch("M24", "AI tool directories", { requires: ["ai"], learn: "days" }),
  ch("M25", "Template marketplaces", { requires: ["digital_goods"] }),
  // H. Community & relationships
  ch("N01", "Reddit communities"),
  ch("N02", "Discord servers"),
  ch("N03", "Slack communities", { requires: ["b2b"] }),
  ch("N04", "Facebook groups"),
  ch("N05", "Professional associations", { requires: ["b2b"] }),
  ch("N06", "Alumni networks"),
  ch("N07", "Founder communities", { requires: ["b2b"] }),
  ch("N08", "Developer communities", { requires: ["developer"] }),
  ch("N09", "Local business networks", { requires: ["location"] }),
  ch("N10", "Customer community", { stages: ["existing"] }),
  ch("N11", "Brand ambassador program", { family: "referral", stages: ["existing"], measure: 60 }),
  ch("N12", "Community events", { family: "events" }),
  ch("N13", "Online meetups"),
  ch("N14", "User groups", { requires: ["software"], stages: ["existing"] }),
  ch("N15", "Customer advocacy program", { family: "referral", stages: ["existing"], measure: 60 }),
  // I. Events & offline
  ch("E01", "Industry conferences", { cash: 3, minMonthly: 1500, requires: ["b2b"] }),
  ch("E02", "Trade shows", { cash: 3, minMonthly: 2000 }),
  ch("E03", "Exhibitions", { cash: 3, minMonthly: 2000 }),
  ch("E04", "Networking events", { cash: 1, minMonthly: 0 }),
  ch("E05", "Webinars (hosted)", { family: "video_audio", cash: 0, minMonthly: 0, exec: "partial", measure: 70 }),
  ch("E06", "Workshops", { cash: 1, minMonthly: 0 }),
  ch("E07", "Seminars", { cash: 1, minMonthly: 200 }),
  ch("E08", "Product launch events"),
  ch("E09", "Pop-up stores", { requires: ["products"], cash: 3, minMonthly: 1500 }),
  ch("E10", "Community events (local)", { cash: 1, minMonthly: 100, requires: ["location"] }),
  ch("E11", "Sponsorships", { cash: 2, minMonthly: 500, measure: 25 }),
  ch("E12", "Billboards", { family: "traditional", cash: 3, minMonthly: 1500, measure: 15 }),
  ch("E13", "Radio ads", { family: "traditional", cash: 3, minMonthly: 1000, measure: 20 }),
  ch("E14", "TV ads", { family: "traditional", cash: 3, minMonthly: 10000, measure: 20 }),
  ch("E15", "Print ads", { family: "traditional", cash: 2, minMonthly: 500, measure: 20 }),
  ch("E16", "Flyers", { family: "local", cash: 1, minMonthly: 100, requires: ["location"], measure: 30 }),
  ch("E17", "Direct mail (offline)", { family: "traditional", cash: 2, minMonthly: 300, measure: 55 }),
  ch("E18", "Vehicle advertising", { family: "local", cash: 2, minMonthly: 0, requires: ["location"], measure: 15 }),
  ch("E19", "In-store promotions", { family: "local", requires: ["location"], minMonthly: 100 }),
  ch("E20", "Product sampling", { requires: ["products"], minMonthly: 300, stages: ["product"] }),
  // J. Product-led & viral
  ch("V01", "Freemium plan", { requires: ["software"] }),
  ch("V02", "Free trial", { requires: ["software"], stages: ["product", "high_intent"] }),
  ch("V03", "Free tools (product-led)", { requires: ["software"], stages: ["problem", "solution"] }),
  ch("V04", "Interactive demo", { requires: ["software"], exec: "partial", stages: ["product", "high_intent"] }),
  ch("V05", "Public templates", { requires: ["software"], exec: "partial", stages: ["solution", "product"] }),
  ch("V06", "Shareable reports", { requires: ["software"] }),
  ch("V07", "Invite a teammate", { requires: ["software"] }),
  ch("V08", "Collaboration invites", { requires: ["software"] }),
  ch("V09", "Viral sharing loop"),
  ch("V10", "Powered-by attribution", { requires: ["software"], stages: ["unaware", "product"] }),
  ch("V11", "Embedded widgets", { requires: ["software"], stages: ["unaware", "product"] }),
  ch("V12", "Referral rewards (in product)", { family: "referral", requires: ["software"] }),
  ch("V13", "Public user profiles", { requires: ["software"] }),
  ch("V14", "Community-created templates", { requires: ["software"] }),
  ch("V15", "Open-source distribution", { requires: ["developer"] }),
  ch("V16", "API ecosystem", { requires: ["developer"] }),
  ch("V17", "Browser extension", { requires: ["software"] }),
  ch("V18", "Free developer tier", { requires: ["developer"] }),
  ch("V19", "Product integrations", { requires: ["software"] }),
  ch("V20", "User-generated content", { family: "creators", exec: "partial", stages: ["unaware", "product"], measure: 45 }),
  // Extras referenced by the business-type lists (email lifecycle and re-engagement)
  ch("X01", "Lifecycle and nurture email", { family: "email", learn: "weeks", cash: 0, scale: 2, exec: "auto", minMonthly: 0, measure: 85, stages: ["returning", "existing", "product"] }),
  ch("X02", "Abandoned-cart recovery", { family: "retargeting", learn: "days", cash: 0, scale: 1, exec: "auto", minMonthly: 0, measure: 90, stages: ["returning"], requires: ["products"] }),
  ch("X03", "Win-back campaigns", { family: "retargeting", learn: "weeks", cash: 0, scale: 1, exec: "auto", minMonthly: 0, measure: 85, stages: ["existing"] }),
  ch("X04", "Reviews and reputation program", { family: "referral", learn: "weeks", cash: 0, scale: 2, exec: "partial", minMonthly: 0, measure: 60, stages: ["product", "high_intent"] }),
  ch("X05", "Local press and PR", { family: "pr", learn: "weeks", cash: 1, scale: 1, exec: "partial", minMonthly: 0, measure: 30, stages: ["unaware"] }),
  ch("X06", "Podcast guesting", { family: "pr", learn: "weeks", cash: 0, scale: 1, exec: "human", minMonthly: 0, measure: 35, stages: ["unaware", "problem"] }),
  ch("X07", "Gift guides", { family: "pr", learn: "weeks", cash: 1, scale: 1, exec: "partial", minMonthly: 0, measure: 50, stages: ["product"], requires: ["products"] }),
  ch("X08", "Public tenders and procurement portals", { family: "distribution", learn: "months", cash: 1, scale: 1, exec: "human", minMonthly: 0, measure: 80, stages: ["high_intent"], requires: ["gov"] }),
  ch("X09", "Google Ad Grants", { family: "paid_search", learn: "weeks", cash: 0, scale: 0, exec: "partial", minMonthly: 0, measure: 80, stages: ["problem", "high_intent"], requires: ["nonprofit"] }),
  ch("X10", "Event listing platforms (Eventbrite, Meetup)", { family: "marketplaces", learn: "days", cash: 0, scale: 1, exec: "partial", minMonthly: 0, measure: 75, stages: ["product", "high_intent"], requires: ["events"] }),
];

export const CHANNEL_BY_ID: Record<string, Channel> = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

/* ---------------- business types ---------------- */

export type Category = "software" | "commerce" | "services";
export type CustomerType = "b2b" | "b2c" | "both";

export interface BusinessType {
  key: string;
  label: string;
  category: Category;
  customer: CustomerType;
  /** Traits it gives the business for eligibility checks. */
  traits: Requirement[];
  /** The framework's highest-priority starting channels. */
  starters: string[];
  /** Other channels that commonly fit. */
  channels: string[];
  /** A note shown when the type is regulated. */
  regulated?: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { key: "b2b_saas", label: "B2B SaaS", category: "software", customer: "b2b", traits: ["software", "b2b"], starters: ["S09", "S10", "P01", "R07", "M21", "O02", "V01", "V02", "D01"], channels: ["S01", "S06", "S08", "S14", "C01", "C08", "C09", "C15", "O01", "N01", "O15", "M10", "M11", "M12", "M14", "R01", "R02", "R05", "R06", "P02", "P09", "P24", "P25", "D03", "D07", "C13", "V05", "V07", "V10", "V11", "X01"] },
  { key: "b2c_saas", label: "B2C SaaS", category: "software", customer: "b2c", traits: ["software", "b2c"], starters: ["S01", "O08", "O06", "R18", "R02", "V02"], channels: ["S13", "O09", "O10", "O13", "O14", "P07", "P10", "P01", "M10", "R01", "V01", "V09", "V20", "P24", "P23", "X01", "P25", "X04"] },
  { key: "enterprise_software", label: "Enterprise software", category: "software", customer: "b2b", traits: ["software", "b2b"], starters: ["D05", "D06", "R10", "E01", "C05"], channels: ["D03", "D01", "D02", "D11", "E02", "C04", "C13", "C03", "P09", "P01", "S01", "R09", "R03", "M22", "D10", "X08", "D17"] },
  { key: "developer_tools", label: "Developer tools & APIs", category: "software", customer: "b2b", traits: ["software", "developer", "b2b"], starters: ["C19", "V15", "N08", "V18", "S01"], channels: ["C15", "O09", "O14", "M10", "R07", "M22", "C13", "P24", "E01", "V16", "N02", "O16", "R06", "M21"] },
  { key: "mobile_app", label: "Mobile app", category: "software", customer: "b2c", traits: ["software", "app", "b2c"], starters: ["S18", "P15", "O08", "O10", "X04", "R02"], channels: ["P16", "P10", "P07", "R18", "M10", "O14", "O06", "V09", "M06", "M07", "S01", "X05", "R01"] },
  { key: "desktop_app", label: "Desktop app", category: "software", customer: "both", traits: ["software", "desktop"], starters: ["S01", "M08", "M14", "R18", "O14", "R08"], channels: ["S02", "S14", "M09", "M10", "O09", "P24", "R01", "V02", "V01", "S09", "S10", "C15", "N01", "P01"] },
  { key: "ai_product", label: "AI product or agent", category: "software", customer: "both", traits: ["software", "ai"], starters: ["C15", "S01", "M24", "R07", "V06", "V09"], channels: ["M10", "S14", "O09", "O08", "O02", "O11", "O14", "M21", "M23", "P24", "R01", "R18", "V04", "V05", "C13", "P01"] },
  { key: "marketplace", label: "Two-sided marketplace", category: "software", customer: "both", traits: ["software"], starters: ["D01", "S06", "P01", "R02", "V09"], channels: ["D03", "O04", "R15", "S01", "P07", "P10", "R18", "R01", "C01", "X05", "P25", "X01", "V11"] },
  { key: "gaming", label: "Gaming", category: "software", customer: "b2c", traits: ["software", "b2c"], starters: ["M06", "M07", "R18", "O16", "O14"], channels: ["O08", "O09", "X05", "P10", "P07", "P06", "P16", "E03", "V09", "R02", "N02"] },
  { key: "digital_products", label: "Digital products", category: "software", customer: "both", traits: ["digital_goods"], starters: ["M25", "S01", "C08", "R18", "N01"], channels: ["O13", "O05", "O08", "C15", "P24", "R01", "M10", "M02", "C18", "P07", "P01"] },
  { key: "dtc_ecommerce", label: "DTC e-commerce", category: "commerce", customer: "b2c", traits: ["products", "b2c"], starters: ["P03", "P07", "P08", "V20", "S11", "R02"], channels: ["P01", "P04", "S01", "O05", "O06", "O08", "P10", "P11", "R18", "R01", "N11", "X01", "X02", "P25", "X04", "X07", "P24", "M01", "E20"] },
  { key: "marketplace_seller", label: "Marketplace seller", category: "commerce", customer: "b2c", traits: ["products", "b2c"], starters: ["S17", "P17", "X04", "M01"], channels: ["M02", "M03", "P03", "O13", "O08", "R18", "S01", "P18"] },
  { key: "physical_retail", label: "Physical retail", category: "commerce", customer: "b2c", traits: ["products", "location", "b2c"], starters: ["S04", "S03", "P07", "E19", "R02"], channels: ["S05", "P01", "O05", "O08", "R18", "E16", "D10", "E10", "N09", "X04", "D19", "X05", "E12"] },
  { key: "wholesale", label: "Wholesale & distribution", category: "commerce", customer: "b2b", traits: ["products", "b2b"], starters: ["D01", "M05", "E02", "R11"], channels: ["D02", "D03", "M04", "M20", "S01", "P01", "R15", "D13", "E20", "R12"] },
  { key: "manufacturing", label: "Manufacturing", category: "commerce", customer: "b2b", traits: ["products", "b2b"], starters: ["S01", "P01", "D14", "E02", "D01"], channels: ["D03", "M04", "M20", "R15", "R13", "R11", "C19", "C15", "X08", "E01"] },
  { key: "subscription_commerce", label: "Subscription commerce", category: "commerce", customer: "b2c", traits: ["products", "b2c"], starters: ["R18", "P07", "R02", "X07"], channels: ["P10", "P01", "R01", "O08", "O09", "S01", "O13", "X01", "X03", "P24", "P23", "P25", "E20"] },
  { key: "luxury", label: "Luxury & premium brand", category: "commerce", customer: "b2c", traits: ["products", "b2c"], starters: ["X05", "R18", "R08", "D12"], channels: ["O05", "O13", "O09", "E08", "R12", "P01", "D10", "S08"] },
  { key: "food_beverage", label: "Food & beverage brand", category: "commerce", customer: "b2c", traits: ["products", "b2c"], starters: ["E20", "R12", "R18", "O08", "O05"], channels: ["O09", "S08", "P03", "P07", "P10", "E03", "R11", "X05", "X04", "R02"] },
  { key: "agency", label: "Creative or digital agency", category: "services", customer: "b2b", traits: ["b2b"], starters: ["D12", "C03", "D03", "R05", "S08"], channels: ["S01", "M15", "O02", "D01", "D16", "D04", "R04", "C13", "X06", "O09", "M16", "N09", "P01", "P24"] },
  { key: "consulting", label: "Consulting", category: "services", customer: "b2b", traits: ["b2b"], starters: ["D12", "D11", "O02", "D01"], channels: ["E01", "C13", "C04", "C05", "X06", "S01", "P01", "D05", "N05", "N06", "C18", "C03"] },
  { key: "professional_services", label: "Professional services", category: "services", customer: "both", traits: ["location"], starters: ["S01", "S04", "P01", "D12", "X04"], channels: ["S03", "M20", "N05", "O02", "C13", "C02", "O09", "N09", "D10", "X06"], regulated: "Legal, accounting and financial advice can have rules on advertising, testimonials and referral fees." },
  { key: "local_services", label: "Local services", category: "services", customer: "b2c", traits: ["location", "b2c", "booking"], starters: ["S04", "P01", "X04", "R02"], channels: ["S03", "S05", "O04", "P07", "O05", "M20", "E16", "D10", "E18", "E10", "N09", "D19", "C02"] },
  { key: "healthcare", label: "Healthcare services", category: "services", customer: "b2c", traits: ["location", "b2c", "booking"], starters: ["S04", "S03", "M18", "D12", "X04"], channels: ["P01", "M20", "C02", "O09", "O05", "E10", "R17", "N09"], regulated: "Patient privacy and health-advertising rules apply; no testimonials or outcome claims without review." },
  { key: "education", label: "Education & training", category: "services", customer: "both", traits: [], starters: ["O09", "S01", "C13", "R02", "R16"], channels: ["P01", "P07", "P10", "C14", "C21", "C18", "R01", "R18", "O14", "O16", "X06", "E06", "M20"] },
  { key: "real_estate", label: "Real estate", category: "services", customer: "b2c", traits: ["location", "property", "b2c"], starters: ["M19", "D12", "S03", "O06", "O08"], channels: ["S01", "P01", "P07", "O09", "R17", "E08", "D10", "C18", "O19", "E12"] },
  { key: "hospitality", label: "Hospitality & travel", category: "services", customer: "b2c", traits: ["location", "booking", "b2c"], starters: ["S04", "M18", "X04", "O05", "R18"], channels: ["S01", "S03", "P01", "P07", "O08", "O06", "R08", "C18", "R02", "P25", "X05"] },
  { key: "events", label: "Events & entertainment", category: "services", customer: "both", traits: ["events"], starters: ["X10", "P07", "R19", "C18"], channels: ["P01", "P10", "O05", "O08", "R18", "R17", "X05", "P25", "R02", "E11"] },
  { key: "financial_services", label: "Financial services", category: "services", customer: "both", traits: [], starters: ["P01", "M20", "D12", "R10"], channels: ["S01", "R01", "C02", "O09", "C18", "X06", "O02", "S18", "R17", "C13", "X05"], regulated: "Financial promotions may need licensing, disclosures and platform approval." },
  { key: "media_creator", label: "Media & creator business", category: "services", customer: "b2c", traits: ["b2c"], starters: ["O09", "O10", "R08", "S01", "R02"], channels: ["O08", "O06", "O02", "O11", "O14", "S15", "S16", "X06", "P24", "C18", "N02", "R18"] },
  { key: "nonprofit", label: "Nonprofit or membership", category: "services", customer: "both", traits: ["nonprofit"], starters: ["R19", "R02", "C18", "E10"], channels: ["S01", "X09", "O03", "O05", "O02", "R17", "X05", "D10", "N05", "E11"] },
];

export const TYPE_BY_KEY: Record<string, BusinessType> = Object.fromEntries(BUSINESS_TYPES.map((t) => [t.key, t]));

/** Best guess from the onboarding classifier's coarse type (refined by the agent). */
export function typesFromLegacy(t: string | null | undefined): string[] {
  switch (t) {
    case "saas":
      return ["b2b_saas"];
    case "ecommerce":
    case "physical_products":
      return ["dtc_ecommerce"];
    case "services":
      return ["local_services"];
    default:
      return [];
  }
}

/* ---------------- budget bands (Part 7) ---------------- */

export interface BudgetBand {
  max: number;
  label: string;
  approach: string;
  /** Channels that may be "in the plan" at once (paid ones included). */
  maxChannels: number;
  maxPaid: number;
}
export const BUDGET_BANDS: BudgetBand[] = [
  { max: 100, label: "$0–100", approach: "Organic content, SEO foundations, referrals, communities", maxChannels: 2, maxPaid: 0 },
  { max: 500, label: "$100–500", approach: "One organic channel plus small paid experiments", maxChannels: 2, maxPaid: 1 },
  { max: 1000, label: "$500–1,000", approach: "One primary channel plus supporting experiments", maxChannels: 3, maxPaid: 1 },
  { max: 5000, label: "$1,000–5,000", approach: "Two or three focused channels with conversion tracking", maxChannels: 3, maxPaid: 2 },
  { max: 20000, label: "$5,000–20,000", approach: "Diversified acquisition with systematic testing", maxChannels: 4, maxPaid: 3 },
  { max: 100000, label: "$20,000–100,000", approach: "Multi-channel growth, creative testing, dedicated measurement", maxChannels: 5, maxPaid: 4 },
  { max: Number.POSITIVE_INFINITY, label: "$100,000+", approach: "Integrated portfolio with advanced attribution", maxChannels: 6, maxPaid: 5 },
];
export function budgetBand(monthlyUsd: number): BudgetBand {
  return BUDGET_BANDS.find((b) => monthlyUsd <= b.max) ?? BUDGET_BANDS[BUDGET_BANDS.length - 1];
}
