# Business-type operating playbooks

These six playbooks are original ClimbOS design guidance. They are not reported business results, universal benchmarks, or installed software. Use the JSON version for structured ingestion. Each example is hypothetical.

A business may use several models. Route by the mechanism being evaluated, not only by a company-level label. Split the economics and evidence for materially different offers.

## BT-01-saas — SaaS: find and repair the constraint to retained value

**Required inputs:** Target segment and buying situation; Activation event and window; Signup and paid cohorts; Collected revenue and refunds; Retention observation window; Usage costs and support effort; Existing audience permission; Owner labor and spending ceilings.

**Decision branches**

- If no observed problem or buying evidence, run customer episode research before scaling traffic.
- If qualified users arrive but cannot reach first value, observe the task and remove one verified obstacle.
- If activated customers leave before repeat value, investigate product fit and recurring usefulness before paid expansion.
- If retention, economics, and capacity support expansion, test one eligible distribution mechanism with explicit downside.

**Implementation**

1. Define eligibility and exclude irrelevant signups from the decision population.
2. Reconcile acquisition, activation, payments, cancellations, and refunds at account grain.
3. Interview or observe recent eligible users around the last incomplete task; preserve dissenting cases.
4. Select an intervention that changes one plausible cause, not every funnel stage at once.
5. Estimate cohort contribution and support burden; reserve the experiment budget.
6. Launch only after concrete approval, track first value and downstream paid quality, and review after outcomes mature.

**Measurement contracts**

- `activation_rate`: eligible accounts reaching first value within window / eligible new accounts.
- `observed_cohort_contribution`: cohort net revenue over fixed horizon - included cohort service costs.
- `support_minutes_per_activated_account`: eligible support minutes / activated eligible accounts.

**Stop or revise when:** Broken account identity or payment reconciliation; Change makes task completion worse beyond declared guardrail; Budget or support capacity exhausted; Observation window incomplete: return pending, not a success claim.

**Application:** Hypothetical: a team has qualified trials but no activation instrumentation. ClimbOS first specifies the event and observes setup. It does not invent a trial-to-paid projection or prescribe a broadcast to an audience that has not opted in.

## BT-02-macapps — Mac apps: prove utility and match the distribution path

**Required inputs:** Supported macOS versions and hardware; App Store versus direct distribution; Useful task and time to first success; Install and launch denominators; Crash or failure observations; License model and maintenance obligations; Refunds and support cost; Available analytics and consent.

**Decision branches**

- If install or first task fails, fix reliability and compatibility before increasing discovery.
- If traffic reaches listing but promise is misunderstood, test asset comprehension with suitable users.
- If native store experiment is not eligible for the actual platform, choose a supported external test or qualitative method; label confounding.
- If stable task success and sustainable economics, test one relevant community, search, partner, or editorial route.

**Implementation**

1. Confirm actual supported platform, build, pricing, and capabilities before drafting claims.
2. Map the complete path from discovery to download, launch, first successful task, and retained use.
3. Review support and crash evidence by build and machine type where permission allows.
4. Prepare a benefit-led asset sequence using real product captures and accurate limitations.
5. Select only platform-supported experiment methods; preserve concurrent version changes.
6. Evaluate useful adoption, refunds, reliability, and support alongside installation counts.

**Measurement contracts**

- `first_task_success`: eligible installs completing the useful task / eligible measured installs.
- `net_license_contribution`: net license revenue - defined payment, distribution, serving, and support costs.
- `refund_rate`: refunded purchases / purchases in the same matured purchase cohort.

**Stop or revise when:** Unsupported store feature assumed available; Material crash or compatibility issue unresolved; Claim cannot be demonstrated in the current build; New build changes test assets or task behavior without recording contamination.

**Application:** Hypothetical: a clipboard utility gains downloads but users cannot understand its permissions. The next intervention clarifies the permission-dependent task and tests task completion. It does not assume iOS product-page optimization is available to a Mac App Store product.

## BT-03-agencies — Agencies: improve qualified demand without overselling delivery

**Required inputs:** Offer scope and exclusions; Qualified buyer definition; Recent won/lost/deferred opportunities; Delivery hours and available start slots; Proposal and sales effort; Payment schedule and collection history; Gross and contribution cost boundaries; Proof-use permissions.

**Decision branches**

- If delivery slots are full, prioritize fit, pricing, scheduling, or qualified referrals over lead volume.
- If calls occur but buyers do not progress, diagnose qualification, proof, offer, and buying-process uncertainty.
- If few relevant opportunities exist, test one narrow offer and reachable segment.
- If projects sell but cash or margins are weak, review scope, change control, deposits, and collection before expansion.

**Implementation**

1. Define a repeatable service outcome and the client obligations needed to deliver it.
2. Map lead-to-cash using buyer-observable progress rather than seller optimism.
3. Reconstruct a recent win and a recent loss; separate unsupported explanations.
4. Create one proof asset with verified role, scope, result, and permission.
5. Estimate delivery load and proposal effort under downside win-rate scenarios.
6. Approve a bounded prospecting or inbound experiment with a capacity-aware booking limit.

**Measurement contracts**

- `project_contribution`: net project revenue - defined incremental delivery and service costs.
- `delivery_load`: committed delivery hours / available delivery hours over the same period.
- `qualified_opportunity_progression`: eligible opportunities reaching buyer-verified next stage / eligible opportunities.

**Stop or revise when:** Committed delivery exceeds approved capacity; Project scope or commercial terms unclear; Evidence asset contains unverified customer results; Contact source or sending provider is ineligible.

**Application:** Hypothetical: a design studio can start two projects next month but its campaign predicts six. ClimbOS limits bookings, offers later start dates transparently, or recommends capacity changes. It does not call six simultaneous wins an unconditional success.

## BT-04-ecommerce — Ecommerce: optimize fulfilled contribution, not attributed order value

**Required inputs:** SKU-level net prices and costs; Inventory and replenishment timing; Fulfillment and shipping cost; Returns and refunds by cohort; Promotion calendar; Payment fees; Repeat purchase behavior; Media attribution and store revenue definitions.

**Decision branches**

- If inventory or fulfillment cannot support demand, repair availability, lead times, or a truthful waitlist before promotion.
- If high conversion is offset by returns or discounts, investigate product fit and net contribution.
- If qualified visitors abandon the purchase task, diagnose total price, delivery, trust, payment, and device-specific failure.
- If economics survive downside and stock is ready, test a bounded offer or acquisition route.

**Implementation**

1. Reconcile SKU availability, net revenue, discounts, tax treatment, refunds, and fulfillment.
2. Trace a representative order from discovery to delivery and return.
3. Choose a specific obstacle and ensure the test can be fulfilled honestly.
4. Model order contribution before and after acquisition, then model cash tied in stock.
5. Set guardrails for refunds, complaints, delivery delays, and stock-outs.
6. Review matured outcomes before treating gross sales or platform ROAS as business profit.

**Measurement contracts**

- `order_contribution_before_acquisition`: net order revenue - product, payment, packaging, fulfillment, and expected return costs included in policy.
- `incremental_contribution`: estimated incremental contribution from treatment - incremental campaign cost.
- `on_time_fulfillment`: eligible orders fulfilled within promised window / eligible fulfilled orders.

**Stop or revise when:** Stock mismatch or misleading delivery promise; Negative expected contribution outside approved learning loss; Checkout tracking cannot reconcile to orders; Return window has not matured: distinguish provisional from final.

**Application:** Hypothetical: a store increases sales with a large discount while shipping and returns erase the margin. ClimbOS flags net contribution and tests value communication or bundle economics before repeating the promotion.

## BT-05-localservices — Local services: turn suitable inquiries into completed appointments

**Required inputs:** Service area and travel constraints; Service types and qualifications; Booking capacity and hours; Inquiry source and response records; Cancellation and no-show rules; Completed appointments and collected revenue; Local proof and review permissions; Current listings and contact information.

**Decision branches**

- If bookings are unavailable in target area or time, fix schedule or targeting before buying more inquiries.
- If inquiries arrive but response is late, repair ownership and response workflow.
- If bookings do not become completed services, investigate fit, scheduling, reminders, deposits, and attendance barriers.
- If reliable completion and economics exist, test eligible local search, partnerships, or referrals.

**Implementation**

1. Verify services, geographic eligibility, contact details, and actual available slots.
2. Map inquiry, response, qualification, booking, attendance, completion, and payment.
3. Review a small set of lost inquiries with permission; distinguish no answer from poor fit.
4. Improve one friction point and create a human escalation path.
5. Prepare truthful service and locality assets without inventing locations or reviews.
6. Measure completed profitable appointments, response effort, and customer complaints.

**Measurement contracts**

- `inquiry_to_completion`: eligible inquiries resulting in completed service within window / eligible inquiries.
- `response_time`: first useful response timestamp - eligible inquiry timestamp.
- `contribution_per_slot`: net collected revenue minus included service costs / occupied eligible slots.

**Stop or revise when:** Service-area mismatch; No capacity within promised window; Regulated claim lacks appropriate evidence or review; Automated response cannot handle urgent or sensitive inquiry: escalate.

**Application:** Hypothetical: a repair service receives many inquiries outside its travel area. ClimbOS fixes qualification and targeting rather than interpreting every rejected inquiry as a sales failure.

## BT-06-marketplaces — Marketplaces: diagnose liquidity at the market-cell level

**Required inputs:** Participant roles and transaction definition; Market cell: geography, category, time, or use case; Available supply and active demand; Search-to-match and transaction events; Quality, cancellation, dispute, and trust signals; Take rate and subsidies; Acquisition by side; Interference and measurement constraints.

**Decision branches**

- If demand cannot find suitable available supply, improve supply coverage or narrow the market cell before demand expansion.
- If supply is idle despite qualified demand, investigate discovery, trust, pricing, and matching rules.
- If transactions occur only with unsustainable subsidies, model unsubsidized behavior and contribution.
- If cross-side effects contaminate individual tests, choose a suitable cluster, geography, or other defensible design.

**Implementation**

1. Define the smallest useful market cell and map both sides of the transaction.
2. Measure availability and match failure reasons without averaging incompatible cells.
3. Check participant quality and the operational burden of disputes or cancellation.
4. Choose a targeted intervention on the constrained side and model the effect on the other side.
5. Select measurement that addresses interference and participant spillovers.
6. Evaluate completed quality transactions, repeat use, net contribution, and trust guardrails before expansion.

**Measurement contracts**

- `qualified_match_rate`: eligible demand requests receiving a suitable available match / eligible demand requests.
- `transaction_contribution`: net platform revenue - defined processing, servicing, subsidy, and risk costs.
- `cell_liquidity`: report match rate and time to match by defined cell; do not substitute one universal score.

**Stop or revise when:** Supply quality or safety guardrail breached; Subsidy exceeds authorized loss budget; Individual randomization invalidated by substantial spillovers; Reported growth is only migration from another market cell.

**Application:** Hypothetical: a services marketplace has strong citywide signups but poor evening availability in one neighborhood. ClimbOS narrows the cell and investigates supply coverage rather than recommending citywide demand ads.

## ClimbOS implementation

Persist the selected business mechanism, eligibility evidence, metric version, cost boundary, and capacity assumptions in the run snapshot. Reuse the existing OpenAI-first reasoning engine; route only relevant knowledge to it. Convex records can hold the proposed decision state, Vercel can expose the owner review, and Resend can serve eligible opted-in email workflows. These are integration proposals, not claims about repository behavior.

Use deterministic arithmetic for the formulas above and trusted server-side authorization for actions. Unknown data should remain null with a reason. An owner can approve a bounded learning loss, but a high opportunity score must not override an explicit spending ceiling, unavailable delivery capacity, or provider prohibition.
