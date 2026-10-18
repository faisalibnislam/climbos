# Customer Acquisition Channel Framework (owner brief, 18 Oct 2026)

> Source: the owner's framework, saved as given. It is the foundation for ClimbOS's
> Acquisition Intelligence layer (business classification → channel discovery →
> scoring → strategy → execution → measurement). Implementation notes live in
> `docs/AcquisitionEngine.md`.

Every business needs customers, but **different types of businesses require different acquisition strategies, platforms, channels, and tactics.**

A B2B SaaS company might acquire customers through SEO, LinkedIn, outbound sales, and integrations. A restaurant might rely on Google Maps, delivery apps, Instagram, and local partnerships. An enterprise software company might depend on account-based marketing, industry events, and direct sales.

Below is a comprehensive framework covering **30 business categories, 20 acquisition channel families, and hundreds of specific acquisition methods**.

---

# Part 1. Business Classification

Before selecting acquisition channels, businesses should be classified by their operating model, target customers, transaction structure, and buying behavior.

## 1. Software & Technology Businesses

| # | Business Type | Examples | Primary Customers |
|---|---|---|---|
| 1 | B2B SaaS | CRM, HR software, Formkit | Businesses |
| 2 | B2C SaaS | Personal productivity, fitness apps | Consumers |
| 3 | Enterprise Software | ERP, cybersecurity, enterprise AI | Large organizations |
| 4 | Developer Tools | APIs, SDKs, infrastructure | Developers, engineering teams |
| 5 | Mobile Applications | Productivity, utility, lifestyle apps | Consumers and businesses |
| 6 | Desktop Applications | macOS apps, Windows software | Consumers and professionals |
| 7 | AI Products | AI assistants, automation, AI agents | Consumers and businesses |
| 8 | Marketplaces | Fiverr, Airbnb, Etsy | Buyers and sellers |
| 9 | Gaming | Mobile games, PC games, gaming platforms | Gamers |
| 10 | Digital Products | Templates, plugins, themes, assets | Individuals and businesses |

## 2. Commerce & Retail Businesses

| # | Business Type | Examples | Primary Customers |
|---|---|---|---|
| 11 | DTC E-commerce | Independent online brands | Consumers |
| 12 | Marketplace Sellers | Amazon, Etsy, eBay sellers | Consumers and businesses |
| 13 | Physical Retail | Clothing stores, electronics shops | Local consumers |
| 14 | Wholesale & Distribution | Product wholesalers, distributors | Retailers and businesses |
| 15 | Manufacturing | Factories, OEM/ODM suppliers | Businesses |
| 16 | Subscription Commerce | Subscription boxes, replenishment products | Consumers |
| 17 | Luxury & Premium Brands | Jewelry, watches, premium fashion | High-income consumers |
| 18 | Food & Beverage Brands | Packaged foods, beverages | Consumers and retailers |

## 3. Professional & Service Businesses

| # | Business Type | Examples | Primary Customers |
|---|---|---|---|
| 19 | Creative & Digital Agencies | Web design, branding, development | Businesses |
| 20 | Consulting | Management, technology, business consulting | Businesses and individuals |
| 21 | Professional Services | Legal, accounting, financial advisory | Businesses and individuals |
| 22 | Local Services | Plumbing, cleaning, electrical, repairs | Local consumers |
| 23 | Healthcare Services | Clinics, dentists, therapists | Patients |
| 24 | Education & Training | Schools, courses, coaching | Students and professionals |
| 25 | Real Estate | Agents, developers, property management | Buyers, renters, investors |
| 26 | Hospitality & Travel | Hotels, restaurants, travel agencies | Travelers and consumers |
| 27 | Events & Entertainment | Conferences, concerts, event planners | Consumers and organizations |
| 28 | Financial Services | Fintech, insurance, lending | Consumers and businesses |
| 29 | Media & Creator Businesses | Newsletters, podcasts, creators | Audiences and advertisers |
| 30 | Nonprofits & Membership Organizations | Charities, associations, communities | Donors, members, supporters |

These categories overlap. For example, an AI-powered healthcare SaaS can belong to B2B SaaS, AI Products, and Healthcare.

---

# Part 2. The 20 Universal Acquisition Channel Families

| # | Channel Family | Examples |
|---|---|---|
| 1 | Organic Search | SEO, local SEO, programmatic SEO |
| 2 | Paid Search | Google Ads, Bing Ads, shopping ads |
| 3 | Organic Social Media | LinkedIn, Instagram, TikTok, Facebook |
| 4 | Paid Social Media | Meta Ads, LinkedIn Ads, TikTok Ads |
| 5 | Content Marketing | Blogs, guides, reports, tutorials |
| 6 | Video & Audio | YouTube, podcasts, webinars, livestreams |
| 7 | Email Marketing | Newsletters, lifecycle emails, outbound email |
| 8 | Direct Outreach & Sales | Cold email, cold calls, LinkedIn outreach |
| 9 | Communities | Reddit, Discord, Slack, Facebook Groups |
| 10 | Partnerships | Affiliates, resellers, co-marketing |
| 11 | Referral & Word of Mouth | Customer referrals, ambassador programs |
| 12 | Marketplaces & Directories | App stores, G2, Amazon, Google Maps |
| 13 | PR & Earned Media | Press, interviews, reviews, media coverage |
| 14 | Influencer & Creator Marketing | Sponsorships, affiliate creators, UGC |
| 15 | Events & Field Marketing | Conferences, trade shows, meetups |
| 16 | Product-Led Acquisition | Freemium, free tools, viral sharing |
| 17 | Traditional Advertising | TV, radio, print, billboards, direct mail |
| 18 | Local & Location-Based Marketing | Maps, signage, local sponsorships |
| 19 | Distribution & Channel Sales | Retailers, distributors, OEM partnerships |
| 20 | Retargeting & Re-engagement | Remarketing, abandoned-cart recovery, win-back |

**Important distinction:** some of these are distribution channels, others are strategies or mechanisms (e.g. retargeting runs through Google Ads, Meta Ads and others). Store both separately.

---

# Part 3. Acquisition Channels by Business Type

The per-type channel lists (all 30 types, each with organic, paid, direct, partnership, directory and product-led options and "highest-priority starting channels") are encoded in `shared/acquisition/library.ts` (`BUSINESS_TYPES[*].channels` and `.starters`). Highlights:

| Type | Highest-priority starting channels |
|---|---|
| B2B SaaS | Intent-based SEO, Google Search Ads, integrations, LinkedIn, product-led acquisition, targeted outbound |
| B2C SaaS | Search, social content, creator partnerships, app store discovery, referrals |
| Enterprise Software | ABM, enterprise sales, strategic partnerships, events, thought leadership |
| Developer Tools | Documentation SEO, GitHub, developer communities, open source, free tiers |
| Mobile Apps | ASO, search ads, short-form video, reviews, referrals |
| Desktop Apps | SEO, app directories, technology reviewers, Reddit, cross-promotion |
| AI Products | Demo content, SEO, AI directories, integrations, product-led sharing |
| Marketplaces | Supply acquisition, high-intent search, referrals, shareable listings |
| Gaming | Store discovery, creator coverage, community, playable demos |
| Digital Products | Marketplaces, SEO, free samples, creator content, design communities |
| DTC E-commerce | Google Shopping, Meta Ads, creator content, SEO, referrals |
| Marketplace Sellers | Marketplace search, sponsored listings, reviews, listing conversion |
| Physical Retail | Google Maps, local SEO, social ads, storefront, local referrals |
| Wholesale | Direct sales, wholesale marketplaces, trade shows, distributors |
| Manufacturing | Industrial search, procurement networks, trade shows, direct sales |
| Subscription Commerce | Creator content, paid social, referrals, gifting partnerships |
| Luxury | Brand PR, premium creators, selective partnerships, private referrals |
| Food & Beverage | Sampling, retail distribution, food creators, social content |
| Agencies | Referrals, case studies, LinkedIn outbound, partnerships, portfolio SEO |
| Consulting | Referrals, executive relationships, thought leadership, targeted outreach |
| Professional Services | Search, professional referrals, reputation, local visibility (regulated) |
| Local Services | Google Maps, high-intent search, reviews, referrals |
| Healthcare | Local search, appointment directories, professional referrals, reputation (regulated) |
| Education | Educational content, search, webinars, referrals, partnerships |
| Real Estate | Property portals, referrals, local search, visual social |
| Hospitality & Travel | Search, booking platforms, reviews, social proof, travel partnerships |
| Events | Social ads, community partnerships, event directories, email audiences |
| Financial Services | High-intent search, comparison platforms, trusted referrals, distribution partnerships (regulated) |
| Media & Creators | Platform-native discovery, collaborations, search, referrals |
| Nonprofits | Community partnerships, referrals, email, events, mission content |

# Part 4. Specialized industries

Construction, architecture, logistics, agriculture, automotive (sales and repair), beauty & wellness, fitness, recruitment, staffing, telecom, energy & solar, cybersecurity, government contractors, franchises, import/export, pharmaceuticals, publishing, home improvement, B2B merchandising: each with specialized channels (bid portals, freight marketplaces, cooperatives, dealer networks, booking platforms, job boards, procurement portals, franchise directories, trade fairs, BookTok, etc.). Encoded as `SPECIALIZED_INDUSTRIES` in the library.

# Part 5. Taxonomy

**Channel Family → Channel → Platform → Tactic → Audience → Campaign**, e.g. `Organic Search → SEO → Google → Comparison Page → CRM Buyers → Best CRM Alternatives`.

Master channel library with stable IDs: Search & Discovery (S01–S20), Paid Advertising (P01–P25), Organic Social (O01–O20), Content (C01–C25), Direct Sales & Outreach (D01–D20), Partnerships & Distribution (R01–R20), Marketplaces & Directories (M01–M25), Community (N01–N15), Events & Offline (E01–E20), Product-Led & Viral (V01–V20). Encoded as `CHANNELS` in the library.

# Part 6. By business model

| Business Model | Commonly Suitable Channels |
|---|---|
| B2B Low-Ticket | SEO, self-service signup, content, integrations |
| B2B Mid-Market | SEO, webinars, LinkedIn, outbound, partnerships |
| B2B Enterprise | ABM, direct sales, conferences, executive networking |
| B2C Low-Ticket | Organic social, influencers, SEO, referrals |
| B2C High-Ticket | Search, consultations, referrals, trust-building content |
| Local B2C | Google Maps, local SEO, reviews, local advertising |
| Local B2B | Networking, direct outreach, referrals, local search |
| Global Digital Products | SEO, marketplaces, affiliates, content |
| E-commerce | Shopping ads, creators, marketplaces, SEO |
| Subscription Businesses | Search, referrals, product-led growth, partnerships |
| Transaction-Based Marketplaces | Supply acquisition, demand acquisition, referrals |
| High-Consideration Services | Case studies, referrals, webinars, consultations |
| Regulated Industries | Compliant search, approved partners, professional referrals |
| Government Sales | Procurement portals, tenders, channel partnerships |
| Franchise Businesses | Local marketing plus centralized brand campaigns |

Starting hypotheses, not universal rankings.

# Part 7. By budget

| Monthly Marketing Budget | Suggested Approach |
|---|---|
| $0–$100 | Organic content, SEO foundations, referrals, communities |
| $100–$500 | One organic channel plus small paid experiments |
| $500–$1,000 | One primary acquisition channel plus supporting experiments |
| $1,000–$5,000 | Two or three focused channels with conversion tracking |
| $5,000–$20,000 | Diversified acquisition with systematic testing |
| $20,000–$100,000 | Multi-channel growth, creative testing, dedicated measurement |
| $100,000+ | Integrated acquisition portfolio with advanced attribution |

A $600/month business is better off testing one high-intent channel than spreading $100 across six platforms. Long sales cycles favour direct sales and partnerships.

# Part 8. By customer intent

| Customer Stage | Suitable Channels | Objective |
|---|---|---|
| Unaware | Social content, PR, influencers, video | Introduce the problem |
| Problem Aware | Educational SEO, communities, podcasts | Build understanding |
| Solution Aware | Guides, webinars, comparison content | Introduce solutions |
| Product Aware | Product reviews, case studies, demos | Build preference |
| High Purchase Intent | Search ads, product listings, sales outreach | Convert demand |
| Returning Visitor | Retargeting, email nurturing | Re-engage prospects |
| Existing Customer | Referrals, invitations, advocacy | Acquire additional customers |

# Part 9. Speed and cost

| Channel | Time to Learn | Upfront Cash | Organic Scalability |
|---|---|---|---|
| Google Search Ads | Days–weeks | Medium–High | Low |
| Meta Ads | Days–weeks | Medium | Low |
| LinkedIn Ads | Weeks | High | Low |
| Organic SEO | Months | Low–Medium | High |
| Programmatic SEO | Months | Medium | High |
| Organic Social | Weeks–months | Low | Medium–High |
| Cold Email | Days–weeks | Low–Medium | Medium |
| LinkedIn Outreach | Days–weeks | Low | Medium |
| Affiliate Marketing | Weeks–months | Low–Medium | High |
| Influencer Marketing | Days–weeks | Medium | Medium |
| Referral Programs | Weeks–months | Low–Medium | High |
| Product-Led Growth | Months | Medium–High | High |
| Community Marketing | Months | Low | Medium |
| Marketplaces | Days–months | Variable | Medium–High |
| Partnerships | Weeks–months | Low–Medium | High |
| PR | Variable | Low–High | Medium |
| Events | Weeks–months | Medium–High | Medium |
| Direct Sales | Days–months | Medium | Medium |

Time to learn ≠ time to a paying customer.

# Part 10. How ClimbOS uses it

1. **Business discovery:** classify from the website; ask only for missing essentials; separate verified facts from assumptions.
2. **Channel discovery:** candidates from the library for the business's types.
3. **Channel scoring (0–100):** hard eligibility checks first, then weighted factors: audience match 20%, purchase intent 20%, budget compatibility 15%, time to results 10%, execution feasibility 10%, competitive opportunity 10%, scalability 10%, measurement confidence 5%. Default weights; tune from observed performance.
4. **Strategy per selected channel:** objective, audience, problem, strategy, campaign concept, content and landing needs, distribution, budget, estimated CAC with assumptions, measurement, timeline, risks.
5. **Execution groups:** fully automatable (drafts, reports, approved scheduling) · partially automatable (ads, email, SEO changes: prepare, validate, approve, execute) · human-dependent (events, calls: recommend, prepare, track). Always respect permissions, platform policies and approval settings.
6. **Measurement:** reach, visits, qualified visits, leads, signups, activation, trial-to-paid, lead-to-customer, CAC, revenue, LTV, LTV:CAC, payback, ROAS, retention, channel contribution. Report attribution uncertainty, never invent contributions.
7. **Continuous optimization:** what works, what wastes budget, what has enough data, where to invest, what to pause, new opportunities, decaying channels, next test. Observed performance is kept separate from projections.

# Part 11. Data model

Entities: business categories, types, models, industries, customer segments, channel families, channels, platforms, tactics, channel eligibility, business-channel fit, cost models, sourced dated benchmarks, campaigns, experiments, attribution events, channel performance, optimization recommendations. A business can have many types, industries, audiences, markets, channels, campaigns, platforms and tactics.

# Part 12. Business dimensions

Customer type (B2B/B2C/B2G/B2B2C), scale, sales motion (self-service/sales-assisted/sales-led), revenue model, average order value, sales cycle, geography, market maturity, product complexity, purchase frequency, competition, brand awareness, existing audience, regulatory constraints, budget, internal resources, technology readiness, customer lifetime value.

# The five layers

| Layer | System | Responsibility |
|---|---|---|
| 1 | Business Intelligence | Understand what the business sells and to whom |
| 2 | Acquisition Intelligence | Discover and rank suitable acquisition channels |
| 3 | Growth Strategy | Build channel-specific campaigns and budgets |
| 4 | Autonomous Execution | Create and execute approved marketing activities |
| 5 | Revenue Intelligence | Measure acquisition performance and optimize spending |

**Central principle:** ClimbOS doesn't ask which channels a business wants. It identifies which channels are most likely to help *that* business acquire profitable customers, and why, when and how much to invest.
