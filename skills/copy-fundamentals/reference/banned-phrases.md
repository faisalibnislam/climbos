## Reference: AI-copy failure modes and banned phrases

The lint layer checks the hard-fail list deterministically (case-insensitive, all word forms) before the critic sees your draft. The only exception: the phrase appears in the owner's own brand-voice samples. Fix every hit yourself first.

### Failure modes an expert reviewer flags in seconds

| # | Failure mode | What it looks like | Fix |
|---|---|---|---|
| 1 | Generic claims | "We're passionate about quality." Works for any business. | Replace with a number, process detail or scene only this business has. |
| 2 | Hype adjectives with no referent | revolutionary, game-changing, seamless, world-class | Delete the adjective; show the thing it was hiding. |
| 3 | Throat-clearing openers | "In today's fast-paced world…", "Let's dive in" | Start at the most specific sentence you have. |
| 4 | Rule-of-three padding | "fast, fresh and friendly" everywhere | Keep the one adjective you can prove. |
| 5 | "Not just X, it's Y" | "It's not about X. It's about Y." | State Y directly, with proof. |
| 6 | Disconnected one-liners | Each line a standalone slogan; nothing builds ("Forms that ask the right next question. / Forms can collect payments. / Try it with the form you've been putting off.") | One idea, told as cause and effect, with connecting words. |
| 7 | Invented facts | Fabricated stats, reviews, customer counts, awards, "studies show" | Use confirmed facts only; otherwise `[NEEDS FACT: …]`. Invented claims create legal exposure under advertising rules (UK CAP Code, US FTC) and destroy trust. |
| 8 | Emoji spam | Emoji bullets on every line; 🚀✨🔥 decoration | At most one emoji per 150 characters on LinkedIn, Facebook and email, and only if the brand uses them. Never as bullets. |
| 9 | Hashtag stuffing | Blocks of generic tags | Instagram ≤ 5 (platform cap). LinkedIn ≤ 3. X ≤ 1–2. TikTok 3–5. Facebook 0–2. Specific tags only. |
| 10 | Engagement bait | "Comment YES", "Tag a friend who…", "Agree?" | Ask a sincere question peers can answer from experience, or ask for nothing. LinkedIn and Meta demote bait. |
| 11 | Over-formatting | Bold everywhere, headers in a 120-word post, bullets for sentences | Plain sentences; format only long, scannable content. |
| 12 | Wrong-channel copy | Same text on LinkedIn, Instagram and X | Rewrite per channel from the core idea. |
| 13 | Vague CTAs | "Learn more", "Get started today!" | Verb + object + outcome. |
| 14 | Symmetry and sameness | Every sentence 15–20 words, every paragraph two sentences | Vary length deliberately. |
| 15 | Flattering the reader | "As a savvy business owner, you know…" | Describe their situation instead. |
| 16 | Fake urgency or scarcity | "Last chance!" with no deadline | Only real, dated deadlines and real limits. |
| 17 | Closing summaries | "In conclusion", "Ultimately", "At the end of the day" | End on the takeaway or the CTA. |
| 18 | Framework seams | "Imagine this…", "The result?", "Here's why:" | Delete the signpost; let the content carry the turn. |
| 19 | Fake-intimacy storytelling | "I'll never forget the day…" with no real day, place or number | Use a confirmed story with real details, or no story. |

### Hard-fail phrases

**Openers:** in today's fast-paced world · in today's digital age · in an ever-evolving landscape · let's dive in · let's dive into · buckle up · are you ready to · have you ever wondered · picture this · imagine a world · here's the thing · let that sink in · unpopular opinion (unless it genuinely is one) · I'm thrilled to announce · I'm excited to announce · I'm humbled to announce

**Hype words:** revolutionary · game-changer · game-changing · cutting-edge · state-of-the-art · next-level · world-class · best-in-class · seamless · seamlessly · robust · innovative solution(s) · unleash · unlock (your potential) · supercharge · skyrocket · elevate · empower · transform · transformative · harness · leverage (as a verb) · synergy · holistic · bespoke (unless the product is literally made to order) · curated · elevated

**AI-signature vocabulary:** delve · tapestry · testament to · navigate the complexities · realm · landscape (figurative) · multifaceted · pivotal · paramount · embark · journey (for a purchase) · foster · bustling · vibrant (for places) · nestled · boasts · a myriad of · plethora · intricate · underscores · in the world of

**Empty structures:** not just X, but Y · it's not about X, it's about Y · whether you're X or Y · from X to Y (as a range covering everything) · say goodbye to X and hello to Y · look no further · the secret to · that's where X comes in · the result? · the best part? · and the best part?

**Closers:** in conclusion · ultimately · at the end of the day · don't miss out · what are you waiting for · the future is here · join the revolution · stay tuned · drop a comment below · smash that like button · tag someone who

**Ad-policy risks** (also likely to fail Google or Meta review): "click here" · ALL CAPS words · repeated punctuation ("!!!", "??") · "#1" or "best" without a cited source · personal-attribute phrasing in Meta ads ("Are you struggling with debt?", "Other [group] people…")

### Warn list (not a hard fail, but each one needs a reason to stay)

here's why · let's break it down · the kicker · spoiler: · plot twist · hot take · in a nutshell · the power of · it's worth noting · when it comes to · no fluff · actionable insights · level up · game plan · a masterclass in · em-dash pileups (more than one per paragraph) · rhetorical question followed immediately by its answer · "I" or "we" opening four sentences in a row

### Deterministic lint rules your draft will face

- Banned phrase match: hard fail.
- Character and count limits per channel field (see each channel playbook).
- Emoji: at most 1 per 150 characters on LinkedIn, Facebook and email; never as bullets unless that is the brand voice.
- Hashtags: Instagram ≤ 5, LinkedIn ≤ 3, X ≤ 2, TikTok 3–5, Facebook ≤ 2.
- Exclamation marks: at most 1 per piece.
- Unsupported numbers: every digit sequence must trace to the brief, confirmed facts or a cited source, or it fails as `invented_fact`.
- Superlatives (best, #1, leading, top, fastest): fail unless a source is attached.
- Sentence-length variance: flagged if the spread is under about 4 words across 8+ sentences.
- "We" vs "you" in ads and landing copy: flagged if "we/our" outnumbers "you/your".
- Cross-channel duplication: flagged when two channel versions in one batch are near-identical.
