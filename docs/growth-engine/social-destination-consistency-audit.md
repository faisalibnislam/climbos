# Social destination consistency from plan to draft

17 November 2026. Follow-up to requirements 41–44 and the owner's platform-specific social-content requirements. This audit concerns routing and structured output, not a claim about current platform APIs, publishing eligibility or commercial content quality.

## Confirmed path and gaps

Detailed plan approval calls `cards.startPlanWork`. Social cards previously had no destination even when the saved channel name selected LinkedIn, Instagram/Facebook or YouTube. `startCardRun` reserved and scheduled `jobs.createContent` with an empty channel, which defaulted to Instagram/Facebook/LinkedIn. Three actual Convex routing tests first failed because the selected destination was absent from run input.

Separately, `createContent` could rewrite every returned post's channel to a single requested platform after generation. That could disguise wrong-platform output instead of requiring a corrected draft. The existing social linter checked unexpected channels, but the output schema permitted all platforms and the later coercion remained.

## Implemented behavior

- The existing named-platform rules are shared in `shared/growth/socialChannels.ts`. Explicit platform selections in the social plan label reach the draft card, usage quote, reserved run, scheduled action, research brief, writer/reviewer contract and demo fixture.
- Multiple named platforms are retained as a set; none is silently added. Old unstarted plan cards resolve against their current approved plan's channel label before reservation. This remains preparation only.
- Ambiguous alternatives, negations, unnamed platforms and community/group/forum labels do not select a connected social-post job. The existing waiting result asks for a clear destination. Community participation is not routed into a Facebook Page job.
- Social output schemas restrict channel values to the requested set. Final result checking rejects unsupported or conflicting requests and wrong-platform posts before image work or artifact persistence. Wrong-platform copy is never relabeled to conceal the mismatch.
- Onboarding first-win preparation follows explicitly named, non-parked social channels and prepares email only when the plan selected email lifecycle work. It no longer invents a social destination from business type, treats an ad/community row as an organic publishing destination, or adds email regardless of plan selection. Three initial social posts are distributed over at most three named destinations; this is a bounded starter batch, not full delivery for every possible channel.
- Unknown or ambiguous plan destinations produce no first-win social job. Focused plans retain their already-prepared work path. Existing publication, tenant, version, budget and permission controls are unchanged.

No new provider, external integration, database schema or Next.js UI component. The optional multi-platform request travels through existing job JSON and internal action arguments. Engine `v3.123-social-destinations`. The Node runtime directive remains at the top of `convex/jobs.ts`.

## Verification and limitations

Actual plan-card → reservation → job → artifact tests cover LinkedIn, Instagram/Facebook and YouTube, and assert drafts stay within the selected platforms without action receipts. Ambiguous/unknown/community cases start neither a plan social job nor an onboarding first-win job. A deliberately wrong-platform fixture result fails the job, exposes the existing owner-facing message and saves no artifacts. Existing first-win reuse, social intelligence/visuals, engine, Autopilot, publishing, tenant and approval tests pass. Exact commands/results are in Verification.

No live account, browser, paid-model evaluation, publishing, send or deployment was performed. Name recognition is bounded and does not semantically interpret every unusual label; an explicit canonical destination in the plan contract remains a possible future improvement alongside platform-fit evidence. A generic direct content request still retains its existing default platform set; the change prevents a named plan selection from being dropped. Source/audience relevance, cultural adaptation and useful creative quality remain separately unproven. Supported draft destinations do not establish configured publishing capability. Ads, email audience binding and other plan-to-execution mappings still need their own audit; this is not completion of rows 41–44 or the full product specification.
