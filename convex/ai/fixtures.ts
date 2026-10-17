import type {
  AdDraftsOutput,
  BusinessInsights,
  BusinessProfile,
  ChatIntentOutput,
  EmailSequenceOutput,
  SeoBriefOutput,
  SocialPostsOutput,
  StrategyOutput,
  TaskType,
} from "../../shared/ai/tasks";

/**
 * Deterministic fixture adapter for DEMO workspaces only. It never calls a
 * provider, never reports a fake provider success (results are labeled
 * `fixture`), and produces the same output for the same input. Production
 * adapters live in ./providers.ts and are separate.
 */

export interface FixtureContext {
  businessName: string;
  website?: string;
  facts: { statement: string; category: string }[];
  goal?: string;
  channel?: string;
  quantity?: number;
  request?: string;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function fixtureOutput(task: TaskType, ctx: FixtureContext): unknown {
  const n = ctx.businessName || "Your business";
  const seed = hash(`${task}:${n}:${ctx.request ?? ""}:${ctx.channel ?? ""}`);
  switch (task) {
    case "business_profile": {
      const out: BusinessProfile = {
        name: n,
        oneLineSummary: `${n} helps people build smart online forms quickly, with AI.`,
        businessType: "saas",
        audience: "Small teams and solo founders who collect leads, payments or feedback online",
        category: "Online form builder",
        facts: ctx.facts.slice(0, 8).map((f) => ({
          category: f.category as BusinessProfile["facts"][number]["category"],
          statement: f.statement,
          confidence: "medium",
          sourceUrl: ctx.website ?? "",
        })),
        brandVoice: "Friendly, clear and practical",
        suggestedSuccessEvents: [
          { key: "signup", label: "Sign-up", definition: "A new account is created" },
          { key: "first_form_published", label: "First form published", definition: "A new account publishes its first form" },
          { key: "paid_conversion", label: "Upgrade to paid", definition: "An account starts a paid plan" },
        ],
      };
      return out;
    }
    case "preview_ideas":
      return {
        ideas: [
          { title: "Use-case pages people search for", channel: "Search (SEO)", why: "People search for specific form types every day.", firstStep: "Publish one page for your most-requested form type.", role: "seo_specialist" },
          { title: "Short product demos", channel: "Instagram & Facebook", why: "Seeing a form built in seconds is persuasive.", firstStep: "Post a 20-second build of a real use case.", role: "social_media_manager" },
          { title: "Welcome emails that lead to a first win", channel: "Email", why: "New sign-ups who publish quickly are more likely to stay.", firstStep: "Send a 3-email welcome sequence.", role: "customer_success_manager" },
        ],
      };
    case "business_insights": {
      const out: BusinessInsights = {
        audiences: [
          { name: "Solo founders and freelancers", description: "Need lead capture and payments without a developer.", confidence: "medium" },
          { name: "Small marketing teams", description: "Run campaigns and need fast forms with logic.", confidence: "medium" },
          { name: "Coaches and course creators", description: "Collect applications and payments.", confidence: "low" },
        ],
        competitors: [
          { name: "General form builders", url: "", note: "Broad tools; ClimbOS should verify which ones the owner competes with most.", sourceUrl: "" },
        ],
        positioning: `${n} is the fastest way to describe a form and get a working, branded version — including logic and payments.`,
        pricingNotes: "Pricing details need owner confirmation before use in any content.",
        swot: {
          strengths: ["AI form creation from a description", "Conditional logic and payments built in"],
          weaknesses: ["Category has many alternatives", "Limited public proof (reviews/case studies) to reference yet"],
          opportunities: ["Use-case search pages", "Short demo videos", "Activation-focused onboarding emails"],
          threats: ["Established competitors with large marketing budgets", "AI features becoming common"],
        },
        journey: [
          { stage: "Discover", observation: "Visitors arrive from search and social.", opportunity: "Pages matched to specific form use cases." },
          { stage: "Try", observation: "Sign-up leads to a blank state.", opportunity: "Templates that publish in one click." },
          { stage: "Buy", observation: "Upgrade value depends on payments/AI features.", opportunity: "Show paid features at the moment they're needed." },
        ],
        opportunities: [
          { title: "Ten use-case landing pages", why: "Matches high-intent searches.", effort: "medium" },
          { title: "First-form activation emails", why: "Turns sign-ups into active users.", effort: "small" },
          { title: "Small search-ad test", why: "Learn which use cases convert before scaling.", effort: "small" },
        ],
      };
      return out;
    }
    case "growth_strategy": {
      const out: StrategyOutput = {
        summary: `Focus the next 90 days on three things: be found for specific form use cases, show the product working in short demos, and help new sign-ups publish their first form fast. Test search ads with a small budget before spending more.`,
        positioning: `The quickest way to go from "I need a form" to a working, branded form with logic and payments.`,
        audiences: [
          { name: "Solo founders", hypothesis: "Will sign up from use-case searches like 'lead capture form with payments'.", evidence: "Product supports payments and logic (confirmed facts)." },
          { name: "Small marketing teams", hypothesis: "Respond to short demos showing speed.", evidence: "AI form creation is the core product (confirmed)." },
        ],
        channels: [
          { key: "seo_content", name: "Use-case pages (SEO)", why: "High-intent searches; compounding traffic.", priority: 1, deliverables: ["6 use-case pages", "Internal links"], dependencies: ["Confirm top use cases"], measurement: "Organic sign-ups from these pages (Search Console + analytics)", suggestedMonthlyAdSpend: 0 },
          { key: "social_organic", name: "Short demos on Instagram & Facebook", why: "Speed is easy to show visually.", priority: 2, deliverables: ["12 posts a month", "Alt text for every image"], dependencies: ["Connect Instagram professional account"], measurement: "Profile visits and tracked link clicks", suggestedMonthlyAdSpend: 0 },
          { key: "email_lifecycle", name: "First-form activation emails", why: "Sign-ups who publish early tend to stay.", priority: 3, deliverables: ["3-email welcome sequence"], dependencies: ["Connect your email provider", "Confirm consent for product emails"], measurement: "% of new accounts publishing a form within 7 days", suggestedMonthlyAdSpend: 0 },
          { key: "search_ads", name: "Small Google search-ad test", why: "Learn which use cases convert before investing more.", priority: 4, deliverables: ["2 ad groups", "Paused campaign for your approval"], dependencies: ["Google Ads connection", "Conversion tracking verified"], measurement: "Cost per paid conversion vs. organic baseline", suggestedMonthlyAdSpend: 600 },
        ],
        experiments: [
          { name: "Welcome sequence vs. no sequence", hypothesis: "A 3-email sequence raises 7-day first-form publishing.", population: "New sign-ups who agreed to product emails", method: "holdout", primaryMetric: "First form published within 7 days", guardrails: ["Unsubscribe rate below 1%"], durationDays: 28, stoppingRule: "Stop after 28 days or 400 sign-ups, whichever comes first" },
          { name: "Use-case ad groups", hypothesis: "Payment-form searches convert better than general form searches.", population: "Search ad clicks", method: "ab_split", primaryMetric: "Paid conversions per $100 spend", guardrails: ["Stay within the approved $600/month"], durationDays: 30, stoppingRule: "Pause any ad group that spends $150 with zero sign-ups" },
        ],
        constraints: ["Ad spend stays within $600/month, paid directly to Google", "Content reviewed on Fridays", "No claims beyond confirmed facts"],
        measurementPlan: "Billing revenue is the source of truth. Sign-ups and first-form publishing come from your analytics. Ad platform conversions are shown separately and never added together.",
        firstActions: [
          { title: "Confirm your top 3 use cases", why: "Everything else builds on them.", role: "ceo" },
          { title: "Review this week's posts", why: "First posts set the tone.", role: "social_media_manager" },
          { title: "Connect Google Search Console", why: "Measure search traffic before and after.", role: "seo_specialist" },
        ],
      };
      return out;
    }
    case "social_posts": {
      const qty = Math.min(ctx.quantity ?? 3, 6);
      const channels = ["instagram", "facebook", "linkedin", "x"] as const;
      const hooks = [
        "Describe it. Get a form.",
        "Collect payments without code.",
        "Forms that ask the right next question.",
        "From idea to live form before your coffee cools.",
        "Let AI draft replies to every response.",
        "See what your responses are really saying.",
      ];
      const out: SocialPostsOutput = {
        posts: Array.from({ length: qty }, (_, i) => {
          const channel = (ctx.channel && (channels as readonly string[]).includes(ctx.channel) ? ctx.channel : channels[i % channels.length]) as SocialPostsOutput["posts"][number]["channel"];
          const hook = hooks[(seed + i) % hooks.length];
          const fact = ctx.facts[i % Math.max(ctx.facts.length, 1)];
          return {
            channel,
            title: hook,
            body:
              channel === "x"
                ? `${hook} ${n} turns a sentence into a working form.`
                : `${hook}\n\n${fact ? fact.statement : `${n} makes building forms simple.`}\n\nTry it with the form you've been putting off.`,
            hashtags: channel === "linkedin" ? ["#smallbusiness", "#productivity"] : ["#forms", "#nocode", "#smallbusiness"],
            altText: `Illustration of a simple online form being created on a laptop, in ${n}'s brand colors.`,
            imageIdea: `Clean illustration: a sentence turning into a finished form, soft green palette, no real people or logos.`,
            factIndexes: ctx.facts.length ? [i % ctx.facts.length] : [],
            suggestedDay: (i * 2) % 7,
          };
        }),
      };
      return out;
    }
    case "ad_drafts": {
      const out: AdDraftsOutput = {
        searchAds: [
          {
            headlines: ["AI Form Builder", "Forms With Payments", "Build a Form in Minutes"],
            descriptions: ["Describe your form and get a working version with logic and payments.", "Collect leads and payments. No code needed."],
            keywords: ["ai form builder", "form with payments", "conditional logic form"],
            finalUrl: ctx.website ?? "",
          },
        ],
        metaAds: [
          { primaryText: `Need a form? Describe it and ${n} builds it — logic and payments included.`, headline: "Describe it. Get a form.", description: "Try it free", imageIdea: "A sentence morphing into a finished form", audience: "Small business owners interested in online tools" },
        ],
        budgetNote: "Start paused. Suggested test: $20/day within your $600 monthly envelope, reviewed weekly.",
        factIndexes: ctx.facts.length ? [0] : [],
      };
      return out;
    }
    case "email_sequence": {
      const out: EmailSequenceOutput = {
        name: "First form in 7 days",
        audience: "New sign-ups who agreed to product emails",
        emails: [
          { subject: "Your first form, in one sentence", previewText: "Describe it and we'll build it", body: `Hi {{first_name}},\n\nWelcome to ${n}. The fastest way to start: describe the form you need in one sentence and let ${n} build it.\n\n— The ${n} team`, sendAfterDays: 0, callToAction: "Create my first form" },
          { subject: "Add logic so your form asks the right questions", previewText: "Show questions only when they matter", body: "Conditional logic shows each person only the questions that apply to them. It takes about a minute to add.", sendAfterDays: 2, callToAction: "Add logic" },
          { subject: "Ready to collect payments?", previewText: "Turn a form into a checkout", body: "If your form sells something, you can collect payment right inside it.", sendAfterDays: 5, callToAction: "Set up payments" },
        ],
        factIndexes: ctx.facts.length ? [0, Math.min(1, ctx.facts.length - 1)] : [],
      };
      return out;
    }
    case "seo_brief": {
      const topic = pick(["lead capture form with payments", "event registration form", "client intake form"], seed);
      const out: SeoBriefOutput = {
        title: `How to build a ${topic} (in minutes)`,
        metaDescription: `Build a ${topic} with conditional logic and payments — no code. A practical step-by-step guide.`,
        primaryKeyword: topic,
        secondaryKeywords: ["form builder", "conditional logic", "online form"],
        searchIntent: "Someone who needs this specific form and wants to set it up today.",
        outline: [
          { heading: `What a good ${topic} includes`, points: ["Only essential questions", "Clear next step"] },
          { heading: "Build it step by step", points: ["Describe the form", "Add logic", "Connect payments if needed"] },
          { heading: "Common mistakes", points: ["Too many fields", "No confirmation message"] },
        ],
        internalLinks: ["/templates", "/pricing"],
        draft: `A ${topic} should be short, clear and lead to an obvious next step...\n\n(Draft continues — review before publishing.)`,
        factIndexes: ctx.facts.length ? [0] : [],
      };
      return out;
    }
    case "chat_intent": {
      const text = (ctx.request ?? "").toLowerCase();
      const actions: ChatIntentOutput["actions"] = [];
      if (/post|instagram|social|linkedin|facebook/.test(text)) {
        actions.push({ kind: "generate_content", title: "Draft social posts", description: "Create posts for your connected channels using confirmed facts.", channel: /linkedin/.test(text) ? "linkedin" : "instagram", quantity: 3 });
      }
      if (/email|newsletter|welcome/.test(text)) {
        actions.push({ kind: "generate_content", title: "Draft an email sequence", description: "A short sequence for people who agreed to hear from you.", channel: "email", quantity: 1 });
      }
      if (/ad|google|meta|budget/.test(text)) {
        actions.push({ kind: "generate_content", title: "Draft ads (paused until you approve)", description: "Search and social ad drafts within your approved budget.", channel: "google_search_ad", quantity: 1 });
      }
      if (/seo|blog|search|page/.test(text)) {
        actions.push({ kind: "generate_content", title: "Write an SEO page", description: "A use-case page aimed at real searches.", channel: "blog", quantity: 1 });
      }
      if (/plan|strategy|priorit/.test(text)) {
        actions.push({ kind: "refresh_plan", title: "Refresh the growth plan", description: "Update priorities using the latest facts and results.", channel: "", quantity: 1 });
      }
      if (/result|working|perform|number|forecast/.test(text)) {
        actions.push({ kind: "analyze_results", title: "Explain recent results", description: "Plain-English summary of what changed and why it might have.", channel: "", quantity: 1 });
      }
      if (actions.length === 0) {
        actions.push({ kind: "generate_content", title: "Draft 3 social posts", description: "A quick start based on your plan.", channel: "instagram", quantity: 3 });
      }
      return { reply: `Here's what I'd do. Nothing runs until you say go — each card shows what it will create and roughly what it costs.`, actions: actions.slice(0, 3) };
    }
    case "metric_explanation":
      return {
        headline: "Sign-ups are steady; paid conversions are too few to call a trend yet.",
        bullets: ["Visits follow a weekly pattern (weekdays higher).", "Last-touch view credits most revenue to organic search.", "A share of revenue has no tracked source and is shown as unattributed."],
        caveats: ["Demo data is synthetic.", "Attribution shows association, not cause."],
        nextStep: "Connect Search Console to see which pages bring sign-ups.",
      };
    case "conversion_audit":
      return {
        findings: [
          { area: "Homepage", observation: "The main benefit is clear, but there's no example of a finished form above the fold.", recommendation: "Show a real example form next to the headline.", impact: "high", sourceUrl: ctx.website ?? "" },
          { area: "Pricing", observation: "Plan differences need a quick comparison.", recommendation: "Add a 3-row comparison of what each plan unlocks.", impact: "medium", sourceUrl: ctx.website ?? "" },
        ],
        quickWins: ["Add one example form to the homepage", "Make the sign-up button text specific: 'Build my first form'"],
      };
    case "retention_plan":
      return {
        segments: [
          { name: "Signed up, no form yet", definition: "Account created, nothing published in 3 days", goal: "First form published" },
          { name: "Active free users", definition: "2+ forms, no paid plan", goal: "Upgrade when payments or AI replies are needed" },
        ],
        plays: [
          { name: "Nudge to first form", trigger: "Day 3 with no form", message: "Describe the form you need — we'll build it.", channel: "email" },
          { name: "Payments moment", trigger: "Form gets 20+ responses", message: "Ready to collect payments with this form?", channel: "in-app" },
        ],
      };
    case "sales_sequence":
      return {
        idealCustomer: "Small teams that collect leads or payments through forms every week",
        qualificationQuestions: ["How many forms do you run each month?", "Do you take payments through them?"],
        steps: [
          { day: 0, channel: "email", message: "Thanks for your interest — here's a 2-minute example built for your use case." },
          { day: 3, channel: "email", message: "Would a quick walkthrough of payments and logic help?" },
        ],
        note: "Uses only leads you already have or that came to you. ClimbOS has no contact database.",
      };
  }
}
