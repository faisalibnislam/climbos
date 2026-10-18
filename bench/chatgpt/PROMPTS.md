# ChatGPT comparison: Formkit (Luna vs Sol vs ClimbOS)

## How to run (8 chats)

| # | Task | Model | Save the answer as |
|---|---|---|---|
| 1 | Growth plan | GPT-6 Luna | `bench/chatgpt/strategy-luna.md` |
| 2 | Growth plan | GPT-6.1 Sol | `bench/chatgpt/strategy-sol.md` |
| 3 | Business insights | Luna | `bench/chatgpt/insights-luna.md` |
| 4 | Business insights | Sol | `bench/chatgpt/insights-sol.md` |
| 5 | LinkedIn posts | Luna | `bench/chatgpt/linkedin-luna.md` |
| 6 | LinkedIn posts | Sol | `bench/chatgpt/linkedin-sol.md` |
| 7 | Find customers | Luna | `bench/chatgpt/outbound-luna.md` |
| 8 | Find customers | Sol | `bench/chatgpt/outbound-sol.md` |

- **New chat for every run.** Memory and custom instructions off if you can (they leak context between runs).
- **Thinking on. Web search on.**
- Paste **the shared brief + one task prompt** below, nothing else. Don't nudge or ask follow-ups.
- Copy the whole final answer (use the copy button) into the file.
- On the first line of each file, write: `Model: <exact name shown> · Mode: <Thinking level> · Time: <seconds>` (time from send to finished, roughly).

---

## Shared brief (paste first, every time)

```
You are a world-class growth expert working for this small business. Your work goes to the owner, who reviews it before anything is published, sent or paid for.

BUSINESS: Formkit
WEBSITE: https://formkit.app
TYPE: B2B SaaS
GOAL: Get more paying customers in the next 90 days
MONTHLY AD BUDGET: USD 600 (a ceiling, not a target; paid directly to ad platforms)

Research the website and the web yourself before you answer.

Rules:
- Truth: state business facts only from the website or sources you found (cite them with links). Never invent numbers, prices, features, customers, reviews, testimonials, awards or results.
- Label every estimate or benchmark as an assumption or name its source.
- Anything meant to be published or sent (posts, emails) must be complete and ready to use: no placeholders like [NAME] or [NEEDS FACT].
- Owner-facing analysis: answer first, short bullets, no filler.
- No guarantees of outcomes, no fake urgency.
- Write like a sharp human expert: specific, concrete, plain words, no hype.
```

---

## Task 1: Growth plan

```
TASK: Create the 90-day growth plan for the goal, within the stated budget and a small business owner's time.

Build it around a portfolio of 2-4 growth plays:
- one bankable play,
- one or two creative-but-proven plays (a proven mechanic on a non-obvious audience, asset or moment for THIS business),
- at most one capped moonshot.
Go beyond social posts and email whenever something else would move the goal more.

For each play: forecast results from cited base rates with a low / likely / high range, a test with kill and scale rules, and a first action the owner can do today.

Then the plan around the plays: North Star metric with a 90-day target, channels in priority order (and what we are NOT doing, with why), phases, a week-one checklist, budget split within USD 600/month, and how we will measure.
```

## Task 2: Business insights

```
TASK: Produce business intelligence for this business that the owner can act on:
- competitive alternatives (3-5 direct competitors plus real alternatives like DIY or doing nothing), each with their headline claim, entry price and a weakness customers mention, with sources;
- customer groups;
- a voice-of-customer phrase bank (15-30 short verbatim phrases from reviews/forums, each with a link);
- objections;
- positioning (who it's for, the alternative, why it wins);
- pricing observations;
- SWOT;
- the customer journey;
- gaps no competitor owns;
- the top 3-5 opportunities, in priority order.
```

## Task 3: LinkedIn posts

```
TASK: Write 3 LinkedIn posts (founder voice unless the business suggests otherwise) that support the goal.

For each post give: the angle and who it's for (one line), the full post text ready to publish, the visual (none, image, document carousel slide-by-slide), alt text for any visual, and the call to action. Each post takes a different angle (e.g. an objection answered, a use case, a myth or mistake, proof or process). Never invent a customer, a story, a quote or a number.
```

## Task 4: Find customers (outbound)

```
TASK: Find 10 real companies that need this business now, from public web sources only.

First, the ideal customer profile: one sentence, must-haves, disqualifiers, buying triggers, and the decision-maker role.

Then, for each of the 10 companies: name, website, location, size band (if visible), why they need Formkit now (one line), evidence (URL + what you saw there), a trigger if there is one, fit and timing scores (0-100), and who to contact (a name and title only if published on their own site; otherwise the role). Only list an email address if it is published verbatim on a page you cite. Never invent a company, person or email. Exclude anyone it would be unlawful or unwise to cold-email, and say why.

Finally, write the cold email sequence: 3-4 emails on business days 0, 3, 7 and 14 (subject 2-5 plain words; first email 50-90 words; follow-ups 25-60 words, each adding something new). Mark where a personal first line goes as {{firstLine}}, and write that first line for each of the 10 companies, based only on that company's evidence. Don't write the greeting, footer or opt-out line.
```
