/**
 * Marketing copy in one place so pages stay consistent and reviewable.
 * Honest by rule: no testimonials, customer logos, revenue claims or guarantees.
 */

export const CTA = {
  start: { label: "Start with your website", href: "/sign-in?next=/onboarding" },
  demo: { label: "Try the demo", href: "/demo" },
  getStarted: { label: "Get started", href: "/sign-in?next=/onboarding" },
} as const;

export const PRODUCT_LINE =
  "Tell ClimbOS your goal. Your AI growth team researches your business, builds the plan, creates the work and measures what happens — you approve anything that goes live.";

export const STEPS = [
  {
    title: "Tell us your business and your goal",
    body: "Share your website and what you want most — more customers, more sales or more reach. No forms full of jargon.",
  },
  {
    title: "ClimbOS gets to know your business",
    body: "It reads your website and looks at who you serve, your competitors, your pricing and how you stand out. You get a clear picture of strengths, gaps and the path a customer takes to buy.",
  },
  {
    title: "You get a growth plan",
    body: "Which channels to focus on, which experiments to run, what they're likely to cost and how we'll tell whether they worked.",
  },
  {
    title: "The work gets made",
    body: "Posts, graphics, ads, emails and pages for search — written for your business, in your voice.",
  },
  {
    title: "You approve, then it goes live",
    body: "Nothing is published or spent until you say yes. Approved work goes out on the accounts you've connected.",
  },
  {
    title: "Results, explained in plain English",
    body: "What happened, what it cost, what we learned and what to try next. If there isn't enough data yet, we say so.",
  },
] as const;

export interface Role {
  key: string;
  emoji: string;
  emojiLabel: string;
  title: string;
  body: string;
  note?: string;
}

export const ROLES: Role[] = [
  {
    key: "ceo",
    emoji: "🧠",
    emojiLabel: "Brain",
    title: "AI CEO",
    body: "Understands your goals, sets priorities and keeps the whole team working on what matters most.",
  },
  {
    key: "coo",
    emoji: "⚙️",
    emojiLabel: "Gear",
    title: "AI COO",
    body: "Runs the workflows behind the scenes so work moves smoothly from idea to done.",
  },
  {
    key: "cmo",
    emoji: "📈",
    emojiLabel: "Rising chart",
    title: "AI CMO",
    body: "Creates and runs your marketing strategy, and decides where effort goes first.",
  },
  {
    key: "cso",
    emoji: "💰",
    emojiLabel: "Money bag",
    title: "AI CSO",
    body: "Shapes your sales approach, sorts the most promising leads and helps more of them become customers.",
  },
  {
    key: "creative",
    emoji: "🎨",
    emojiLabel: "Artist palette",
    title: "AI Creative Director",
    body: "Makes graphics, ad creatives and short-video scripts that look and sound like you.",
    note: "Full video production is quoted separately.",
  },
  {
    key: "social",
    emoji: "📱",
    emojiLabel: "Mobile phone",
    title: "AI Social Media Manager",
    body: "Plans, writes, schedules and publishes your posts.",
  },
  {
    key: "ads",
    emoji: "🎯",
    emojiLabel: "Target",
    title: "AI Ads Manager",
    body: "Creates, watches and improves ad campaigns — always within the budget you approve.",
  },
  {
    key: "seo",
    emoji: "🔍",
    emojiLabel: "Magnifying glass",
    title: "AI SEO Specialist",
    body: "Helps more people find you on Google and in AI search tools, without paying for every visit.",
  },
  {
    key: "data",
    emoji: "📊",
    emojiLabel: "Bar chart",
    title: "AI Data Analyst",
    body: "Keeps an eye on performance and spots opportunities. Numbers come from real calculations, not AI guesses.",
  },
  {
    key: "success",
    emoji: "🤝",
    emojiLabel: "Handshake",
    title: "AI Customer Success Manager",
    body: "Helps you keep customers happy, engaged and coming back.",
  },
];

export interface Capability {
  letter: string;
  title: string;
  summary: string;
  items: string[];
  note?: string;
}

export const CAPABILITIES: Capability[] = [
  {
    letter: "A",
    title: "Understand your business",
    summary: "A clear, sourced picture of where you stand today.",
    items: [
      "Website and product review",
      "Competitor research",
      "Who your best customers are",
      "Market opportunities",
      "Pricing review",
      "How you stand out",
      "Strengths, weaknesses, opportunities and threats",
      "The path a customer takes to buy",
    ],
  },
  {
    letter: "B",
    title: "Growth strategy",
    summary: "A plan that keeps improving as results come in.",
    items: [
      "Revenue growth plan",
      "How to win new customers",
      "Which channels to focus on",
      "Fixing leaks in your sales path",
      "Launch plans",
      "Keeping and converting more customers",
      "Small experiments to learn fast",
    ],
  },
  {
    letter: "C",
    title: "Social media",
    summary: "Posts planned, written, designed and scheduled.",
    items: [
      "Content calendars and captions",
      "Branded graphics",
      "Short-video scripts",
      "Scheduling and publishing",
      "Trend research",
      "What's getting engagement, and why",
    ],
    note: "Facebook and Instagram business accounts publish directly once connected. LinkedIn, X, TikTok, Pinterest and YouTube get ready-to-post drafts and export packs until their official integrations are available.",
  },
  {
    letter: "D",
    title: "Advertising",
    summary: "Google and Meta ads, built carefully and launched only with your OK.",
    items: [
      "Ad copy, creative and audiences",
      "Campaigns created paused, launched only when you approve",
      "Side-by-side tests",
      "Budget recommendations within your limits",
      "Return-on-ad-spend monitoring",
      "LinkedIn Ads drafts",
    ],
    note: "Ad spend is paid directly to Google or Meta. ClimbOS never marks it up.",
  },
  {
    letter: "E",
    title: "Sales engine",
    summary: "Drop your website link. We find the people who need you, write the emails and book the calls.",
    items: [
      "Finds companies that fit, each with a source you can check",
      "A personal first line for each, from that source",
      "Short email sequences and follow-ups",
      "Your own booking page and calendar invites",
      "A simple pipeline: found, emailed, replied, booked",
      "Scoring for leads you already have",
    ],
    note: "ClimbOS doesn't sell a contact database. It finds businesses from public sources and shows where every fact came from. You approve who gets an email.",
  },
  {
    letter: "F",
    title: "Content and search",
    summary: "Get found by people already looking for what you offer.",
    items: [
      "Keyword research",
      "Search health check-ups",
      "Blog posts and landing pages",
      "Product descriptions",
      "Internal linking",
      "Search performance tracking",
      "Visibility in AI search tools",
    ],
  },
  {
    letter: "G",
    title: "Email marketing",
    summary: "Emails people actually want to open.",
    items: [
      "Newsletters",
      "Welcome sequences",
      "Abandoned-cart reminders",
      "Promotions",
      "Win-back emails for quiet customers",
    ],
    note: "Sent through your own email provider, only to people who agreed to hear from you, with unsubscribes handled.",
  },
  {
    letter: "H",
    title: "Conversion and revenue",
    summary: "More revenue doesn't always require more traffic.",
    items: [
      "Landing page reviews",
      "Checkout and pricing recommendations",
      "Where people drop off, and why",
      "Side-by-side page tests",
      "Spotting revenue you're leaving on the table",
    ],
  },
];

export const TRUST = [
  {
    title: "You approve before anything goes live",
    body: "Posts, ads, emails and page changes wait for your OK. On plans with recurring campaigns, you approve the campaign and its rules first — ClimbOS stays inside them.",
  },
  {
    title: "One button pauses everything",
    body: "“Pause all activity” stops publishing, sending and ad changes right away. Resume whenever you're ready.",
  },
  {
    title: "Spending stays within your limits",
    body: "You set the budget. Ad spend is paid directly to Google or Meta from your own account — never marked up by us.",
  },
  {
    title: "Honest forecasts",
    body: "We show likely ranges, not promises. When there isn't enough data yet, ClimbOS says “not enough data yet” instead of guessing.",
  },
  {
    title: "Your data is yours",
    body: "Export or delete it any time. Account connections are encrypted. We never sell your data.",
  },
  {
    title: "No surprise charges",
    body: "Plans have clear monthly limits with alerts at 70%, 90% and 100%. Extra capacity is only added when you click buy.",
  },
] as const;

export const WONT_DO = [
  { title: "Write fake reviews or testimonials", body: "Not for you, not for us. Everything we publish is honest." },
  { title: "Sell or buy contact lists", body: "We work only with leads you already have or data you license yourself." },
  { title: "Spend money without your approval", body: "No ad goes live and no budget changes without your yes, inside the limits you set." },
  { title: "Promise guaranteed results", body: "Nobody can honestly promise that. We show what's likely, then measure what actually happened." },
  { title: "Email people who didn't sign up", body: "Marketing emails go only to people who agreed to hear from you." },
  { title: "Hide what the AI did", body: "Every action is logged in plain language, so you can see who did what and why." },
] as const;

export const LANDING_FAQ = [
  {
    q: "Do I need marketing experience?",
    a: "No. ClimbOS explains every recommendation in plain English and tells you exactly what it needs from you — usually just a yes or no.",
  },
  {
    q: "Will ClimbOS post or spend money without asking?",
    a: "No. Anything that goes live — a post, an ad, an email, a page change — waits for your approval. You can pause all activity with one button.",
  },
  {
    q: "Which platforms can it publish to?",
    a: "Facebook and Instagram business accounts publish directly once connected. For LinkedIn, X, TikTok, Pinterest and YouTube, you get ready-to-post drafts and export packs until their official integrations are available. Google Ads and Meta ad campaigns are created paused and launched only with your approval.",
  },
  {
    q: "Does ClimbOS find leads for me?",
    a: "Yes. Give it your website and it finds companies that need you from public sources, with evidence for each, writes the emails and gives you a booking page. It doesn't sell a contact database, and nothing is sent until you approve.",
  },
  {
    q: "Can you guarantee results?",
    a: "No one honestly can. ClimbOS shows likely ranges based on real calculations, then measures what actually happened and adjusts the plan.",
  },
  {
    q: "What happens to my data?",
    a: "It's yours. You can export or delete it any time. Connections to your accounts are encrypted, and we never sell your data.",
  },
  {
    q: "What if I reach my monthly limit?",
    a: "You'll get alerts at 70%, 90% and 100%. At the limit, new work pauses until next month — unless you choose to buy an extra capacity pack. Nothing is charged automatically.",
  },
] as const;

export const AUTONOMY_LABELS: Record<string, { title: string; body: string }> = {
  copilot: { title: "You publish; ClimbOS drafts", body: "ClimbOS prepares everything; you post it yourself." },
  review: { title: "Review and approve", body: "ClimbOS publishes on your connected accounts after you approve each item." },
  bounded_autopilot: {
    title: "Approved recurring campaigns",
    body: "Approve a campaign and its rules once; ClimbOS runs it within those rules and your budget.",
  },
};
