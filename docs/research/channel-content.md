# Channel Content Playbook for ClimbOS Content Agents

Researched 17 Oct 2026. Audience: the people and prompts that build ClimbOS's content agents (social, ads, landing pages, email, SEO, lead magnets).

How to use this document:

- **Part A** covers copywriting fundamentals that apply to every format. Agents should load it for every task.
- **Part B** covers AI-copy failure modes, the banned-phrase list, and lint rules. Run these as deterministic checks before any LLM judge.
- **Part C** is the universal rubric and the master limits table.
- **Part D** has one playbook per channel. Each one covers how the platform ranks or auctions content, what performs now, limits, a structure template, hooks and CTAs, a rubric, and good/bad examples.
- **Part E** gives implementation notes for the agent pipeline.

Source discipline: platform documentation is cited where it exists. When a claim comes from practitioners or vendor data, the text says so. Platforms change limits often, so treat the limits table as a config file to re-verify each quarter, not as constants.

**Running example (fictional):** *Loaf & Ladder* is a two-shop sourdough bakery in Bristol, UK, with an office-catering arm. Founder: Priya Shah. Facts we allow the agents to use:

- Dough ferments for 36 hours.
- Catering platters start at £7.50 a head and serve 10 to 200 people.
- Order by 2pm for delivery by 9am the next day.
- 140 Bristol offices have ordered in the last 12 months.
- Every box carries allergen labels.
- A free tasting box is available for teams of 10 or more.

Every example below uses only these facts. That rule is the first lesson: **an agent may not state a fact that is not in the business profile or the brief.**

---

## Part A — Copywriting fundamentals that transfer

### A1. The five things every piece needs before a word is written

A senior freelancer won't start without these. The agent shouldn't either: if an input is missing, it should ask for it or pull it from the business profile.

1. **One reader.** Name a specific person in a specific situation, not a demographic. For example: "an office manager booking lunch for a 14-person all-hands on Thursday", not "businesses".
2. **One job.** Decide the single action or belief change the piece is for: book a tasting box, save the post, click to the menu.
3. **Awareness level.** Eugene Schwartz's five stages are unaware, problem-aware, solution-aware, product-aware and most aware. The stage decides the opening. Cold audiences get problem-first openers. Warm audiences get offer-first openers. Most weak AI copy pitches the product to people who don't yet feel the problem.
4. **Proof inventory.** List the numbers, names, reviews, guarantees and process details you're allowed to use. Copy without proof is just claims.
5. **Voice-of-customer (VOC) bank.** Collect the exact phrases customers use in reviews, support emails, sales calls and Reddit threads. Joanna Wiebe at [Copyhackers](https://copyhackers.com/) popularised "review mining": lift customers' own words for headlines, because readers recognise their own language. For Loaf & Ladder, the VOC is "nobody has to do a Tesco run" and "the vegan one was actually labelled", not "premium artisanal catering solutions".

### A2. Principles, each with a test the agent can run

| Principle | What it means | Self-test |
|---|---|---|
| Specificity | Use numbers, names, times, places and concrete nouns | Could a competitor publish this sentence unchanged? If yes, rewrite it. |
| One idea per piece | One claim, developed, with support | Can you state the point in under 12 words? |
| Proof next to claim | Every claim sits beside its evidence | Underline each claim. Is there a number, quote or mechanism within two sentences? |
| Mechanism | Explain *why* it works ("36-hour ferment means it's still soft at 1pm") | Does the reader learn how, not just that? |
| Objection handling | Name the reason they won't act, then answer it | List the top 3 objections. Is each answered somewhere? |
| Reader-first | Talk about the reader's situation more than the brand | Count "you/your" against "we/our". In ads, "you" should usually lead. |
| Concrete CTA | Say the verb, the object and the outcome. Remove friction ("free", "2 minutes", "no card") | Does the reader know exactly what happens after the click? |
| Rhythm | Vary sentence length and keep paragraphs short. Write the way a person talks | Read it aloud. Do you stumble? Does every line sound the same? |
| Readability | Aim for plain language, around grade 5–8 for consumer audiences | Unbounce's benchmark data (via [MarketingProfs](https://marketingprofs.com/charts/2024/52374/landing-page-conversion-benchmarks)) found pages at grade 5–7 reading level converted at roughly double the median of college-level pages |

### A3. Frameworks: used well vs. used formulaically

Frameworks are scaffolding, so remove them before shipping. The reader should never be able to see the framework's skeleton.

| Framework | Used well | Formulaic (fails) |
|---|---|---|
| **PAS** (Problem–Agitate–Solve) | The problem is in VOC words and is specific to a moment. The agitation is a real consequence. The solution includes a mechanism. | "Tired of X? We get it. X is frustrating. That's why we created Y!" The agitation is melodrama, and the problem is generic. |
| **AIDA** | Attention comes from a specific, surprising fact. Desire is built from proof. Action is a low-friction next step. | The labels are visible: hype opener, vague benefits list, "Don't miss out!" |
| **BAB** (Before–After–Bridge) | Before and After are observable scenes ("1:05pm, 14 people, one sad supermarket platter"). The bridge is the specific offer. | Abstract states: "Before: stressed. After: thriving." |
| **4U headline test** (Useful, Urgent, Unique, Ultra-specific) | Used as a scoring check on headline variants | Fake urgency ("Last chance!") with no real deadline |
| **Hook → Value → CTA** (social) | The hook makes a promise and the body pays it off fully | The hook promises something the body never delivers ("Here's the secret…" followed by no secret) |

Rule for agents: **pick the framework from the awareness level, then write in the reader's language and delete every transitional phrase that announces the framework** ("Imagine this…", "Here's the thing…", "The result?").

### A4. Proof hierarchy

From strongest to weakest:

1. Verifiable number tied to a named source ("140 Bristol offices ordered in the last 12 months").
2. Named customer quote, with permission.
3. Demonstration or mechanism (showing the 36-hour ferment).
4. Guarantee or risk reversal.
5. Credentials or awards.
6. Unspecific superlatives ("best", "leading"). These are not proof, so ban them unless they're sourced.

---

## Part B — Failure modes of AI marketing copy, and the lint layer

### B1. Failure modes (what an expert reviewer flags in seconds)

Wikipedia's editor-maintained field guide, [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), is the most thorough public catalogue of these patterns ([TechCrunch coverage](https://techcrunch.com/2025/11/20/the-best-guide-to-spotting-ai-writing-comes-from-wikipedia/)). Marketing-specific versions:

1. **Generic claims that could fit any business.** "We're passionate about quality." Test: swap in a competitor's name. If it still works, it fails.
2. **Hype adjectives with no referent**: revolutionary, game-changing, cutting-edge, seamless, world-class.
3. **Throat-clearing openers**: "In today's fast-paced world…", "Let's dive in", "Are you ready to…?"
4. **Rule-of-three padding.** Triplets of adjectives or clauses everywhere ("fast, fresh, and friendly").
5. **"Not just X, it's Y" constructions**, plus "It's not about X. It's about Y."
6. **Disconnected one-liners.** LinkedIn-style "broetry" where each line is a standalone aphorism and nothing builds on what came before.
7. **Invented facts.** Fabricated stats, reviews, customer counts, awards, "studies show". This is the most dangerous failure. It creates legal exposure under advertising-standards rules (UK CAP Code, US FTC) and destroys trust.
8. **Emoji spam.** Emoji used as bullets on every line, or 🚀✨🔥 decoration.
9. **Hashtag stuffing.** Instagram now allows a maximum of 5 hashtags per post (see D2), and hashtags rarely matter on LinkedIn or X.
10. **Engagement bait**: "Comment YES", "Tag a friend who…". LinkedIn has said it reduces visibility for posts that explicitly ask for engagement ([Search Engine Land](https://searchengineland.com/linkedin-feed-less-polls-engagement-bait-384986)). Meta demotes it too.
11. **Over-formatting.** Bold everywhere, headers in a 120-word post, bullet lists for things that should be sentences.
12. **Wrong-channel copy.** The same text pasted to LinkedIn, Instagram and X, ignoring each feed's grammar.
13. **Vague CTAs**: "Learn more", "Get started today!" with no object or outcome.
14. **Symmetry and sameness.** Every sentence is 15–20 words and every paragraph is two sentences.
15. **Flattering the reader**: "As a savvy business owner, you know…"
16. **Fake urgency or scarcity**, with no actual deadline.
17. **Closing summaries**: "In conclusion", "Ultimately", "At the end of the day".

### B2. Banned-phrases list (hard-fail unless the user's own brand voice uses the phrase)

**Openers:** in today's fast-paced world · in today's digital age · in an ever-evolving landscape · let's dive in · let's dive into · buckle up · are you ready to · have you ever wondered · picture this · imagine a world · here's the thing · let that sink in · unpopular opinion (unless it really is one) · I'm thrilled/excited/humbled to announce

**Hype words:** revolutionary · game-changer/game-changing · cutting-edge · state-of-the-art · next-level · world-class · best-in-class · seamless/seamlessly · robust · innovative solution(s) · unleash · unlock (your potential) · supercharge · skyrocket · elevate · empower · transform(ative) · harness · leverage (as a verb) · synergy · holistic · bespoke (unless the product is literally made to order) · curated · elevated

**AI-signature vocabulary:** delve · tapestry · testament to · navigate the complexities · realm · landscape (figurative) · multifaceted · pivotal · paramount · embark · journey (for a purchase) · foster · bustling · vibrant (for places) · nestled · boasts · a myriad of · plethora · intricate · underscores · in the world of

**Empty structures:** not just X, but Y · it's not about X, it's about Y · whether you're X or Y · from X to Y (as a range of everything) · say goodbye to X and hello to Y · look no further · the secret to · that's where X comes in · the result? · the best part? · and the best part?

**Closers:** in conclusion · ultimately · at the end of the day · don't miss out · what are you waiting for · the future is here · join the revolution · stay tuned · drop a comment below · smash that like button · tag someone who

**Ad-policy risks** (also blocked by Google/Meta editorial rules or likely to fail review): "click here", ALL CAPS words, repeated punctuation ("!!!"), "#1" or "best" without a cited source, personal-attribute phrasing in Meta ads ("Are you struggling with debt?", "Other [ethnicity] people…").

### B3. Deterministic lint rules (run before any LLM judge)

- **Banned phrase match:** case-insensitive and lemmatised. Hard fail.
- **Character limits** per field, using the Part C table. Count double-width CJK characters as 2 for Google Ads.
- **Emoji count:** no more than 1 per 150 characters on LinkedIn, Facebook and email. No emoji in Google RSA (Google's editorial policy restricts them). Never use emoji as bullets on LinkedIn unless that's the brand voice.
- **Hashtags:** Instagram ≤ 5 (platform cap). LinkedIn ≤ 3. X ≤ 1–2. TikTok 3–5. Facebook 0–2.
- **Exclamation marks:** at most 1 per piece (Google text ads allow at most 1 and not in headlines).
- **Unsupported-number check:** every digit sequence in the output must trace to the brief or business profile. Otherwise fail with the label `invented_fact`.
- **Superlatives check:** best, #1, leading, top, fastest. Fail unless a source is attached.
- **Sentence-length variance:** flag if the standard deviation is under about 4 words across 8+ sentences.
- **"We" vs "you" ratio** for ads and landing pages: flag if "we/our" outnumbers "you/your".
- **Duplicate-across-channels check:** flag if cosine similarity between two channel outputs in the same batch is above about 0.85.

---

## Part C — Universal rubric and master limits table

### C1. Universal rubric (score every piece 1–5 on each criterion; the format rubrics in Part D add channel-specific criteria)

| Criterion | 1 — Fails | 3 — Competent | 5 — Best-in-class |
|---|---|---|---|
| **Specificity** | Generic; could be any business | Some specifics, but key claims vague | Every claim concrete (numbers, names, scenes); unmistakably this business |
| **Audience fit** | No identifiable reader | Right segment, generic situation | Speaks to one reader in one moment, in their words (VOC) |
| **Single idea** | Several competing messages | One main idea with digressions | One idea, fully developed; every line serves it |
| **Proof** | Unsupported or invented claims | Some proof, not adjacent to claims | Each claim carries evidence; strongest proof placed earliest |
| **Hook / opening** | Throat-clearing or generic | Clear but predictable | Stops the scroll with specificity, tension or a pattern break, and is paid off |
| **Voice** | Robotic, AI tells, banned phrases | Clean but bland | Sounds like a specific person/brand; varied rhythm; no AI tells |
| **CTA** | Missing or vague | Clear but high-friction or generic | One specific, low-friction action, with the outcome stated |
| **Channel nativeness** | Wrong format or length for channel | Fits limits, ignores channel norms | Uses the channel's grammar (fold, swipe, sound-off captions, SERP context) |
| **Accuracy & compliance** | Invented facts or policy violation | Accurate but risky phrasing | Fully traceable to source facts; policy-safe |

**Ship threshold suggestion:** no criterion below 3, and a mean of at least 4.0. Accuracy is a gate, so any 1 there blocks shipping.

### C2. Master limits table (verify quarterly)

| Channel / field | Limit | Practical target | Source |
|---|---|---|---|
| LinkedIn post (member or Page) | 3,000 chars | Hook in first ~140 chars (mobile fold ~140–210) | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit); LinkedIn Help |
| Instagram caption | 2,200 chars | First ~125 chars before "more" | Instagram Help |
| Instagram hashtags | **5 max** (since Dec 2025) | 3–5 specific tags | [Later](https://later.com/blog/instagram-hashtags/amp), Instagram Help |
| Instagram carousel | 20 items | 6–10 slides for teaching posts | [Social Media Today](https://www.socialmediatoday.com/news/instagram-expands-carousels-to-20-frames/723792/) |
| Instagram Reel | up to 3 min (since Jan 2025) | 15–60 s for reach; longer for depth | [Business Today](https://www.businesstoday.in/technology/news/story/instagram-head-announces-big-changes-3-minute-reels-and-new-look-for-profile-grid-461527-2025-01-21) |
| Facebook post | ~63,000 chars | 40–150 chars for most posts; long only for stories | Meta |
| X post | 280 (free); up to 25,000 (Premium) | Under ~250; only the first 280 show before "Show more" | [Typefully](https://support.typefully.com/en/articles/9756512-𝕏-long-form-posts-support-in-typefully) |
| TikTok caption | 4,000 chars (reported) | 1–3 lines with search keywords | [wordcountertool](https://www.wordcountertool.net/blog/tiktok-caption-length-guide) |
| TikTok in-feed ad video | 5–60 s | **21–34 s recommended** by TikTok | [TikTok Ads Help](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads) |
| Google RSA headline | 30 chars × up to 15 (min 3) | 10–15 distinct headlines | [Google Ads Help](https://support.google.com/google-ads/answer/7684791) |
| Google RSA description | 90 chars × up to 4 (min 2) | 4 | same |
| Google RSA display path | 15 chars × 2 | Keyword + location/offer | same |
| PMax headline | 30 chars (3–15) | 11–15 | [Google Ads Help](https://support.google.com/google-ads/answer/13676244) |
| PMax long headline | 90 chars (1–5) | 5 | [Google Ads Help](https://support.google.com/google-ads/answer/15864742) |
| PMax description | 90 chars (2–5; one must be ≤ 60) | 5 | same |
| PMax business name | 25 chars | Exact legal or domain name | [Google Ads Help](https://support.google.com/google-ads/answer/14528220) |
| Meta primary text | ~125 chars visible before "See more" | Front-load the hook in 125 | [Meta Ads Guide](https://www.facebook.com/business/ads-guide); [SaveMyLeads](https://savemyleads.com/blog/other/meta-ads-character-limits) |
| Meta headline | ~40 chars recommended (truncates ~27 on some mobile) | ≤ 27 for safety | same |
| Meta description | ~25–30 chars | Often hidden; never load-bearing | same |
| Email subject | No hard limit | ~30–50 chars; key words first | Practitioner consensus |
| Email preheader | ~40–130 chars rendered | 40–90 chars, complements subject | Practitioner consensus |
| SEO title tag | No hard limit; display truncates ~600 px | ~50–60 chars | Google Search Central |
| Meta description (SEO) | No hard limit | ~150–160 chars; Google often rewrites | Google Search Central |

---

## Part D — Channel playbooks

### D1. LinkedIn: company page and founder posts

**How distribution works (2025–2026).** LinkedIn's ranking has moved toward a single large ranking model. LinkedIn's [360Brew paper](https://export.arxiv.org/pdf/2501.16450) describes a 150B-parameter decoder model that reads member history and post text in natural language and replaces many task-specific models. In practice, relevance to each viewer's professional interests, plus evidence of topical expertise, matters more than raw engagement. LinkedIn has publicly said it:

- favours knowledge and advice, and content from people you know ([Social Media Today](https://www.socialmediatoday.com/news/linkedin-shares-new-insights-into-its-latest-algorithm-updates/654091/));
- demotes posts that ask for reactions or comments, and cut back polls ([Search Engine Land](https://searchengineland.com/linkedin-feed-less-polls-engagement-bait-384986)).

Practitioners consistently report three things:

- Meaningful comments and saves outweigh likes.
- Dwell time counts.
- External links in the post body reduce reach.

LinkedIn hasn't officially confirmed the specific penalty numbers, so treat these as heuristics. Third-party trackers report organic reach has roughly halved year-on-year ([upgrowth](https://upgrowth.in/linkedin-algorithm-2026-360brew-update/)). That means company Pages reach mainly followers, and **founder/employee posts carry most organic reach**. Page posts work best as proof and assets that employees can reshare. LinkedIn's Thought Leader Ads let you boost a founder's post as an ad.

**What performs now:**

- Founder first-person posts carrying one lesson from real operations, with specific numbers.
- Document/PDF carousels and multi-image posts. Vendor data ranks these above text-only, but treat that as directional.
- Short native video with captions.
- Contrarian-but-true takes backed by data.
- Behind-the-numbers posts ("what 140 office orders taught us about Thursday lunches").

**Structure template: founder post (150–300 words):**

1. **Hook (≤ 140 chars, before the fold):** a specific claim, a number, or the moment of tension. No preamble.
2. **Context (1–2 short paragraphs):** what happened, with real details.
3. **The insight:** one idea and the mechanism behind it.
4. **Proof:** a number, an example or a customer quote.
5. **Takeaway:** what the reader can do with it. This is more useful than a moral.
6. **Soft CTA or open question tied to the insight.** Not "Agree?". If you need a link, put it in the first comment or a later edit, and test both.

**Company page template:** an asset (stat, customer story, short how-to), one sentence of context, and a link-free CTA ("Menu and allergen sheet in comments"). Use up to 3 relevant hashtags at most, or none.

**Hooks that work:**

- A number plus a surprise ("We lost our biggest catering client over a label.").
- A specific scene.
- A counter-intuitive finding from your own data.
- "Here's what X costs" transparency.

**CTAs:** "If you book office lunches, the allergen template is in the comments", or a DM keyword *only* if it's genuinely useful and not bait.

**LinkedIn rubric (add to the universal rubric):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Above-the-fold hook | Starts with "I'm excited to…" or a generic truth | Clear topic but no tension | Specific tension or number in ≤ 140 chars that compels "see more" |
| Expertise signal | Opinion with no basis | Some experience shown | First-hand operational detail only this author could know |
| Comment-worthiness | Bait ("Agree?") or nothing to discuss | Invites generic agreement | Gives peers something substantive to add or dispute |
| Formatting | Wall of text or one-line broetry | Readable | Short paragraphs that *build* an argument; no emoji bullets |

**Bad (founder):**
> 🚀 Excited to share some thoughts on the catering industry! In today's fast-paced business world, office lunches are more important than ever. 🥪
> At Loaf & Ladder, we're not just a bakery — we're a team passionate about elevating your workplace experience. ✨
> What do you think? Comment below! 👇 #catering #food #business #bristol #lunch #teamwork

**Good (founder):**
> We almost lost a 60-person office account over one sandwich.
>
> In March, an engineer with a sesame allergy picked up a falafel wrap from our platter. The wrap was fine. The label was on the lid, and the lid was in the bin.
>
> Nobody got hurt, but the office manager's email was fair: "I can't check 60 wraps by hand."
>
> So we changed one thing. Every item now carries its own allergen sticker, not just the box. It added 11 minutes to each morning's packing.
>
> Since then, every repeat order from that office has said the same thing in the notes field: "stickers please".
>
> If you order food for a team, ask your caterer one question: is the label on the food, or on the packaging?

(Note: the March incident, the 11 minutes and the order-notes detail must come from the founder. The agent should prompt for a true story and never invent one.)

---

### D2. Instagram: feed, carousels, Reels scripts

**How distribution works.** Adam Mosseri named three signals as the most important across surfaces: watch time, likes per reach, and **sends per reach** (DM shares). Sends weigh more for reaching non-followers, and likes weigh more with existing followers ([Social Media Today](https://www.socialmediatoday.com/news/instagram-chief-shares-insights-into-its-algorithms-creator-monetization-a/718540/)). The design goal for reach is therefore content people send to a specific friend or colleague. Other changes:

- Reels can now be up to 3 minutes, and the profile grid went vertical (3:4) in January 2025.
- Carousels hold up to 20 items.
- **Since December 2025, posts are capped at 5 hashtags** ([Later](https://later.com/blog/instagram-hashtags/amp)). Old "30 hashtags in first comment" playbooks are now wrong.
- Meta is reducing distribution for unoriginal, reposted content ([Meta via MediaNama](https://www.medianama.com/2025/07/223-meta-cracks-down-on-unoriginal-facebook-content/)). Original footage, and no third-party watermarks, matters on both Instagram and Facebook.

**What performs:**

- Save-worthy teaching carousels (checklists, before/after, "how we do X").
- Short Reels with an immediate visual payoff.
- Behind-the-scenes process footage.
- Faces, and the owner on camera.
- Send-worthy relatable posts ("send this to whoever orders the office lunch").

**Carousel template (6–10 slides):**

1. Slide 1 is a promise headline of ≤ 10 words, plus a strong image. It has to work as a standalone feed post.
2. Slide 2 states the stakes or problem in one line.
3. Slides 3–8 make one point per slide, with large text and one visual. Each slide should create a reason to swipe.
4. The second-to-last slide is a summary or checklist (the screenshot slide).
5. The last slide has a CTA: save, send to a colleague, or "link in bio" plus the exact thing they'll find.

**Caption:** the first line restates the hook or adds context. Then 2–5 short lines, a keyword-rich sentence (Instagram search reads captions), and 3–5 specific hashtags.

**Reel script template (20–45 s):**

| Time | Visual | On-screen text | VO/caption |
|---|---|---|---|
| 0–2 s | The payoff shot first (a sliced loaf, steam) | Hook ≤ 8 words | Hook spoken |
| 2–10 s | Process, 3–4 cuts | One fact per cut | Mechanism |
| 10–25 s | Result or proof | Number or quote | Why it matters to viewer |
| Final 3 s | Loop-friendly end frame | CTA | "Send this to whoever orders lunch" |

Always add burned-in captions, because many people watch with sound off. Keep text inside safe zones, away from the bottom ~20% and the right edge.

**Instagram rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| First frame / slide 1 | Logo or title card | Clear but static | Payoff-first visual and ≤ 8-word hook |
| Save/send value | Pure promotion | Mildly useful | Reader would send it to a named person or save it for later |
| Slide/beat progression | Repetitive or random | Logical | Each slide or beat opens a loop the next one closes |
| Caption & tags | Hashtag block, emoji wall | Fine, generic | Keyword-rich first line, ≤ 5 precise tags |

**Bad caption:**
> ✨🥖 Fresh bread alert! 🥖✨ We're SO excited to share our amazing artisanal sourdough with you!! Made with love and passion 💕 #bread #sourdough #bakery #food #foodie #bristol #yum #instafood #breadmaking #delicious #fresh #local …

**Good carousel (slide headlines) + caption:**
> S1: "Why our sandwiches are still soft at 1pm"
> S2: "Most office platters are made the night before. Bread dries out."
> S3: "Our dough ferments for 36 hours."
> S4: "Long fermentation keeps the crumb moist for longer." *(only if the baker confirms this as their process claim)*
> S5: "We bake at 4am and deliver by 9am."
> S6: "Order by 2pm, eat tomorrow."
> S7: "Send this to whoever books your office lunch."
>
> Caption: *Office catering in Bristol, made with 36-hour sourdough. Platters for 10–200 from £7.50 a head; order by 2pm for next-day delivery. Menu in bio. #bristolfood #officecatering #sourdough*

---

### D3. Facebook page posts

**How distribution works.** Facebook's feed is now mostly recommendations, with heavy Reels weighting. Meta's July 2025 crackdown cut distribution and monetisation for accounts that repost others' content without meaningful changes ([MediaNama](https://www.medianama.com/2025/07/223-meta-cracks-down-on-unoriginal-facebook-content/)). For small businesses, Facebook remains strongest for:

- local community reach;
- events;
- Groups;
- older demographics;
- review-style and practical posts (opening hours, changes, offers).

Meta also demotes engagement bait and links to low-quality pages.

**What performs:**

- Local, human posts: staff, regulars, the shop at 6am.
- Short native video.
- Clear practical updates.
- Photo posts with one-sentence stories.
- Posts that give locals something to answer from experience. For example, "What was the first bakery you remember in Bristol?" works only when it's sincere and on-brand. "Like if you love bread!" is bait.

**Template:** a scene or news sentence, one detail, a practical line (when, where, how much), and a CTA (call, order link, directions). Use 0–2 hashtags at most.

**Facebook rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Local relevance | Could be posted anywhere | Mentions location | Rooted in a real local detail people recognise |
| Practical clarity | Missing when/where/how | Partial | Reader knows exactly what to do and when |
| Originality | Stock image, reposted meme | Own photo, generic copy | Original photo/video plus a first-hand story |

**Bad:** "Happy Friday everyone!!! 🎉 Who's ready for the weekend?? Like and share if you love bread! 🍞❤️"

**Good:** "The Gloucester Road shop opens at 7 tomorrow, not 8, for the half-marathon. Cinnamon knots come out at 7:15. Runners with a bib get a coffee on us."

(The half-marathon offer has to be a real decision by the business.)

---

### D4. X: posts and threads

**How distribution works.** X says both For You and Following are ranked by a Grok-based model using predicted engagement and relevance. The ranking code was published again in January 2026 ([SocialPilot](https://socialpilot.co/blog/twitter-algorithm)). Practitioners agree that:

- posts with external links get less reach;
- Premium accounts get a visibility boost.

These are third-party figures that conflict with each other, so test them. Free accounts are limited to 280 characters. Premium allows up to 25,000, and only the first 280 show before "Show more".

**What performs:**

- Sharp, specific, opinionated single posts.
- Replies to larger accounts in your niche.
- Short threads (4–8 posts) that teach one thing.
- Screenshots and numbers.
- Building in public.

X is a weak channel for most local small businesses. Recommend it mainly for B2B founders, tech-adjacent businesses and local news-driven brands.

**Thread template:**

1. Post 1 is a self-contained claim and promise, with a number.
2. Posts 2–6 give one step or point each. Each must stand alone if it's quoted.
3. The last post summarises, and then a reply carries the link (not the opener).

**X rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Compression | Padding, filler | Tight-ish | Every word earns its place; quotable |
| Standalone-ness (threads) | Posts depend on each other | Mostly self-contained | Each post works alone if screenshotted |
| Link placement | Link in the hook post | Link mid-thread | Link in reply/final post; hook is link-free |

**Bad:** "🧵 THREAD: 10 game-changing tips to elevate your office catering experience in 2026! Let's dive in 👇"

**Good:** "We delivered to 140 Bristol offices this year. The most common last-minute change wasn't headcount. It was 'one more vegan option'. So we now put one in every platter by default."

---

### D5. TikTok scripts (organic and Spark/in-feed ads)

**How distribution works.** TikTok's For You feed tests every video with small audiences and expands it based on completion, rewatches, shares and comments. Follower count matters less than on any other platform. TikTok is also a search engine for many younger users, so **spoken words, on-screen text and captions should include the phrases people search** ([Search Engine Land on description length](https://searchengineland.com/tiktok-video-descriptions-now-have-a-2200-character-limit-388204)). For in-feed ads, TikTok:

- allows 5–60 s and **recommends 21–34 s**;
- says longer captions shrink the safe zone, so key text must stay inside it;
- doesn't support hashtags, @mentions or clickable links in non-Spark ad captions ([TikTok Ads Help](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads)).

**What performs:**

- Creator-style, phone-shot, person-to-camera content.
- Process footage ("watch 200 knots get shaped in 40 seconds").
- POV and day-in-the-life videos.
- Reply-to-comment videos.
- Hooks that name the viewer's situation in the first 1–2 seconds.
- Ads that look like organic posts. Agency consensus is clear here, though most of it is third-party ([Stackmatix](https://stackmatix.com/blog/tiktok-creative-best-practices-2026)).

**Script template (25–35 s):**

```
HOOK (0–2s): [visual pattern-break] + spoken line naming viewer/situation (≤ 10 words)
ON-SCREEN: same hook as text (sound-off viewers)
SETUP (2–7s): the problem, one sentence, real detail
VALUE (7–25s): 3 beats — show, don't describe; one fact per beat
PROOF (25–30s): number, customer reaction, result shot
CTA (30–35s): one action, spoken + on-screen ("Comment 'menu' and I'll reply with it" only if someone will actually reply)
CAPTION: 1 line with search phrase + 3–5 tags (organic) / no tags (non-Spark ad)
SHOT LIST: [list of shots the owner can film on a phone in < 30 min]
```

ClimbOS should always output a **shot list the owner can realistically film**. A script that needs a studio fails a small business.

**TikTok rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Hook (0–2 s) | Logo, intro, "Hey guys" | Topic stated | Visual and verbal pattern-break naming the viewer's situation |
| Nativeness | Polished TV ad | Phone-shot but scripted-sounding | Indistinguishable from good organic content; talks like a person |
| Filmability | Needs crew or locations | Doable with effort | Owner can shoot it on a phone in one session; shot list included |
| Searchability | No keywords | Keywords in caption only | Search phrase spoken, on-screen and in caption |

**Bad hook:** "Hi everyone! Welcome back to Loaf & Ladder! Today we're going to talk about our amazing catering services!"

**Good hook + beats:**
> (Close-up: knife through a sandwich, crumb springs back) "This sandwich was made 6 hours ago."
> On-screen: *made at 4am, eaten at 1pm*
> Beat 1: dough tubs, "fermented for 36 hours". Beat 2: 4am oven, Priya loading trays. Beat 3: van doors, "on desks by 9".
> Proof: office worker squeezing the bread, "still soft".
> CTA: "Office lunch in Bristol? Order by 2pm, it's there tomorrow."
> Caption: *office catering bristol, next-day delivery*

---

### D6. Google Search RSA and Performance Max assets

**How the auction treats copy.** Ad Rank combines bid with quality. Quality Score components are expected CTR, ad relevance and landing page experience ([Google Ads Help: Quality Score](https://support.google.com/google-ads/answer/6167118)). Better-matched copy and pages lower cost per click. RSAs assemble up to 3 headlines and 2 descriptions per impression. Only Headline 1 and Description 1 are reliably shown, and assets can appear in any order ([Google Ads Help: RSAs](https://support.google.com/google-ads/answer/7684791)). Google's own best practices are:

- Use at least 3 headlines (up to 15) and at least 2 descriptions (up to 4).
- Put the keyword in at least one headline.
- Make every headline distinct: benefit, problem, offer, shipping/returns, CTA.
- Pin sparingly. If you must pin, give 2–3 options per pinned slot.
- Run at least 2 RSAs per ad group with Good/Excellent Ad Strength.

**2025–2026 automation shift:**

- **AI Max for Search** turns on text customization (Google writes extra assets from your site and ads) and Final URL expansion by default. Final URL expansion depends on text customization, and *pinning is ignored when it chooses a different URL* ([Google Ads Help: AI Max](https://support.google.com/google-ads/answer/15910187)).
- PMax has campaign-level brand guidelines and text guidelines, which restrict words and themes the AI may generate ([PPC Land](https://ppc.land/google-introduces-text-guidelines-for-ai-powered-advertising-campaigns/)).

Implication for ClimbOS: the agent writes **the human assets and the guardrails**. That means the asset set, URL exclusions, brand terms to avoid, and any required disclaimers. It doesn't just write the 15 headlines.

**RSA asset-set procedure:**

1. Pull the ad group's keyword theme and the landing page's H1 and offer.
2. Write 15 headlines across these slots:
   - 3–4 keyword-match headlines;
   - 3 benefit/outcome headlines;
   - 2 proof headlines (numbers, reviews);
   - 2 offer/price headlines;
   - 2 objection-handlers (dietary, timing, minimums);
   - 2 CTAs with outcome.
3. Write 4 descriptions. Each should be a complete thought that pairs with any headline, with one proof point and one CTA spread across them.
4. Check every combination reads naturally. No headline should depend on another.
5. Use display paths for the keyword and location.
6. Pin only legally required text.

**PMax:** write the RSA-style headlines plus up to 5 long headlines (90) and 5 descriptions (one ≤ 60), and use the business name exactly. Supply real images (landscape, square, portrait) and at least one owner-shot vertical video. Otherwise Google auto-generates video from your images, which is usually weak. One asset group per theme or audience signal.

**Google Ads rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Query match | No keyword in headlines | Keyword in 1–2 | Keyword variants in 3–4 without stuffing; mirrors landing page H1 |
| Asset diversity | Near-duplicate headlines | Some variety | Each headline a distinct angle (benefit, proof, offer, objection, CTA) |
| Combinability | Fragments that clash | Mostly works | Any 3 headlines + 2 descriptions read as a coherent ad |
| Policy & limits | Over limits, caps, "!!!", unsourced "#1" | Compliant, generic | Compliant and every character earns its place |
| Ad-to-page continuity | Promise not on page | Partially | Offer, price and language identical to landing page |

**Bad headlines:**

- "Best Catering Services Ever!!" (superlative, double exclamation, generic)
- "Quality Food Solutions" (generic)
- "Click Here For Catering" (policy)
- "Innovative Lunch Experiences" (hype)

**Good asset set (excerpt):**

| Field | Text | Chars |
|---|---|---|
| H | Office Catering in Bristol | 26 |
| H | Order by 2pm, Delivered by 9am | 30 |
| H | Platters From £7.50 a Head | 26 |
| H | Feeds 10 to 200 People | 22 |
| H | 140 Bristol Offices Use Us | 26 |
| H | Vegan & GF Boxes Labelled | 25 |
| H | Free Tasting Box for Teams | 26 |
| H | Baked Overnight, Not Frozen | 27 |
| D | Sandwich, salad and pastry platters for 10-200. Order by 2pm for next-day delivery. | 83 |
| D | Every box labelled for allergens. Vegan and gluten-free options on every menu. | 78 |
| PMax long H | Office catering in Bristol: platters for 10-200, ordered by 2pm, on your desk by 9am | 84 |
| PMax short D | Next-day office platters from £7.50 a head. | 43 |
| Business name | Loaf & Ladder | 13 |
| Paths | /office-catering /bristol | 15 / 7 |

("Vegan & GF Boxes Labelled" assumes the menu has gluten-free options. The agent must check the business profile first.)

---

### D7. Meta ads: primary text, headline, creative concepts, Advantage+

**How the auction treats creative.** Meta's auction picks the ad with the highest "total value", which combines the advertiser's bid, the estimated action rate and ad quality. Ad quality draws on feedback such as hides and on low-quality signals like engagement bait and withheld information. Low-quality creative therefore pays more for the same result. Meta's [Andromeda](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/) retrieval engine (rolled out from December 2024) narrows tens of millions of candidate ads per impression and matches creative to people. With broad targeting and Advantage+ audiences, **the creative is effectively the targeting.**

Meta and practitioners such as [Jon Loomer](https://www.jonloomer.com/meta-andromeda-creative-diversification/) recommend *creative diversification*: concepts that differ in angle, persona, format and hook. Changing only the CTA or colour produces near-duplicates that the system treats as the same ad. Two other changes:

- Advantage+ shopping campaigns were renamed **Advantage+ sales campaigns** in February 2025, and Advantage+ was extended to leads campaigns ([Social Media Today](https://www.socialmediatoday.com/news/meta-advantage-plus-ad-updates-february-2025/739472/)).
- Advantage+ creative can auto-generate text variations and adjust images.

ClimbOS should decide per account whether to allow these, and should always supply strong human variants as the seed.

**Creative concept procedure (for a small budget):**

- Produce **3–5 genuinely different concepts**. Small accounts don't need 25 ([Excite Media](https://www.excitemedia.com.au/meta-creative-diversification/)). Each concept has a distinct:
  - persona or awareness level (e.g. an office manager who's never heard of you; a past customer; a team-lead planning an event);
  - angle (problem/agitation, demo, social proof, offer, founder story, comparison);
  - format (UGC-style vertical video, static with a bold claim, carousel of menu items, before/after).
- For each concept, write:
  - 2–3 primary texts (one short ≤ 125 chars, one medium of 3–5 lines, one long story if appropriate);
  - 3 headlines (≤ 27–40 chars);
  - a CTA button;
  - a creative brief: first 3 seconds, on-screen text, shot list or image description, and safe-zone notes for 9:16.

**Primary text template:**

1. Line 1 (≤ 125 chars) is the hook and does all the work: the situation plus the specific outcome.
2. Lines 2–4 give the proof and the mechanism.
3. The last line is the offer and CTA.

Avoid personal-attribute phrasing ("Are you an office manager?"), which Meta policy prohibits. Write "For office managers…" or describe the situation instead.

**Meta ads rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Thumb-stop (visual + line 1) | Generic stock + brand intro | Clear but forgettable | Pattern-break visual and a hook naming the situation in ≤ 125 chars |
| Concept diversity (set) | Variants differ only in wording/colour | 2 distinct angles | 3–5 concepts differing in persona, angle and format |
| Native feel | Looks like a banner ad | Mixed | Looks like content the viewer would follow |
| Policy safety | Personal attributes, unsourced claims | Minor risk | Clean |
| Offer clarity | No offer or vague | Offer present | Offer, price/terms and next step clear in headline + text |

**Bad primary text:** "Are you an office manager struggling with catering? 😩 Say goodbye to boring lunches and hello to our revolutionary, artisanal catering solutions! ✨ Elevate your team's experience today!"

**Good (concept: "Thursday lunch, sorted", problem-aware office managers, UGC video):**
> Primary: "Ordering lunch for 12 by tomorrow? Book by 2pm and it's on your desk by 9am."
> Lines 2–3: "Sourdough fermented 36 hours, so sandwiches stay soft till lunch. Every item allergen-labelled. 140 Bristol offices ordered this year."
> Last line: "Platters from £7.50 a head. Free tasting box for teams of 10+."
> Headline: "Office lunch for 12, sorted by 2pm" (34) · CTA button: Order now
> Creative brief: 0–2 s close-up of a platter landing on a desk, with on-screen text "Ordered at 1:58pm yesterday". 3–10 s a quick unboxing and a hand on an allergen sticker. End card with the price.

---

### D8. Landing pages and conversion copy (CRO)

**What matters.** Paid traffic quality and cost depend on the page as well as the ad. Google scores landing page experience in Quality Score, and Meta's ad quality signals include post-click experience. Unbounce's 2024 benchmark puts the median landing page conversion rate at 6.6% across industries. Simpler reading levels correlate with higher conversion ([MarketingProfs summary](https://marketingprofs.com/charts/2024/52374/landing-page-conversion-benchmarks)). Message match and one goal per page are the most consistently validated CRO principles. Practitioners such as [CXL](https://cxl.com/) and Peep Laja emphasise clarity of the value proposition over cleverness.

**Section template (single-offer page):**

1. **Hero:**
   - H1 that matches the ad promise and states the outcome for the reader.
   - Subhead covering who it's for, what you get and the key differentiator.
   - Primary CTA with the outcome ("Get my free tasting box").
   - A proof chip ("140 Bristol offices this year").
   - A real photo.
2. **Problem in VOC language:** 2–3 lines.
3. **How it works:** 3 steps, with times and prices.
4. **Proof block:** named testimonials with specifics, logos with permission, numbers.
5. **Offer detail:** what's included, pricing, minimums, delivery windows.
6. **Objection-handling FAQ:** dietary needs, cancellations, invoicing, minimum order, delivery area.
7. **Risk reversal:** guarantee or free trial.
8. **Repeat CTA** and contact details. A phone number builds trust for local businesses.

**CRO checklist:**

- [ ] The ad headline's words appear in the H1.
- [ ] A visitor can say what's offered, to whom and at what price within 5 seconds.
- [ ] There's one primary action. Navigation is removed or minimised on paid pages.
- [ ] The form asks only what's needed now.
- [ ] Proof sits next to each claim.
- [ ] Copy is at grade 5–8 reading level.
- [ ] It's mobile-first: CTA above the fold and tap targets ≥ 44 px.
- [ ] Load is fast. Measure LCP and INP.
- [ ] No invented testimonials. Every quote has a source record.

**Landing page rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Message match | H1 unrelated to ad | Related theme | Same promise, wording and offer as the ad |
| 5-second clarity | Clever or vague headline | Clear but buried offer | What, who, price and next step instantly clear |
| Objection coverage | None | Some FAQs | Top objections from VOC answered where they arise |
| Friction | Long form, many CTAs | Moderate | Minimal fields, one action, risk reversal |
| Proof density | None or fake | Generic testimonials | Specific, attributed, numeric proof near claims |

**Bad H1:** "Elevate Your Workplace Dining Experience With Innovative Artisanal Solutions"

**Good hero:**
> H1: *Office lunch for 10–200, on your desk by 9am*
> Sub: *Sourdough sandwiches, salads and pastries for Bristol offices. Order by 2pm, every item allergen-labelled, from £7.50 a head.*
> CTA: *Get a free tasting box* · micro-copy under button: *For teams of 10+. No card needed.*
> Proof: *Ordered by 140 Bristol offices in the last 12 months*

---

### D9. Lifecycle and nurture email sequences

**How the inbox treats you.**

- **Gmail and Yahoo:** since 2024, bulk senders must authenticate with SPF, DKIM and DMARC, support one-click unsubscribe (RFC 8058) and honour it within about 2 days, and keep spam complaints under 0.3%, ideally under 0.1% ([Gmail sender guidelines](https://support.google.com/a/answer/81126); [Red Sift on 2025 enforcement](https://redsift.com/resources/blog/gmails-enforcement-ramps-up-what-bulk-senders-need-to-know)). Enforcement tightened in November 2025.
- **Microsoft Outlook.com** introduced similar requirements for high-volume senders in 2025.

Gmail's ranking of promotions versus primary is driven by engagement. **Apple Mail Privacy Protection** inflates opens, so judge emails on clicks, replies and conversions, not open rate ([Braze](https://www.braze.com/resources/articles/deliverability-indicators-email-opens.md)). Automated flows outperform broadcasts on clicks. Klaviyo data cited secondhand puts automated flows at about 5.6% average click rate ([Prospeo](https://prospeo.io/s/what-is-a-good-email-open-rate)).

**What performs:**

- Plain, personal-looking emails from a named human.
- One idea and one CTA per email.
- Subject lines that are specific and curiosity-driven without being clickbait.
- Behaviour-triggered sends (signup, first order, no reorder in 30 days).
- Replies invited and actually answered. Replies also help deliverability.

**Welcome/nurture sequence template (lead from the tasting-box offer):**

| # | Timing | Job | Content |
|---|---|---|---|
| 1 | Immediately | Deliver + set expectations | Confirm the box date, what's inside, who's bringing it; one question ("How many people usually eat?") |
| 2 | Day after tasting | Ask for reaction + easy first order | "What did the team eat first?" + link to pre-filled order for their headcount |
| 3 | +3 days | Handle the main objection | Dietary/allergen process with photo of labels |
| 4 | +7 days | Proof | Short story of a similar office (with permission) + numbers |
| 5 | +14 days | Offer with real deadline (if one exists) | e.g. first order delivery free if booked this month |
| 6 | +30 days, no order | Breakup / preference | "Should I stop sending these?" + options (monthly menu only / pause) |

Exit the sequence immediately on order. Branch on clicks (for example, a click on vegan menu leads to the dietary-focused path).

**Email anatomy:**

- Subject of 30–50 characters with the specific noun up front.
- Preheader that adds new information and doesn't repeat the subject.
- First line that's about the reader, not "I hope this email finds you well".
- Body of 50–150 words for nurture emails.
- One link or button.
- A P.S. for a secondary point.

**Email rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Subject + preheader | Clickbait or generic ("Newsletter #12") | Clear, flat | Specific, intriguing, honest; preheader adds info |
| Sequence logic | Same pitch repeated | Varied topics | Each email has a distinct job matched to stage; exits on conversion |
| Human voice | Corporate template | Friendly | Reads like a note from a named person; invites reply |
| Single CTA | Many links | 2–3 | One clear action with outcome |
| Deliverability hygiene | Image-only, link-heavy, spammy words | OK | Text-led, few links, unsubscribe clear |

**Bad:**
> Subject: 🎉 Unlock Amazing Catering Experiences Today!!!
> "Dear Valued Customer, In today's busy world, we know how important it is to keep your team happy. That's why Loaf & Ladder offers revolutionary catering solutions…"

**Good (email 2):**
> Subject: What did your team eat first?
> Preheader: Your tasting box went out Tuesday. Here's a one-click reorder.
> "Hi Sam, the tasting box should have reached your 3rd-floor kitchen by 9 on Tuesday. I'm curious what disappeared first (it's usually the cinnamon knots).
> If you want the same again for a team lunch, I've pre-filled an order for 14 people: [Reorder for 14 — £105]
> Order by 2pm and it arrives by 9 the next morning.
> — Priya, Loaf & Ladder
> P.S. Reply with any allergies and I'll check the menu myself."

---

### D10. SEO pages and content briefs (AI search era)

**What changed in 2025–2026:**

1. **AI Overviews and AI Mode** answer many informational queries directly.
   - Pew found that users clicked a traditional result on about 8% of visits when an AI summary appeared, versus 15% without one ([Pew Research, July 2025](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)).
   - Ahrefs measured a 58% lower CTR for position 1 when an AI Overview is present, in December 2025 ([Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/)).
   - Seer found organic CTR fell 61% on AIO queries, but **cited pages got about 35% more clicks than uncited ones** ([PPC Land summary of Seer](https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/)).

   Informational top-of-funnel traffic is shrinking. Being *cited* now matters, and commercial and local pages hold up better.
2. **Google says no special "AI optimization" is needed.** There are no extra technical requirements, special schema or AI text files. A page must be indexed and snippet-eligible to appear as a supporting link. AI Mode uses "query fan-out", running related sub-queries, so content that answers adjacent sub-questions clearly has more chances to be cited. AI feature traffic is reported inside Search Console's Web performance totals ([Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features), updated Dec 2025).
3. **Spam policy targets scaled AI content.** "Scaled content abuse" covers mass-produced pages made mainly to rank, regardless of how they were made. Google's changelog reportedly extended spam policies explicitly to AI Overviews and AI Mode in 2026 ([PPC Land](https://ppc.land/google-spam-policies-now-officially-cover-ai-overviews-and-ai-mode-in-search)). **For ClimbOS this is existential: never generate templated city×service page farms.** Every page needs unique, first-hand value.
4. **E-E-A-T** (Experience, Expertise, Authoritativeness, Trust) is a quality-rater framework, not a direct ranking factor. Trust is the most important element. Google's [helpful content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) asks creators to consider *who* made the content, *how* (including disclosure of automation where readers would expect it) and *why* (to help people, not to rank).
5. **Topical authority:** sites that cover a topic in depth and link related pages logically are more likely to be seen as a go-to source than sites with scattered one-off posts. For small businesses, this means a tight cluster around what they actually sell and where.

**What performs for small businesses now:**

- Service and location pages with real specifics: prices, areas served, photos, process, FAQs from actual customers.
- Google Business Profile completeness and reviews for local search. Google's AI features page says to keep Business Profile current.
- Comparison and cost pages ("How much does office catering cost in Bristol?") with real numbers.
- First-hand guides that AI summaries cite because they contain unique data.

**SEO brief template (the agent fills this before drafting):**

```
Target query + intent (informational / commercial / local / transactional)
Primary reader + their situation
SERP read: what ranks now, AIO present? which sources cited? what's missing?
Fan-out sub-questions (5–10) the page must answer
Unique value: first-hand data, photos, prices, process, opinion only we have
Proof/experience signals: author name + role, photos, customer quotes, dates
Outline: H1 (matches query in natural words), H2s = sub-questions, answer-first paragraphs
Internal links: up to cluster hub, across to 2–3 siblings, down to the money page
Schema: only what's visible on page (LocalBusiness, FAQ if real FAQs, Product/Offer)
Title (~55 chars), meta description (~155 chars), slug
Conversion path: the one CTA appropriate to intent
Update cadence + "last reviewed" date
```

**Writing rules for citation-worthiness:**

- Answer the question in the first 1–2 sentences under each heading.
- Use explicit numbers and dates.
- Use tables for comparisons.
- Name the author and their experience.
- Show original photos.
- Avoid hedging filler.
- Keep important content in HTML text, not in images.

**SEO rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Intent match | Wrong page type for query | Right type, generic | Exactly the format the SERP rewards, better executed |
| Information gain | Rehash of top 10 | Some unique detail | Contains data, photos or experience no competitor page has |
| Answer-first structure | Buried answers | Partial | Each H2 answered in first sentence; fan-out sub-questions covered |
| E-E-A-T signals | Anonymous, no sources | Author named | Named expert, first-hand evidence, dated, sourced, contactable |
| Scaled-content risk | Template with swapped city name | Partly unique | Unmistakably unique; would exist even if search didn't |

**Bad intro:** "In today's ever-evolving culinary landscape, office catering has become a pivotal part of workplace culture. In this comprehensive guide, we'll delve into everything you need to know."

**Good intro (page: "Office catering costs in Bristol"):**
> *Office catering in Bristol typically costs £7–£15 per person for a sandwich lunch, depending on menu and delivery time. At Loaf & Ladder, platters start at £7.50 a head for 10–200 people, with next-day delivery if you order by 2pm. Below: what drives the price, what's included, and the four questions to ask any caterer about allergens.*

(The market range "£7–£15" must come from research the agent cites, or be removed. Only the bakery's own prices are known facts.)

---

### D11. Lead magnets

**What performs.** A lead magnet works when it solves one narrow, urgent problem for the exact buyer, can be consumed in minutes, and leads naturally to the paid offer. For small businesses, the best performers are:

- **Tools and calculators** (catering budget per head).
- **Checklists and templates** (an allergen request form for office managers).
- **Free samples and trials** (the tasting box is the strongest magnet here).
- **Short local guides with real data.**

Long generic ebooks ("The Ultimate Guide to Workplace Wellness") underperform and attract the wrong leads. Gated content has also lost SEO value as AI answers absorb generic information, so prioritise things AI can't give: the business's own data, tools, samples and access.

**Procedure:**

1. Pick the buyer's most common pre-purchase task or fear. Mine sales calls and FAQs for it.
2. Choose the lightest format that solves it.
3. Name it with the outcome and specifics ("Office Lunch Planner: headcount, dietary needs and budget in one page").
4. Make the next step obvious inside the asset (pre-filled order link).
5. Write the landing page (D8) and email 1 (D9) together.
6. Measure leads that become customers, not downloads.

**Lead magnet rubric (add):**

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Specificity of promise | "Ultimate guide" | Narrow topic | One concrete outcome for one buyer in minutes |
| Bridge to offer | Unrelated | Loosely related | Using it naturally leads to buying |
| Uniqueness | Generic info AI can produce | Some own data | Proprietary tool, data, sample or template |
| Consumption cost | 40-page PDF | 10 pages | Under 5 minutes to use |

**Bad:** "Download our FREE eBook: 50 Tips to Revolutionize Your Workplace Culture Through Food!"

**Good:** "Office Lunch Planner (1 page): enter headcount and dietary needs, get a menu and exact cost, then order in one click. Or skip it and get a free tasting box for your team."

---

## Part E — Implementation notes for ClimbOS agents

1. **Inputs first.** Every generation call receives:
   - the business profile (allowed facts, prices, proof, voice samples, banned claims);
   - the brief (reader, job, awareness stage, channel, objective);
   - the VOC bank.

   If proof is missing, the agent asks or leaves a visible `[NEEDS FACT: …]` placeholder. It never invents.
2. **Generate wide, then select.** For each piece, generate 3–5 variants with deliberately different angles, using the D7 diversity rules. Run the B3 lint, then an LLM judge with the C1 rubric plus the channel rubric, then revise the top 1–2 against the judge's lowest criterion.
3. **Judge calibration.** Give the judge the good/bad examples from this document as anchors. Require evidence for each score (quote the line). Score accuracy by checking each claim against the profile.
4. **Channel adaptation is a rewrite.** Derive each channel version from the core message, not from another channel's text.
5. **Platform automation as a co-writer.** For AI Max, PMax and Advantage+, output guardrails as well as assets: brand and text guidelines, URL exclusions, required disclaimers, and whether to allow text customization.
6. **Refresh this file quarterly.** Limits (Instagram hashtags, X lengths, Meta placements) and ranking signals change. Keep limits in a config the lint layer reads.
7. **Measure what matters per channel:**
   - Social: sends and saves.
   - Email: clicks and replies.
   - Ads: CPA by concept, not by tiny copy tweaks.
   - SEO: citations in AI features plus conversions from commercial pages.

---

## Sources (primary first)

- Google Ads Help — [About responsive search ads](https://support.google.com/google-ads/answer/7684791); [PMax asset requirements](https://support.google.com/google-ads/answer/13676244); [PMax asset group best practices](https://support.google.com/google-ads/answer/14528220); [PMax store goals specs](https://support.google.com/google-ads/answer/15864742); [AI Max for Search](https://support.google.com/google-ads/answer/15910187); [Final URL expansion](https://support.google.com/google-ads/answer/14337539); [Quality Score](https://support.google.com/google-ads/answer/6167118)
- Google Search Central — [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features); [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content); [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- Google Workspace — [Email sender guidelines](https://support.google.com/a/answer/81126)
- Meta — [Andromeda engineering post](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/); [Meta Ads Guide](https://www.facebook.com/business/ads-guide)
- TikTok — [Auction In-Feed Ads specs](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads)
- LinkedIn — [360Brew paper (arXiv 2501.16450)](https://export.arxiv.org/pdf/2501.16450)
- Research — [Pew Research (Jul 2025)](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/); [Ahrefs AIO CTR update](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/); [Seer via PPC Land](https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/); [Unbounce benchmarks via MarketingProfs](https://marketingprofs.com/charts/2024/52374/landing-page-conversion-benchmarks)
- Platform news and practitioners — [Social Media Today: Mosseri ranking signals](https://www.socialmediatoday.com/news/instagram-chief-shares-insights-into-its-algorithms-creator-monetization-a/718540/); [SMT: Advantage+ Feb 2025](https://www.socialmediatoday.com/news/meta-advantage-plus-ad-updates-february-2025/739472/); [SMT: LinkedIn algorithm insights](https://www.socialmediatoday.com/news/linkedin-shares-new-insights-into-its-latest-algorithm-updates/654091/); [Search Engine Land: LinkedIn engagement bait](https://searchengineland.com/linkedin-feed-less-polls-engagement-bait-384986); [Jon Loomer: creative diversification](https://www.jonloomer.com/meta-andromeda-creative-diversification/); [Later: Instagram hashtags](https://later.com/blog/instagram-hashtags/amp); [MediaNama: Meta unoriginal content](https://www.medianama.com/2025/07/223-meta-cracks-down-on-unoriginal-facebook-content/); [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [PPC Land: PMax text guidelines](https://ppc.land/google-introduces-text-guidelines-for-ai-powered-advertising-campaigns/); [Braze on opens](https://www.braze.com/resources/articles/deliverability-indicators-email-opens.md)
- Vendor or third-party claims flagged as directional in the text: upgrowth (LinkedIn reach), SocialPilot (X), Stackmatix (TikTok), Excite Media (Meta concept counts), Prospeo/Klaviyo (email clicks), SaveMyLeads (Meta text limits), wordcountertool (TikTok caption length).
