# Growth engine architecture, contracts and formulas

Proposal only. Nothing here is live until approved (spec §29 phases B–D).

## 1. Principles

- Keep the stack: Convex, Vercel, OpenAI (Luna/Sol), Resend. Add no agent framework.
- **Code does the maths; the model chooses and explains.** The model never computes a forecast number.
- A missing number is `null` with a reason. It is never a guess.
- Add a stage only if the evaluation shows it wins (spec §02).

## 2. Target flow

```
Snapshot (versioned) ─► Evidence (fetched, stored, cited)
        │
        ▼
Diagnose (1 call) ─► 2–3 candidate strategies (1 call)
        │
        ▼
Calculator (code) fills every number per candidate
        │
        ▼
Select + review (1 call, critic sees full evidence) ─► ≤1 bounded repair
        │
        ▼
Owner synthesis ─► provisional plan + ≤3 questions that would change it
        │                       (owner answers → re-run calculator only)
        ▼
Approval (separate state; nothing sends, posts or spends without it)
```

| Stage | Today | Proposed | Arm |
|---|---|---|---|
| Intake | Goal + free facts | + `MetricInput`s from the owner, the site and research | B |
| Research | Agent `web_search`, notes cut at 40k | Question-driven (3–5 questions, ≤10 sources), sources stored | B/D |
| Plays + plan | 2 agents, each draft → critic → revise | Arm C: one call. Arm D: diagnose → candidates → select | C/D |
| Numbers | Model writes P10/P50/P90; lint checks within 2× | Calculator output only; the model refers to IDs | B |
| Consistency | Luna reconcile pass | Unneeded once numbers come from code; keep only if eval shows value | B/D |

## 3. Data contracts (TypeScript, Zod at runtime)

These live in `shared/growth/contracts.ts` (new) and are reused by the Convex validators.

```ts
type Provenance = "owner" | "connected" | "website" | "research" | "benchmark" | "assumption";

interface EvidenceRef {
  id: string;                 // "ev_…", stable within a snapshot
  kind: "page" | "search" | "fact" | "metric";
  url?: string; title?: string;
  excerpt: string;            // ≤ 600 chars, stored with the plan
  fetchedAt: number;
  tenantId: Id<"organizations">;
}

interface MetricInput {
  key: string;                // "price_month", "gross_margin", "monthly_churn", "cpc", …
  value: number | null;       // null = unknown; never guessed
  unit: "usd" | "ratio" | "count" | "hours" | "days";
  provenance: Provenance;
  evidence: string[];         // EvidenceRef ids
  range?: { low: number; high: number };
  note?: string;              // why it is unknown or how it was estimated
}

interface CalculationResult {
  id: string;                 // "calc_…"; the plan text refers to these ids
  formula: string;            // catalog key, e.g. "paid.cac_media"
  inputs: string[];           // MetricInput keys
  value: number | null;       // null if any required input is null
  low?: number; high?: number;// from input ranges, not fixed multipliers
  missing: string[];          // inputs that blocked it
}

interface Recommendation {
  playId: string;
  decision: "do_now" | "test" | "later" | "no";
  why: string;                // ≤ 30 words
  calcs: string[];            // CalculationResult ids
  evidence: string[];         // EvidenceRef ids
  assumptions: string[];      // MetricInput keys with provenance "assumption"
  ownerQuestion?: string;     // only if the answer would change `decision`
  approvalRequired: boolean;  // true for send / post / spend
}
```

What gets stored: `strategies` gains `snapshotId`, `evidence: EvidenceRef[]`, `inputs: MetricInput[]`, `calcs: CalculationResult[]` and `recommendations`. This is additive: old plans still render.

## 4. Formula catalog (code: `shared/growth/calc.ts`, pure TS)

| Key | Formula | Spec |
|---|---|---|
| `funnel.customers` | reach × Π step rates (one cohort) | §15.1 |
| `paid.clicks` | spend / CPC | §15.2 |
| `paid.cac_media` | spend / new customers | §15.3 |
| `cac.full` | (spend + owner hours × hourly cost + tools) / customers | §15.3 |
| `unit.cm_month` | revenue per month × contribution margin | §16.1 |
| `ltv.cm_n` | cm × (1 − (1−c)^n) / c, or cm × n when c = 0 | §16.2 |
| `payback.simple` | CAC / cm_month | §16.3 |
| `cac.allowable_n` | ltv.cm_n (target payback horizon) | §15.4 |
| `paid.breakeven_cpc_n` | ltv.cm_n × click→signup × signup→paid | §15.4 |
| `mrr.next` | MRR × (1 − churn) + new × price | §16.4 |
| `portfolio.customers` | Σ plays × (1 − overlap), overlap a stated assumption | §16.8 |

Every formula returns `null`, plus a list of the missing inputs, when a required input is null. The calculator never fills in defaults.

### Fixture (spec §18), the unit test to add

| Input | Value |
|---|---|
| Spend | 600 |
| CPC | 2 |
| Click → signup | 0.08 |
| Signup → paid | 0.25 |
| Revenue per month | 30 |
| Margin | 0.80 |
| Churn | 0.05 |

| Output | Expected |
|---|---|
| Customers | 6 |
| CAC | 100 |
| Contribution per month | 24 |
| Payback | 4.1667 |
| CM over 3 months | 68.46 |
| CM over 12 months | 220.6272 |
| Break-even CPC (3 months) | 1.3692 |

Also test: null inputs, churn = 0, rates above 1, negative spend.

## 5. Forecasting and uncertainty

- **P10/P90 → low/high.** Compute them by running the funnel with every input at its low (or high) range. Label them "low case" and "high case", not percentiles (D6).
- An input with no range gets ±50% and a flag: "range assumed".
- Customer counts are expectations. The UI shows "about 6", not "6".
- For a plan to say *profitable*, `cac.full ≤ cac.allowable_n` must hold for the owner's payback horizon. Otherwise the plan says *needs proof*, *test first* or *no*.
- Plays overlap. The portfolio total uses a stated overlap assumption (default 20%, shown to the owner), never a plain sum.

## 6. Prompting (spec §21)

- One system prompt per stage. Evidence goes in as `<evidence id="ev_3">…</evidence>` blocks; the task says "cite evidence ids; refer to calc ids for every number".
- Lint checks that each number in the text equals a `calc` or `MetricInput` value, or appears in the evidence. **The evidence scope includes every block in the prompt** (this fixes D1).
- Nothing is cut silently. If the context goes over budget, the system drops the lowest-ranked evidence, records what was dropped and logs it.
- Unknowns: owner-only numbers are nullable in the schema (fixes D4). The model lists up to 3 decision-changing questions (owner's choice: ask after a provisional plan).

## 7. Safety and tenancy (spec §08, §23)

- Retrieval is scoped by `tenantId` in every query. Pooled data only as aggregate rates with k≥5 (`learnedRates`).
- Engine Lab stays paused until critic fixes are redacted (no names, URLs or numbers) and each rule is backed by ≥5 tenants.
- Publishing, sending and ad spend each need a separate approval bound to the exact content, account, budget and expiry. Planning approval never authorizes execution.
- There is no prospect email database. Outbound plays must name the owner's lawful list source, or the plan says "build the list first".
