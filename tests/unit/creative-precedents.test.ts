import { describe, expect, it } from "vitest";
import { CREATIVE_PRECEDENTS, creativePrecedentsForAgent, formatCreativePrecedents, retrieveCreativePrecedents } from "../../shared/knowledge/creativePrecedents";

describe("creative strategy precedent retrieval", () => {
  it("keeps the verified corpus honest and each case source-backed", () => {
    expect(CREATIVE_PRECEDENTS).toHaveLength(62);
    for (const precedent of CREATIVE_PRECEDENTS) {
      expect(precedent.sources.length).toBeGreaterThan(0);
      expect(precedent.sources.every((source) => /^https:\/\//.test(source.url) && source.supports.length > 10 && source.accessedAt && source.sourceRole && source.claimRole)).toBe(true);
      expect(precedent.causalLimit.length).toBeGreaterThan(30);
      expect(precedent.reversibleTest.length).toBeGreaterThan(20);
    }
    const whopperDetour = CREATIVE_PRECEDENTS.find((precedent) => precedent.id === "CP-014");
    expect(whopperDetour?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.oneclub.org/awards/theoneshow/-award/33593/the-whopper-detour/", sourceRole: "creator_primary" }),
      expect.objectContaining({ url: "https://www.restaurantdive.com/news/burger-kings-whopper-detour-generated-15m-app-downloads/548249/", sourceRole: "independent_secondary" }),
    ]));
  });

  it("retrieves a character-design mechanism across industries instead of matching industry names", () => {
    const matches = retrieveCreativePrecedents("small business distinctive mascot identity customer recall visual constraints");
    expect(matches[0]?.precedent.id).toBe("CP-004");
    expect(formatCreativePrecedents("small business distinctive mascot identity customer recall visual constraints")).toContain("Nintendo");
  });

  it("retrieves a product-prototyping mechanism from mechanism language", () => {
    expect(retrieveCreativePrecedents("borrow a pattern from another industry and prototype it with athletes").some(({ precedent }) => precedent.id === "CP-003")).toBe(true);
  });

  it("retrieves Aarong's market-linkage and payment-timing mechanism", () => {
    const matches = retrieveCreativePrecedents("Connect rural craft producers with urban buyers through a branded retail route, clearer product quality, and faster supplier payment");
    expect(matches.some(({ precedent }) => precedent.id === "CP-045")).toBe(true);
    expect(formatCreativePrecedents("Connect rural craft producers with urban buyers through a branded retail route and faster supplier payment")).toContain("Aarong / BRAC");
  });

  it("retrieves recurring fan support as an alternative to advertising-led creator income", () => {
    const query = "Fund ongoing creative work through recurring payments from a small group of committed fans instead of relying only on ad-supported views";
    expect(retrieveCreativePrecedents(query).some(({ precedent }) => precedent.id === "CP-046")).toBe(true);
    expect(creativePrecedentsForAgent("growth_plays", "Build a creator growth plan", query)).toContain("Patreon");
  });

  it("retrieves education-first local participation as a product-launch sequence", () => {
    const query = "Teach customers through practical workshops, online lessons, local community champions and creator-led events before revealing the new product";
    expect(retrieveCreativePrecedents(query).some(({ precedent }) => precedent.id === "CP-047")).toBe(true);
    expect(creativePrecedentsForAgent("growth_plays", "Build a launch strategy", query)).toContain("CP-047");
    expect(formatCreativePrecedents(query)).toContain("Attendance and training completions do not establish qualified demand or revenue");
  });

  it("retrieves owned content as customer research while retaining conversion limits", () => {
    const query = "A beauty publication community can learn unmet reader needs and shape cleanser product development through reader conversations";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-048");
    expect(match).toBeDefined();
    expect(match?.precedent.distinctiveness).toContain("did not automatically become shoppers");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.glossier.com/en-cg/pages/about", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://digiday.com/marketing/glossier-uses-data-make-content-commerce-work/", publicationDate: "2017-06-13" }),
      expect.objectContaining({ url: "https://hbr.org/podcast/2020/08/glossier-built-a-cult-brand-and-a-digital-community-but-whats-next" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Build a product plan", query)).toContain("CP-048");
  });

  it("retrieves a constraint-to-format creative mechanism without promising reach", () => {
    const query = "Convert a quiet singer who is inaudible in a noisy venue into an intimate workplace desk performance, then repeat the office series for the audience";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-049");
    expect(match).toBeDefined();
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.cpr.org/2018/04/23/tiny-desk-concerts-at-10-how-one-miserable-show-led-to-a-magical-concert-series/", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://apnews.com/article/tiny-desk-concert-npr-64c4e1c29d81eb0be389aebc2591d92e", sourceRole: "independent_secondary" }),
    ]));
    expect(match?.precedent.causalLimit).toContain("remained niche");
    expect(creativePrecedentsForAgent("growth_plays", "Explore an original content strategy", query)).toContain("CP-049");
  });

  it("retrieves practitioner-community learning without treating invitations as causal growth evidence", () => {
    const query = "Build a practitioner community for product feedback, peer discovery, expert content and product adoption";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-050");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("87% of first-time users had been invited by a colleague");
    expect(match?.precedent.causalLimit).toContain("not proof that a community program caused activation");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.figma.com/blog/introducing-figma-community/", publicationDate: "2019-10-22", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://review.firstround.com/the-5-phases-of-figmas-community-led-growth-from-stealth-to-enterprise/", publicationDate: "2022-08-31", sourceRole: "independent_secondary" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore community-led distribution", query)).toContain("CP-050");
  });

  it("retrieves transparent operating rules without treating recruiting reports as customer growth", () => {
    const query = "Make a pay formula or service pricing rule publicly transparent to build trust and attract qualified applicants";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-051");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("applications rose 50% the next month");
    expect(match?.precedent.causalLimit).toContain("do not show that customers bought");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://buffer.com/resources/introducing-open-salaries-at-buffer-including-our-transparent-formula-and-all-individual-salaries/", publicationDate: "2013-12-19", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://www.fastcompany.com/40416506/is-pay-transparency-right-for-your-company-we-asked-a-few-that-tried-it", publicationDate: "2017-05-05", sourceRole: "independent_secondary" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore distinctive trust mechanisms", query)).toContain("CP-051");
  });

  it("retrieves a brand-quirk creative portfolio without treating reported reach as customer growth", () => {
    const query = "Create fictional product concepts, interconnected microsites, and campaign content around the company's mispronounced name";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-052");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("company-reported reach comparison");
    expect(match?.precedent.causalLimit).toContain("does not show that a portfolio of fictional projects caused customer acquisition");
    expect(match?.precedent.transferRisk).toContain("Do not rely on a search engine correction");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.oneclub.org/awards/theoneshow/-award/26134/did-you-mean-mailchimpa/", publicationDate: "2017", sourceRole: "creator_primary" }),
      expect.objectContaining({ url: "https://www.entrepreneur.com/starting-a-business/why-mailchimps-insane-fake-ad-campaign-paid-off/294550", publicationDate: "2017-06-05", sourceRole: "independent_secondary" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore a surprising brand-discovery strategy", query)).toContain("CP-052");
  });

  it("retrieves packaging as an owned explanation channel without attributing sales growth to design", () => {
    const query = "Use product packaging and package copy as a brand medium to explain what is inside at the retail shelf and help shoppers choose";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-053");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("does not create demand");
    expect(match?.precedent.outcome).toContain("No controlled evidence isolates packaging's contribution");
    expect(match?.precedent.transferRisk).toContain("regulatory or accessibility problems");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.forsman.com/work/oatly/", sourceRole: "creator_primary" }),
      expect.objectContaining({ url: "https://fortune.com/2018/04/16/how-to-create-a-great-brand-for-your-small-business/", sourceRole: "independent_secondary", publicationDate: "2018-04-16" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore original product communication", query)).toContain("CP-053");
  });

  it("retrieves a negative positioning case without reducing it to a universal pricing rule", () => {
    const query = "Check whether calling our product the cheapest will attract our target buyers or conflict with their category aspirations and comparison set";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-054");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("low headline price can attract attention");
    expect(match?.precedent.causalLimit).toContain("intertwined constraints");
    expect(match?.precedent.transferRisk).toContain("varies by customer and culture");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.tatamotors.com/press-releases/tata-motors-announces-the-launch-of-tata-nano/", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://journals.sagepub.com/doi/full/10.1177/02560909211044253", sourceRole: "independent_secondary", publicationDate: "2021-09-26" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Review whether a lower price fits this segment", query)).toContain("CP-054");
  });

  it("retrieves a product-workaround test without treating one demo as proof of failure", () => {
    const query = "Compare our expensive connected product feature with the simplest manual workaround and learn whether buyers value the difference";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-055");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("one demonstration is a prompt for customer research");
    expect(match?.precedent.causalLimit).toContain("not a representative customer study");
    expect(match?.precedent.distinctiveness).toContain("food-service niche");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.accessnewswire.com/newsroom/en/consumer-and-retail-products/juicero-expands-highly-anticipated-no-mess-cold-pressed-juicing-experie-459986", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://arstechnica.com/information-technology/2017/04/this-400-appliance-that-squeezes-juice-out-of-a-bag-appears-unnecessary/", sourceRole: "independent_secondary", publicationDate: "2017-04-19" }),
      expect.objectContaining({ url: "https://www.axios.com/2017/12/15/juicero-is-shutting-down-draining-vcs-120-million-1513305243", sourceRole: "independent_secondary", publicationDate: "2017-09-01" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Test product value before expanding production", query)).toContain("CP-055");
  });

  it("retrieves a customer-insight creative platform while keeping outcomes and cultural limits clear", () => {
    const query = "Build a repeatable hunger-based creative platform from a customer situation, connect it to the product benefit, and adapt it across markets";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-056");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("repeatable creative rule");
    expect(match?.precedent.outcome).toContain("not forecasts");
    expect(match?.precedent.causalLimit).toContain("predict lift");
    expect(match?.precedent.transferRisk).toContain("local fit");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.prnewswire.com/news-releases/snickersr-kicks-off-new-advertising-campaign-at-super-bowl-xliv-82931857.html", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://www.warc.com/en/article/snickers%3A-you%26%2339%3Bre-not-you-when-you%26%2339%3Bre-hungry-global-case-study-ac4913912d984ad8b8658fa29c814d8f", sourceRole: "independent_secondary", publicationDate: "2012-06-16" }),
      expect.objectContaining({ url: "https://www.tandfonline.com/doi/full/10.1080/17459435.2019.1605403", claimRole: "context" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Develop an original product-linked creative platform", query)).toContain("CP-056");
  });

  it("retrieves a participatory campaign while separating visible participation from its intended outcome", () => {
    const query = "Cause-linked participant referral loop with nomination and a donation request";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-057");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("probability of donating");
    expect(match?.precedent.causalLimit).toContain("Participation, video uploads, donations, customers, and revenue are not interchangeable");
    expect(match?.precedent.transferRisk).toContain("public nomination as a coercive mechanic");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.als.org/blog/als-ice-bucket-challenge-year-end-update-over-94-million-commitments-2014", sourceRole: "organization_primary" }),
      expect.objectContaining({ url: "https://doi.org/10.1016/j.joep.2023.102624", sourceRole: "independent_secondary", publicationDate: "2023-06" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore an optional, accessible community participation idea", query)).toContain("CP-057");
  });

  it("retrieves prepared real-time social response while preserving human approval and outcome limits", () => {
    const query = "Respond to a live blackout with a prepared social team, a product-linked post within minutes, and human approval";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-058");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("not posting on every trend or automating reactions");
    expect(match?.precedent.outcome).toContain("not verified customer or revenue outcomes");
    expect(match?.precedent.transferRisk).toContain("Never automate posts, comments, DMs, or account activity");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.wired.com/2013/02/oreo-twitter-super-bowl/", publicationDate: "2013-02-04", sourceRole: "independent_secondary" }),
      expect.objectContaining({ url: "https://digiday.com/marketing/oral-history-oreo-tweet/", publicationDate: "2017-02-03" }),
      expect.objectContaining({ url: "https://www.socialmediatoday.com/news/was-oreos-dunk-in-the-dark-tweet-really-a-runaway-success/455422/", publicationDate: "2015-01-28" }),
    ]));
    const formatted = creativePrecedentsForAgent("growth_plays", "Explore a trend-aware social strategy", query);
    expect(formatted).toContain("CP-058");
    expect(formatted).toContain("every external post still needs the owner's approval");
    expect(formatted).toContain("Sales or customer acquisition effect is not established");
  });

  it("retrieves co-designed product adaptations while preserving accessibility and outcome limits", () => {
    const query = "Co-design downloadable 3D-printed add-ons with disability organizations to adapt mainstream furniture to customers' use needs";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-059");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("3D printing itself is optional");
    expect(match?.precedent.evidenceClass).toContain("12 versus 13");
    expect(match?.precedent.causalLimit).toContain("not controlled use testing, sales, retention, or cost effects");
    expect(match?.precedent.transferRisk).toContain("Do not imply that an add-on, downloadable file, or marketing campaign makes the full product or service accessible");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.washingtonpost.com/business/2019/03/15/ikea-is-making-furniture-better-people-with-disabilities-with-help-d-printers/?noredirect=on", publicationDate: "2019-03-15" }),
      expect.objectContaining({ url: "https://www.creativereview.co.uk/ikeas-thisables-campaign-focuses-on-making-its-furniture-more-accessible/", publicationDate: "2019-03-15" }),
      expect.objectContaining({ url: "https://beta.designmuseum.org/exhibitions/beazley-designs-of-the-year/product-2019/thisables", publicationDate: "2019-09-11" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Explore an accessibility-led product adaptation", query)).toContain("CP-059");
  });

  it("retrieves entertaining message design while separating attention from comprehension and behavior", () => {
    const query = "Darkly comic animated song turns ignored railway safety warnings into an entertaining character-led story; check whether the audience understood the intended safety message";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-060");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("may overpower the intended instruction");
    expect(match?.precedent.outcome).toContain("does not provide a controlled causal estimate");
    expect(match?.precedent.causalLimit).toContain("do not isolate campaign effect");
    expect(match?.precedent.transferRisk).toContain("Do not imitate the name, characters, song, visual identity, or dark humor");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.warc.com/en/article/metro-trains-melbourne:-dumb-ways-to-die-b6a698a8c91447eab68a2c191b96aa46", publicationDate: "2013-05-09" }),
      expect.objectContaining({ url: "https://eprints.whiterose.ac.uk/id/eprint/208869/", publicationDate: "2024-01-30" }),
      expect.objectContaining({ url: "https://opus.lib.uts.edu.au/bitstream/10453/162579/2/02whole.pdf", publicationDate: "2022" }),
    ]));
    const formatted = creativePrecedentsForAgent("growth_plays", "Explore an entertaining way to communicate a safety message", query);
    expect(formatted).toContain("CP-060");
    expect(formatted).toContain("Views, shares, chart position, pledges");
  });

  it("retrieves a revisable platform portfolio while preserving the owned-channel and commercial limits", () => {
    const query = "Review a channel portfolio, platform dependency risk, owned newsletter and app, and whether a changed alternative platform now fits the audience";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-061");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("conditional part of a channel portfolio");
    expect(match?.precedent.outcome).toContain("could not determine the sales impact");
    expect(match?.precedent.causalLimit).toContain("no controlled comparison isolates the effect of leaving");
    expect(match?.precedent.transferRisk).toContain("A well-known retailer with millions of direct subscribers can absorb a loss of platform reach");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://weare.lush.com/press-releases/lush-is-becoming-anti-social/", publicationDate: "2021-11-22", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://www.marketingbrew.com/stories/2025/02/24/lush-anti-social-media-strategy", publicationDate: "2025-02-24 (updated 2025-02-26)" }),
      expect.objectContaining({ url: "https://cosmeticsbusiness.com/lush-returns-to-social-media-following-2021-departure", publicationDate: "2026-06-26" }),
      expect.objectContaining({ url: "https://bsky.app/profile/lush.com", sourceRole: "organization_primary" }),
    ]));
    const formatted = creativePrecedentsForAgent("growth_plays", "Evaluate a channel portfolio for the business", query);
    expect(formatted).toContain("CP-061");
    expect(formatted).toContain("the owner-selected business measures do not materially worsen");
  });

  it("retrieves a distribution redesign that pairs compact packaging with customer assembly", () => {
    expect(retrieveCreativePrecedents("Test compact packaging and customer assembly for bulky furniture to reduce shipping damage")[0]?.precedent.id).toBe("CP-017");
  });

  it("retrieves collaboration-led bottom-up adoption through its product mechanism", () => {
    const matches = retrieveCreativePrecedents("Help individual users invite coworkers by sharing content and collaborating on a work platform, enabling bottom-up adoption within organizations", 2);
    expect(matches.some(({ precedent }) => precedent.id === "CP-018")).toBe(true);
  });

  it("retrieves audience expansion through accessible shared product design", () => {
    expect(retrieveCreativePrecedents("Use shared motion-controlled play to help non-gamers and families join a game together").some(({ precedent }) => precedent.id === "CP-019")).toBe(true);
  });

  it("retrieves a product-integrated partnership across adjacent brands", () => {
    expect(retrieveCreativePrecedents("Redesign a familiar restaurant product format through a co-branding partnership", 3).some(({ precedent }) => precedent.id === "CP-020")).toBe(true);
  });

  it("retrieves a capacity-led invitation rollout without endorsing artificial scarcity", () => {
    expect(retrieveCreativePrecedents("Run a capacity-limited beta with an invitation loop and transparent onboarding").some(({ precedent }) => precedent.id === "CP-021")).toBe(true);
  });

  it("retrieves creator-centered participation without promising viral reach", () => {
    expect(retrieveCreativePrecedents("Recognize an authentic customer-created social moment and ask permission to collaborate with the creator").some(({ precedent }) => precedent.id === "CP-022")).toBe(true);
  });

  it("retrieves personalization as a product participation mechanism", () => {
    expect(retrieveCreativePrecedents("Personalize product packaging so customers can share a meaningful gift with friends").some(({ precedent }) => precedent.id === "CP-023")).toBe(true);
  });

  it("retrieves accountable service recovery without generalizing brand humor", () => {
    expect(retrieveCreativePrecedents("Respond to a real service failure with an accountable apology, clear remedy, and recovery plan").some(({ precedent }) => precedent.id === "CP-024")).toBe(true);
  });

  it("retrieves service cross-subsidy through the operating mechanism, not healthcare category alone", () => {
    expect(retrieveCreativePrecedents("Design a high-volume eye care service that gives paying and subsidized patients equal quality while remaining financially sustainable").some(({ precedent }) => precedent.id === "CP-025")).toBe(true);
    expect(retrieveCreativePrecedents("Compare eye-care providers in South India")).not.toEqual(expect.arrayContaining([expect.objectContaining({ precedent: expect.objectContaining({ id: "CP-025" }) })]));
  });

  it("retrieves an existing-partner distribution network and its quality-control tradeoffs", () => {
    expect(retrieveCreativePrecedents("Use an existing distribution network of airtime agents with training, partner commissions, and service quality controls").some(({ precedent }) => precedent.id === "CP-026")).toBe(true);
  });

  it("retrieves accessibility-led product redesign from the user barrier", () => {
    expect(retrieveCreativePrecedents("Redesign a kitchen peeler for customers with arthritis and limited grip strength using user research and prototypes").some(({ precedent }) => precedent.id === "CP-027")).toBe(true);
  });

  it("retrieves a change in payer and payment timing without promising subscription economics", () => {
    expect(retrieveCreativePrecedents("Test a monthly fee-for-service option where landlords pay for maintained toilets instead of tenants paying per use").some(({ precedent }) => precedent.id === "CP-028")).toBe(true);
  });

  it("retrieves a managed equipment-service model through asset responsibility and predictable cost", () => {
    expect(retrieveCreativePrecedents("Offer a fixed monthly fee to manage customer equipment, repairs, replacements, and tracking instead of selling tools outright").some(({ precedent }) => precedent.id === "CP-029")).toBe(true);
  });

  it("retrieves usage-linked service pricing with provider-held maintenance risk", () => {
    expect(retrieveCreativePrecedents("Price a maintenance service per engine flying hour and share uptime risk with customers").some(({ precedent }) => precedent.id === "CP-030")).toBe(true);
  });

  it("retrieves product demonstration as an entertainment mechanism", () => {
    expect(retrieveCreativePrecedents("Show real product capabilities through low-cost funny demonstrations led by the founder").some(({ precedent }) => precedent.id === "CP-031")).toBe(true);
  });

  it("retrieves real-time audience responses through an established brand character", () => {
    expect(retrieveCreativePrecedents("Use an established brand character to answer customer questions with fast personalized video responses").some(({ precedent }) => precedent.id === "CP-032")).toBe(true);
  });

  it("retrieves a transparent finite inventory offer without endorsing fake scarcity", () => {
    expect(retrieveCreativePrecedents("Pre-sell a finite set of real advertising or sponsorship spaces using a simple unit and clear capacity").some(({ precedent }) => precedent.id === "CP-033")).toBe(true);
  });

  it("retrieves visual listing improvement while preserving the observational limits", () => {
    const match = retrieveCreativePrecedents("Improve truthful booking-listing photos and reduce up-front production cost for a small hospitality host").find(({ precedent }) => precedent.id === "CP-034");
    expect(match).toBeDefined();
    expect(match?.precedent.researchConfidence).toBe("low");
    expect(match?.precedent.outcome).toContain("not randomized causal effects");
    expect(match?.precedent.sources[0]?.url).toBe("https://www.airbnb.com/e/pro-photography");
  });

  it("retrieves product-linked referrals while keeping the reported growth claim qualified", () => {
    const match = retrieveCreativePrecedents("Build an opt-in two-sided referral loop into a useful product action and reduce signup friction").find(({ precedent }) => precedent.id === "CP-035");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("not independently audited data");
    expect(match?.precedent.causalLimit).toContain("does not isolate either effect");
    expect(match?.precedent.sources[0]?.url).toBe("https://sequoiacap.com/podcast/crucible-moments-dropbox");
  });

  it("retrieves offer simplification while preserving concurrent-change and margin caveats", () => {
    const match = retrieveCreativePrecedents("Remove confusing contract terms and upfront payment barriers by separating service pricing from device financing").find(({ precedent }) => precedent.id === "CP-036");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("do not isolate the effect");
    expect(match?.precedent.causalLimit).toContain("MetroPCS acquisition and network investment");
    expect(match?.precedent.sources.some((source) => source.url.includes("sec.gov/Archives/edgar/data/1283699"))).toBe(true);
  });

  it("retrieves shared permission infrastructure without implying that licensing guarantees growth", () => {
    const match = retrieveCreativePrecedents("Reduce permission friction by making creator reuse terms clear and discoverable across platforms").find(({ precedent }) => precedent.id === "CP-037");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("not an exact census");
    expect(match?.precedent.causalLimit).toContain("do not establish unique active creators");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://creativecommons.org/history/", claimRole: "action" }),
      expect.objectContaining({ url: "https://creativecommons.org/state-of-the-commons-2022/", claimRole: "outcome" }),
      expect.objectContaining({ url: expect.stringContaining("unesdoc.unesco.org"), sourceRole: "independent_secondary" }),
    ]));
  });

  it("retrieves a customer-fit product launch while preserving the limits of the shade-count proxy", () => {
    const match = retrieveCreativePrecedents("Redesign the core product for customer groups poorly served by category defaults, then test fit before expanding inventory").find(({ precedent }) => precedent.id === "CP-038");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("not independent audited causal estimates");
    expect(match?.precedent.causalLimit).toContain("A 40-shade target is not a universal inclusion standard");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.prnewswire.com/news-releases/rihanna-launches-fenty-beauty-a-global-makeup-brand-in-17-countries-643185393.html", claimRole: "action" }),
      expect.objectContaining({ url: "https://www.elle.com/beauty/makeup-skin-care/a20967710/makeup-companies-40-foundation-shades-fenty-beauty-influence/", sourceRole: "independent_secondary" }),
    ]));
  });

  it("retrieves a market-entry beachhead while preserving localization and capacity limits", () => {
    const query = "Use a community beachhead, local tastes, supply-chain investment, and aligned franchise partners for market entry";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-039");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("do not estimate how much any one mechanism contributed");
    expect(match?.precedent.causalLimit).toContain("do not isolate diaspora-led entry or menu localization as causal");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.jollibeegroup.com/history-milestones/", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://www.marketing-interactive.com/team-sport-global-cmo-david-beal-jollibee-interview", publicationDate: "2024-10-28" }),
      expect.objectContaining({ url: "https://time.com/6258979/jollibee-interview-ceo-ernesto-tanmantiong/", publicationDate: "2023-02-28" }),
    ]));
  });

  it("retrieves producer control of a value chain and surplus processing", () => {
    const match = retrieveCreativePrecedents("Help small producers reduce dependence on middlemen by sharing collection, processing, and marketing capacity for seasonal surplus", 3).find(({ precedent }) => precedent.id === "CP-040");
    expect(match).toBeDefined();
    expect(match?.precedent.transferRisk).toContain("fixed costs");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.amuldairy.com/history.php", sourceRole: "company_primary" }),
      expect.objectContaining({ url: expect.stringContaining("documents1.worldbank.org/curated/en/748851468771700148"), publicationDate: "2004-05" }),
    ]));
  });

  it("retrieves shared access through a local operator while preserving financing and infrastructure risks", () => {
    const match = retrieveCreativePrecedents("Let a local entrepreneur provide shared access to an expensive product using a network service and clear maintenance responsibilities", 3).find(({ precedent }) => precedent.id === "CP-041");
    expect(match).toBeDefined();
    expect(match?.precedent.causalLimit).toContain("do not show net income");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.grameentelecom.net.bd/our-work/village-phone", sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://www.adb.org/results/bangladesh-mobile-revolution", claimRole: "outcome" }),
    ]));
  });

  it("retrieves customer idea intake with explicit review governance and limits", () => {
    const match = retrieveCreativePrecedents("Create a customer idea pipeline with transparent review criteria and follow up on what the company accepts or declines", 3).find(({ precedent }) => precedent.id === "CP-042");
    expect(match).toBeDefined();
    expect(match?.precedent.outcome).toContain("about 400");
    expect(match?.precedent.outcome).toContain("do not establish sales or retention impact");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.stringContaining("i.dell.com/sites/csdocuments"), sourceRole: "company_primary" }),
      expect.objectContaining({ url: "https://pubsonline.informs.org/doi/10.1287/mnsc.1120.1599", publicationDate: "2013-01" }),
    ]));
  });

  it("retrieves a multi-barrier service offer without treating it as a discount", () => {
    const match = retrieveCreativePrecedents("Combine building materials, financing, expert design help, and delivery for customers who lack savings, storage, and construction know-how").find(({ precedent }) => precedent.id === "CP-043");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("rather than product price alone");
    expect(match?.precedent.transferRisk).toContain("Credit can create repayment harm");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.cemexmexico.com/sostenibilidad/vivienda/patrimonio-hoy", sourceRole: "company_primary" }),
      expect.objectContaining({ url: expect.stringContaining("documents1.worldbank.org/curated/en/426791468030548664"), sourceRole: "independent_secondary" }),
    ]));
  });

  it("retrieves brand-fit self-deprecating social voice with audience and conversion limits", () => {
    const query = "Build a self-deprecating voice from existing customer jokes about low-cost trade-offs";
    const match = retrieveCreativePrecedents(query).find(({ precedent }) => precedent.id === "CP-044");
    expect(match).toBeDefined();
    expect(match?.precedent.causalLimit).toContain("cannot be generalized");
    expect(match?.precedent.transferRisk).toContain("prosocial or antisocial");
    expect(match?.precedent.outcome).toContain("not bookings or causal business impact");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://sproutsocial.com/insights/podcasts/socialcreatures/ryanair-social-media-marketing/", publicationDate: "2023-07-11", sourceRole: "company_primary", claimRole: "action" }),
      expect.objectContaining({ url: "https://visualreview.net/revVISUAL/article/view/5832", sourceRole: "independent_secondary", claimRole: "outcome" }),
      expect.objectContaining({ url: "https://academic.oup.com/jcr/article/52/1/70/7743243", sourceRole: "independent_secondary", claimRole: "context" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "STRATEGY EXPLORATION", query)).toContain("CP-044");
  });

  it("retrieves opt-in personalization and sharing as a separate customer mechanism", () => {
    expect(retrieveCreativePrecedents("Create a personalized, shareable annual recap using each customer's own product history")[0]?.precedent.id).toBe("CP-011");
  });

  it("retrieves circular resale from the product lifecycle and operations mechanism", () => {
    expect(retrieveCreativePrecedents("Test a buyback and resale route for durable products with inspection and reverse logistics")[0]?.precedent.id).toBe("CP-012");
  });

  it("retrieves a licensed audience partnership that changes the product experience", () => {
    expect(retrieveCreativePrecedents("Partner with a popular entertainment property to update a learning product for its audience")[0]?.precedent.id).toBe("CP-013");
  });

  it("retrieves a location-triggered offer as a distinct distribution mechanism", () => {
    expect(retrieveCreativePrecedents("Use a geofence near competitor locations to trigger a one-time offer in the mobile app")[0]?.precedent.id).toBe("CP-014");
    expect(retrieveCreativePrecedents("Create a useful travel guide that helps customers use our product category")[0]?.precedent.id).toBe("CP-015");
    expect(retrieveCreativePrecedents("Respond to customer criticism with a core recipe change, franchisee support, and candid advertising")[0]?.precedent.id).toBe("CP-016");
  });

  it("retrieves fan co-creation through its mechanism, without requiring the target to be a toy company", () => {
    expect(retrieveCreativePrecedents("invite customers to propose product improvements and review suggestions before production")[0]?.precedent.id).toBe("CP-005");
  });

  it("uses stated business context, service geography, and owner constraints to explain transfer relevance", () => {
    const matches = retrieveCreativePrecedents({
      task: "Explore an unconventional community ritual that invites local outdoor customers to participate instead of buying on a retail holiday",
      brief: "A small local service business in the United States has limited owner time and wants useful community participation.",
      facts: ["The owner says the service area is regional and the team has limited capacity."],
      industryBusinessTypeId: "local_services",
      constraints: { ownerHoursPerWeek: 4, monthlyAdBudgetUsd: 0, serviceArea: "United States regional", businessTypes: ["local_service"] },
    });
    expect(matches[0]?.precedent.id).toBe("CP-007");
    expect(matches[0]?.matchReasons.some((reason) => reason.startsWith("geography: united"))).toBe(true);
    expect(["audience/context:", "goal:", "constraint:", "scale:", "business model:"].every((prefix) => matches[0]?.matchReasons.some((reason) => reason.startsWith(prefix)))).toBe(true);
    expect(formatCreativePrecedents({
      task: "Explore community participation ritual",
      brief: "Local outdoor business, limited owner time, United States",
      facts: [],
      constraints: { serviceArea: "United States" },
    })).toContain("Why retrieved:");
  });

  it("does not force a weak analogy when customer and constraint evidence are absent", () => {
    expect(retrieveCreativePrecedents("")).toEqual([]);
    expect(formatCreativePrecedents("")).toContain("No sufficiently relevant sourced creative precedent");
  });

  it("does not retrieve a case from geography or sector overlap without a mechanism match", () => {
    expect(retrieveCreativePrecedents({ task: "Compare retail businesses in the United States", brief: "Outdoor retail, local retail stores.", facts: [], constraints: { serviceArea: "United States" } })).toEqual([]);
  });

  it("retrieves a capacity-risk promotion case and separates aggregate profit from local service harm", () => {
    const query = "Turn a Pay Your Age birthday promotion from one overloaded event into an eligibility-bound offer with redemptions spread across several weeks and local appointment slots capped by staffing, queue, and safety capacity";
    const match = retrieveCreativePrecedents(query, 3).find(({ precedent }) => precedent.id === "CP-062");
    expect(match).toBeDefined();
    expect(match?.precedent.mechanism).toContain("profitable demand in aggregate");
    expect(match?.precedent.outcome).toContain("210-basis-point decline");
    expect(match?.precedent.causalLimit).toContain("event's standalone contribution");
    expect(match?.precedent.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://ir.buildabear.com/news-releases/news-release-details/everybody-come-build-bear-workshop-announces-pay-your-age-day", sourceRole: "company_primary", claimRole: "action" }),
      expect.objectContaining({ url: "https://abcnews.com/amp/US/build-bear-closes-lines-nationwide-safety-concerns-pay/story?id=56546711", sourceRole: "independent_secondary" }),
      expect.objectContaining({ url: "https://ir.buildabear.com/node/16491/pdf", claimRole: "outcome" }),
    ]));
    expect(creativePrecedentsForAgent("growth_plays", "Assess a customer promotion", query)).toContain("CP-062");
  });

  it("injects bounded precedents into every production growth-plays run", () => {
    const injected = creativePrecedentsForAgent("growth_plays", "Build a growth plan", "small business distinctive mascot identity customer recall visual constraints");
    expect(injected).toContain("Nintendo");
    expect(injected).toContain("precedent, not a forecast");
    expect(injected).not.toContain("Airbnb");
    expect(creativePrecedentsForAgent("social_posts", "Draft social captions", "small business mascot")).toBe("");
  });
});
