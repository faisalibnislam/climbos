# Lead generation and cold email: technical and practitioner research

Status: research, 17 Oct 2026. Scope: the ClimbOS shared B2B contact database and enrichment engine, Hunter.io platform integration, the cold email system (customer-connected mailboxes and ClimbOS-provisioned look-alike domains), warm-up, and the AI prospecting and copy agents.

Sources are cited inline. Where a figure comes only from vendor blogs (most cold-email "best practice" numbers do), it is labelled as practitioner consensus rather than fact. Nothing here is legal advice. Sections 7 and 11 should go to counsel before launch.

---

## 0. Findings that block or constrain the design

1. **Resend cannot carry cold email.** Its acceptable use policy bans unsolicited messages and names cold outreach, purchased lists and scraped contact data ([Resend AUP](https://resend.com/legal/acceptable-use)). Resend stays limited to platform, transactional and opted-in lead-magnet mail. All cold mail has to leave through the sender's own mailbox (customer-connected or ClimbOS-provisioned).
2. **Gmail OAuth for reply detection triggers a paid security assessment.** `gmail.send` is a *sensitive* scope. Reading replies needs `gmail.readonly`, `gmail.metadata` or `gmail.modify`, and IMAP/SMTP over XOAUTH2 needs `https://mail.google.com/`. All of those are *restricted* scopes ([Google scope list](https://developers.google.com/workspace/gmail/api/auth/scopes)). Storing or transmitting restricted-scope data from a server requires a yearly CASA Tier 2 assessment. Reported costs run from about $540/yr through self-serve labs to five figures on the legacy track, with 2–8 weeks per cycle ([Unipile](https://www.unipile.com/integrating-google-oauth-2-0-user-authentication-into-your-app/), [DeepStrike](https://deepstrike.io/blog/google-casa-security-assessment-2025)). Google legacy-password IMAP/SMTP ended 14 Mar 2025, and only app passwords remain ([Google](https://knowledge.workspace.google.com/admin/sync/transition-from-less-secure-apps-to-oauth)).
3. **Microsoft 365 SMTP AUTH Basic auth is still allowed but has an end date.** Microsoft revised MC786329 on 27 Jan 2026. Behaviour stays the same until **end of December 2026**, when Basic auth becomes disabled by default for existing tenants (admins can re-enable it). New tenants created after that will not have it. A final removal date is due to be announced in H2 2027 ([MC786329 summary](https://www.itelio.com/en/microsoft-message-center/MC786329), [CaptainDNS](https://www.captaindns.com/en/blog/microsoft-exchange-basic-auth-smtp-end)). Any "SMTP/IMAP with a password" path for M365 has about two months of default availability left. Build OAuth or Graph for Microsoft first.
4. **Serverless cannot hold IMAP IDLE or run SMTP verification probes.** Convex Node actions run on AWS Lambda, which blocks outbound port 25 by default ([AWS re:Post](https://repost.aws/questions/QUMZxZLzl5TjW7b9DjSYl2mw/aws-outbound-port-25-restriction)), and they are capped at 10 minutes ([Convex limits](https://docs.convex.dev/production/state/limits)). Vercel functions block port 25 and allow 465/587 ([Vercel](https://vercel.com/support/articles/serverless-functions-and-smtp)). Submission on 587/465 from an action works. Long-lived IMAP and RCPT TO probing need a small always-on worker, and the prober must sit on a separate VPS with port 25 open.
5. **Fake-engagement warm-up networks breach provider terms.** The Google Workspace AUP prohibits using the service "to evade filtering capabilities" and to facilitate unsolicited mass email ([AUP](https://workspace.google.com/terms/use_policy.html)). Google made GMass shut down its warm-up network on 31 Jan 2023 or lose Gmail API access ([GMass](https://www.gmass.co/blog/warmup-shutting-down/)). Section 2 recommends a ramp-plus-seed-testing design, not a peer engagement network.
6. **A shared B2B database sold to customers probably makes ClimbOS a data broker in California.** The CCPA's B2B exemption expired on 1 Jan 2023. California's 2026 registration fee is $6,000 (a rise to $9,500 was voted in Aug 2026), and since **1 Aug 2026** brokers must pull DROP deletion requests at least every 45 days ([CalPrivacy](https://privacy.ca.gov/drop-for-data-brokers/account-creation-fees-and-annual-registration/), [Mondaq](https://webiis08.mondaq.com/unitedstates/data-protection/1833708/california-data-broker-updates)). Vermont, Texas and Oregon registries may also apply. Under GDPR, ClimbOS is the controller of the shared database and carries Article 14 notice and Article 21 objection duties. The CNIL fined KASPR €240,000 for a contact database built partly from LinkedIn ([CNIL](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000)).
7. **Hunter credits are cheap at the plan level, but redistribution is a contract question.** Starter is $49/mo for 2,000 credits, Growth $149/mo for 10,000 and Scale $299/mo for 25,000. Finder and Domain Search cost 1 credit per email found, and verification costs 0.5 ([Hunter pricing](https://hunter.io/pricing)). Persisting Hunter results in a database shared across ClimbOS customers is resale-like use. Hunter sells an API-only "Data Platform" product (example: $6,500 for 1,000 search credits plus 200,000 verifications). Confirm licence terms in writing before storing Hunter data in the shared database.

---

## 1. Deliverability rules, 2024–2026

### 1.1 Gmail

**All senders** (since 1 Feb 2024) ([Google sender guidelines](https://support.google.com/a/answer/81126)):
- SPF *or* DKIM on the sending domain.
- Valid forward and reverse DNS (PTR) for sending IPs. This is handled for you when sending through Workspace or M365.
- TLS for transmission.
- RFC 5322-compliant messages: exactly one From, single-instance Subject/Date/To headers, and a valid Message-ID.
- Spam rate in Postmaster Tools below 0.3%.
- Never impersonate gmail.com in From. Gmail now applies DMARC quarantine to its own domain.
- DKIM keys of at least 1024 bits. Google recommends 2048.

**Bulk senders** (about 5,000+ messages to personal Gmail accounts in 24 h):
- SPF **and** DKIM, plus a DMARC record (`p=none` is acceptable).
- The From domain must align with the SPF or DKIM domain.
- Marketing and subscribed mail needs one-click unsubscribe (RFC 8058) plus a visible unsubscribe link in the body, with unsubscribes honoured within **48 hours**.
- Spam rate below 0.3%. Google's own guidance is to stay under 0.1% ([Sender FAQ](https://support.google.com/a/answer/14229414)).

Key details from the FAQ ([14229414](https://support.google.com/a/answer/14229414)):
- **Bulk status is permanent.** Crossing the threshold once makes a domain a bulk sender for good.
- **Counting is per primary domain.** Subdomains roll up, so `mail.example.com` plus `example.com` count together. A *separate registrable domain* such as `getclimbos.com` is counted separately. This is the mechanical reason the cold-email industry uses look-alike domains (see Policy risks).
- **Spam rate** is computed daily. Above 0.3%, a sender loses eligibility for mitigation help until it has been under 0.3% for 7 consecutive days.
- **Enforcement increased in November 2025.** Starting then, non-compliant traffic gets temporary and permanent rejections. Typical codes are `421 4.7.26`/`550 5.7.26` for unauthenticated mail ([Palisade](https://www.palisade.email/learning/smtp-error-codes/550-5-7-26)).
- **One-click unsubscribe scope.** The FAQ scopes it to "marketing and promotional" mail and excludes transactional mail. It does not explicitly address 1:1 cold email. Recipients, not Google, decide what counts as promotional.

### 1.2 Yahoo / AOL

Yahoo's requirements mirror Gmail's ([Yahoo Sender Hub](https://senders.yahooinc.com/best-practices/)):
- All senders need SPF or DKIM.
- Bulk senders need SPF + DKIM + DMARC (`p=none` minimum, relaxed alignment acceptable, `rua` recommended).
- One-click List-Unsubscribe is required. RFC 8058 POST is "highly recommended" and mailto is acceptable. A body unsubscribe link is also needed, and unsubscribes must be honoured within **2 days**.
- Spam rate must stay under 0.3%, measured against inboxed mail only.
- Enrol each DKIM domain in Yahoo's Complaint Feedback Loop (CFL). It is the only major mailbox provider that sends you per-message complaints, so ClimbOS should automate enrolment for each provisioned domain.

### 1.3 Microsoft Outlook.com (consumer)

- **Rules from 5 May 2025.** Domains sending more than 5,000 messages/day to Outlook.com, Hotmail and Live addresses must pass SPF and DKIM and publish DMARC (at least `p=none`) aligned with SPF or DKIM.
- **Enforcement.** Non-compliant mail first goes to Junk. If problems persist it is rejected with `550 5.7.515 Access denied, sending domain ... does not meet the required authentication level` ([Outlook postmaster policy](https://substrate.office.com/ip-domain-management-snds/Postmaster/Policies), [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730), [Microsoft support](https://support.microsoft.com/en-us/outlook/fix-ndr-error-550-5-7-515-in-outlook-com)).
- **Also recommended:** a working unsubscribe, list hygiene, and a reply-able From address.
- **Scope.** This covers consumer mailboxes only. Corporate Microsoft 365 recipients are filtered by Exchange Online Protection or the tenant's own gateway. These are often stricter and opaque to senders, and many sit behind Proofpoint or Mimecast.

### 1.4 SPF, DKIM, DMARC alignment: practical rules

- **SPF.** One TXT record per name, at most **10 DNS lookups**, ending `~all` (or `-all` once stable). For Workspace use `v=spf1 include:_spf.google.com ~all`. For M365 use `include:spf.protection.outlook.com`. SPF authenticates the envelope (Return-Path) domain. When you send through Workspace or M365 as `jane@getclimbos.com`, the envelope domain *is* the From domain, so SPF aligns.
- **DKIM.** Use 2048-bit keys and sign with `d=` equal to the From domain. Never use the provider's default `d=*.onmicrosoft.com` or `d=gappssmtp.com`, because those do not align. Rotate keys yearly.
- **DMARC.** Start with `v=DMARC1; p=none; rua=mailto:dmarc@<reporting-domain>; fo=1`. Move to `p=quarantine` after 2–4 weeks of clean aggregate reports. ClimbOS should parse `rua` reports (gzip XML, RFC 7489) to spot spoofing and misconfiguration. Relaxed alignment (`adkim=r; aspf=r`) is fine.
- **Others.** MTA-STS, TLS-RPT and BIMI are optional for cold-sending domains. BIMI requires `p=quarantine`/`reject` plus a VMC/CMC certificate and adds nothing to cold outreach.

### 1.5 One-click unsubscribe (RFC 8058)

From [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html) and its errata:
- `List-Unsubscribe: <https://u.getclimbos.com/u/{opaque-token}>` must contain one HTTPS URI. Adding a `mailto:` alongside is allowed.
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click` must be present.
- A valid DKIM signature must cover **both** headers.
- The endpoint must accept a POST with no cookies or authorisation, must not redirect, and must carry all state in the URI token. A GET on the same URL should render a confirmation page, and that GET must **not** unsubscribe on its own, because security scanners prefetch links.

**ClimbOS default:** add RFC 8058 headers to every cold campaign message, not only bulk mail. Gmail and Yahoo show a native "Unsubscribe" control, and a click on that costs you far less than a "Report spam" click. Also put a short plain-text opt-out line in the body, e.g. "Not relevant? Reply 'no' and I won't follow up." CAN-SPAM, CASL and the Spam Act need a functional opt-out anyway (section 7). Process unsubscribes immediately, well inside the 48-hour Gmail/Yahoo window and CAN-SPAM's 10 business days.

### 1.6 Complaint thresholds and what you can actually measure

- **Gmail:** keep under 0.1%, never reach 0.3%. **Yahoo:** under 0.3%. **Microsoft:** no published number. SNDS is IP-based and of little use when you send via M365 or Workspace.
- **Cold email rarely shows up in Postmaster Tools.** Gmail suppresses metrics on low-volume days. Practitioners cite about 200+ daily Gmail recipients as the floor for stable data ([Prospeo](https://prospeo.io/s/google-postmaster-tools)), and a provisioned domain sending 60–150/day will often show nothing.
- **Proxy signals ClimbOS must compute itself:**
  - hard-bounce rate
  - unsubscribe rate
  - negative-reply rate (LLM-classified "stop", "remove", abuse)
  - Yahoo CFL complaints
  - seed-test inbox placement
  - provider rejections (`5.7.x`)

### 1.7 Google Postmaster Tools v2

- **Version status.** v2 launched in 2024. The legacy interface's deprecation has been postponed, but v1 and its API will be retired ([Google](https://support.google.com/mail/answer/16594218?hl=en)).
- **What v2 shows.** The domain/IP reputation charts are gone. A **Compliance status** dashboard shows pass/needs-work for SPF, DKIM, DMARC, From alignment, one-click unsubscribe, honouring unsubscribes and spam rate. A spam-rate chart shows the 0.1% and 0.3% lines ([Blueshift](https://blueshift.com/blog/google-postmaster-tools-v2/), [Customer.io](https://docs.customer.io/messaging/channels/email/deliverability/google-postmaster-tools/)).
- **API.** The v2 API exposes compliance status and domain management, and integrations must migrate to it ([Google](https://support.google.com/mail/answer/16594218?hl=en)).
- **ClimbOS default:** verify every provisioned sending domain in Postmaster Tools under a ClimbOS-owned Google account through DNS TXT, then pull compliance status daily through the v2 API. Treat it as a compliance check, not as a reputation signal for low-volume cold domains.

### 1.8 Per-mailbox volumes and sending windows

Provider hard limits:
- **Google Workspace:** 2,000 messages/day per user, 500 on trial accounts; 2,000 unique external recipients/day; 10,000 total recipients/day ([Google](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace)).
- **Exchange Online:** 10,000 recipients per rolling 24 h and 30 messages/minute per mailbox. These cannot be raised ([Microsoft Learn](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-sending-limits-troubleshoot)). Microsoft cancelled the planned 2,000/day external recipient rate limit (MC787382, updated Jan 2026) ([mc.merill.net](https://mc.merill.net/message/MC787382/compare/2026-01-06T19-29-12-95Z/2024-11-15T19-06-19-33Z)). There is also a tenant-level outbound threshold that scales with licence count.

These hard limits are far above safe cold volumes. Practitioner consensus (Instantly, Smartlead, Hunter and Woodpecker guidance) is **30–50 new cold emails per mailbox per day**, including follow-ups. Vendors also report that brand-new Workspace tenants sending 50+/day in month one account for most suspensions ([LiteMail, vendor data](https://litemail.ai/blog/google-workspace-cold-email-suspended-account-prevention-2026)).

**ClimbOS defaults**

| Setting | Default | Hard cap |
|---|---|---|
| New cold sends + follow-ups per provisioned mailbox per day (after ramp) | 30 | 50 (only for mailboxes over 90 days old with clean metrics) |
| Customer's primary-domain mailbox (connected) | 20/day cold | 40/day |
| Mailboxes per sending domain | 2–3 | 4 |
| Cold sends per sending domain per day | ≤100 | 150 |
| Minimum gap between sends from one mailbox | random 3–9 min | ≥90 s |
| Sending window | 08:00–17:00 recipient local time, Mon–Fri | Never on weekends or local public holidays by default |
| Same-recipient-domain sends per mailbox per day | 2 | 5 across all mailboxes of a customer |

Notes:
- **Time zone.** Derive recipient time zone from company location. Fall back to the customer's time zone.
- **Jitter and day choice.** Add jitter so sends are not on the minute. Tuesday–Thursday mornings tend to do best, but the effect is small. Spreading volume evenly matters more than timing.
- **Recipient domains.** Throttle per recipient domain: never more than 2–3 messages to one company per day from the same customer, and stagger contacts at the same company by days.

### 1.9 Domain and mailbox ratios

- **Keep cold mail off the primary domain.** Never send cold volume from the customer's primary domain once they go past about 20–30/day. Protect the domain they use for invoices and customer mail.
- **Unit economics.** One domain hosts 2–3 mailboxes × 30/day = 60–90/day. A customer wanting 300 new contacts/week (about 60/day with follow-ups ×2.5 → about 150 sends/day) needs about 2 domains × 3 mailboxes.
- **Spares.** Keep about 20% spare capacity (a warmed "bench" domain) so a burned domain can be rotated out without stopping campaigns.

### 1.10 Look-alike domain best practices

- **Naming.** Use names that are obviously the same brand: `getclimbos.com`, `tryclimbos.com`, `climbos-hq.com`, `climbos.co`, `meetclimbos.com`. Prefer `.com`, then `.co`/`.io`, then a country TLD that matches the market. Avoid cheap abuse-heavy TLDs (`.xyz`, `.top`, `.click`, `.shop` and similar), multiple hyphens and digit substitutions.
- **Never look-alike another brand.** Only ever create variants of the *customer's own* brand. Look-alikes of third parties are impersonation (Policy risks, and the Artifact/phishing rules of every provider).
- **Make the domain behave like a business domain.** 301-redirect the root and `www` to the customer's real site. Publish a real `postmaster@`/`abuse@` route and full SPF/DKIM/DMARC.
- **Age before use.** Wait at least 14 days from registration before the first cold send. Domains registered days earlier are a strong spam signal. Many filters treat domains under about 30 days old as suspicious.
- **Avoid clustering.** Don't register 20 domains the same minute from one account with identical WHOIS and DNS footprints. A practitioner reported 20 of 80 inboxes suspended on one day, all from one batch purchase ([PuzzleInbox](https://puzzleinbox.com/community/my-inboxes-got-suspended-in-bulk-here-is-the-investigation)). Spread purchases and give each customer its own tenant.
- **Use real senders.** Mailbox display names should be real people who work at, or represent, the customer (often the founder or a named SDR). A fabricated persona is deceptive, risky under CAN-SPAM's "misleading header" rule, and against Workspace and M365 terms.

### 1.11 Custom tracking domains

If click tracking is enabled, links are rewritten to `https://link.<sending-domain>/...` through a CNAME to ClimbOS's tracking host with TLS. **Never** use a shared ClimbOS tracking domain across customers. One customer's abuse would poison every customer's links, and shared redirect domains end up on URI blocklists (Spamhaus DBL, SURBL). One tracking subdomain per sending domain, owned by that domain.

### 1.12 Open tracking and link tracking

- **Opens are unreliable.** Apple Mail Privacy Protection pre-fetches images, so tracking pixels fire for Apple Mail users whether or not the message was read ([Postmark](https://postmarkapp.com/blog/how-apples-mail-privacy-changes-affect-email-open-tracking)). Gmail's image proxy caches images. Corporate gateways (Proofpoint, Mimecast, Microsoft Safe Links) fetch pixels and links to scan them. Open rates can't be used for A/B testing or for "opened but didn't reply" triggers.
- **Costs of an open pixel.** It forces an HTML part, adds a remote image (a classic filter feature in 1:1 mail from a new domain), and adds a third-party host. It also raises consent questions under ePrivacy in the EU/UK, because a tracking pixel is "accessing information on terminal equipment".
- **Link tracking.** Rewritten URLs where the visible text doesn't match the destination look like phishing. Scanner clicks inflate the numbers. Any link in a first-touch email increases filtering risk.

**ClimbOS defaults:**
- Opens are **off** and the setting is hidden behind "advanced", with a warning.
- Click tracking is **off**.
- Messages are plain text, multipart only if the customer adds formatting.
- No links and no images in step 1. In later steps, one plain link to the customer's own domain is allowed.
- Success is measured by **replies, positive replies and meetings**, all of which ClimbOS sees through IMAP or the API.

---

## 2. Warm-up

### 2.1 How warm-up networks work

Commercial warm-up products (Instantly, Smartlead, Lemwarm, Warmy, MailReach and others) enrol every customer mailbox into a shared pool. A scheduler then:
1. sends low-volume messages between pool members (often AI-generated small talk with a hidden tag or code in the subject or body so the pool can recognise them);
2. logs into the recipient mailbox over IMAP or API, finds the tagged message, and **moves it from Spam to Inbox**, marks it important, opens it, stars it and **replies**;
3. ramps from 2–5/day up to 20–40/day, keeps going alongside campaigns, and reports a "warm-up inbox rate" measured *inside the pool*.

The theory is that mailbox providers learn sender reputation partly from engagement (replies, rescues from spam), so manufactured engagement builds a positive history.

### 2.2 Evidence on effectiveness

- **No independent, methodologically published study shows lasting benefit.** A widely cited independent test (Postbox Services, 2025) reported no meaningful deliverability improvement across major warm-up tools ([Postbox](https://medium.postboxservices.com/do-email-warmup-tools-work-in-2025-1acb8e7a03e6)). Its methodology is not fully public. Vendor-published figures (for example, "73% vs 52% inbox placement" for continuing warm-up) come from warm-up sellers ([Prospeo summary](https://prospeo.io/s/automated-email-warmup)).
- **The engagement is detectable.** It comes from cloud IPs, at regular cadence, over IMAP sessions without a human client, between a closed graph of mailboxes, with tagged content. Providers can discount it or treat it as a negative signal.
- **Pool placement measures the wrong thing.** Placement is measured on the pool's own mailboxes, which are not representative of real corporate recipients (EOP, Proofpoint, Mimecast).
- **What reliably works is a slow ramp of real, wanted mail.** This means low volumes, verified addresses, relevant messages that earn real replies, and no bounces. Reputation is earned from real recipients.

### 2.3 Provider terms and policy risk

- **Google.**
  - The Workspace AUP forbids using the service to "evade filtering capabilities" or to facilitate unsolicited mass email ([AUP](https://workspace.google.com/terms/use_policy.html)). Automating "move out of spam" to train the filter is filter evasion on any fair reading.
  - Google's API data policy limits Gmail data use to user-facing features ([Google developer blog](https://developers.googleblog.com/2018/10/elevating-user-trust-in-our-api.html)).
  - GMass had sent more than 1.29 billion warm-up emails. Google told it to shut the network or lose Gmail API access, and GMass shut it down on 31 Jan 2023 ([GMass](https://www.gmass.co/blog/warmup-shutting-down/)). Other vendors (for example Growbots) then disabled Gmail warm-up ([Growbots](https://help.growbots.com/en/articles/7907489-we-re-disabling-warm-up-for-gmail-what-now)).
  - **Implication for ClimbOS:** a warm-up network that touches a customer's Gmail through Google OAuth could cost ClimbOS its Google OAuth app verification, which every Google-connected customer depends on.
- **Microsoft.** The Microsoft Services Agreement Code of Conduct and the Exchange Online service description prohibit spam and manipulating the service. Microsoft also says Exchange Online is not meant for bulk commercial mail ([Retarus summary of Microsoft guidance](https://www.retarus.com/blog/us/?p=9648)). Pool engagement on M365 tenants is the same category of risk.
- **Cross-customer contamination.** A shared pool links every customer's reputation to every other's. When one customer's domain is burned for spam, its pool partners have been "replying" to a spammer.

### 2.4 Recommended in-house design: "ramp, real traffic, seed tests"

This design builds no engagement network. It aims for the same outcome (stable inbox placement for new domains) through defensible means.

**A. Infrastructure readiness gate** (automated, blocks sending):
- domain at least 14 days old
- SPF, DKIM (2048-bit, aligned) and DMARC valid
- MX working
- root redirect live
- Postmaster Tools verified
- Yahoo CFL enrolled
- not listed on Spamhaus DBL/ZEN or SURBL
- mailbox has a real display name, photo and signature

**B. Ramp schedule for real campaign volume** (per mailbox; scheduler enforced):

| Day | Max new cold sends/day | Conditions to advance |
|---|---|---|
| 1–3 | 5 | 0 hard bounces |
| 4–7 | 10 | bounce <2%, no 5.7.x rejections |
| 8–14 | 15–20 | bounce <2%, seed inbox ≥80% |
| 15–21 | 25 | as above, unsubscribe <1% |
| 22+ | 30 (default steady state) | as above |

Rules:
- **Highest-confidence recipients first.** During ramp, send only to `valid` (not accept-all) addresses, best-fit ICP, and the strongest copy. Early replies are real positive engagement.
- **Regression.** Any red flag drops the mailbox back one stage. A 5.7.x block pauses it for 72 h.

**C. Real low-volume traffic, honestly generated.** Encourage the customer to use provisioned mailboxes for genuine correspondence: replies to prospects, calendar invites, forwarding interested replies. Optionally, auto-forward positive replies into the customer's main inbox through a real forwarding rule, not synthetic mail.

**D. Seed-list inbox placement tests:**
- **Seeds.** ClimbOS owns 20–40 seed mailboxes across Gmail consumer, Google Workspace, Outlook.com, M365 (default EOP), M365 behind a third-party gateway if available, Yahoo, iCloud, GMX/Web.de (for EU customers) and Zoho.
- **Cadence.** Once a week per sending domain, and before any new campaign, send the real campaign template (merge fields filled with seed data) to the seeds.
- **Measurement.** Record the folder (Inbox, Promotions/Other, Spam) by **reading only**. Never move messages or reply.
- **Output.** A placement score per provider. Below 70% on Gmail or Outlook automatically pauses the mailbox and flags copy or infrastructure issues.
- **Buying instead.** Commercial alternatives (GlockApps, MailReach and similar) sell seed testing as a service if building it isn't worth it.

**E. Health automation:**
- per-mailbox circuit breakers on hard-bounce rate (>2% over the last 100), 5.7.x rejections, negative-reply rate (>1% "stop/remove/abusive") and seed placement
- automatic rotation to the bench domain
- 30-day rest for a burned domain, then a fresh ramp; retire it after a second failure

**F. If parity with competitors forces a "warm-up" toggle:** limit any peer exchange to **ClimbOS-provisioned mailboxes on ClimbOS-managed tenants only**, never customer-connected Google mailboxes reached through ClimbOS's OAuth app. Use natural content, no hidden tags and no automated "not spam" moves. Disclose the risk in the UI. Even this constrained version arguably conflicts with the "evade filtering" clause, so the recommendation is **not to ship it**. Market the ramp and seed system as "Smart ramp-up" instead.

---

## 3. Email finding and verification engineering

### 3.1 Pattern inference

Common corporate patterns, roughly in order of frequency in practitioner datasets:
- `{first}.{last}`
- `{first}`
- `{f}{last}`
- `{first}{last}`
- `{first}_{last}`
- `{first}{l}`
- `{last}.{first}`
- `{f}.{last}`
- `{last}`
- `{last}{f}`

Smaller businesses (ClimbOS's core market) very often use `{first}@` plus role inboxes (`info@`, `hello@`).

Algorithm:
1. **Collect known addresses for the domain from lawful public sources:**
   - the company website (team and contact pages, imprint/Impressum pages, which are legally required in DE and AT, and PDFs)
   - press releases
   - public filings
   - the operator-loaded CSV
   - Hunter Domain Search (which returns a `pattern` field)
2. **Infer the pattern.** Normalise names (strip diacritics, handle hyphenated and compound surnames, nicknames, particles such as "van der"). Match each known address to its person to vote for a pattern. Store `pattern`, `support_count` and `last_seen`.
3. **Generate candidates** for a target person in pattern-probability order. Cap at 3 candidates per person to limit probing.
4. **Verify** (3.2). Take the first `valid`. If the domain is accept-all, take the top-pattern candidate and score it.
5. **Confidence score** (ClimbOS's own, 0–100):
   - 40 points from pattern support (number of corroborating addresses, recency)
   - 30 points from verification status (valid 30, accept-all 10, unknown 0)
   - 20 points from direct sources (address seen verbatim on the web)
   - 10 points from name-match quality
   - Emit `deliverable_class ∈ {verified, likely, risky, invalid}`.

Hunter's confidence score works on the same inputs: number and quality of sources, match with the domain's dominant pattern, and SMTP verification. Hunter does not publish weights. Hunter's own guidance treats accept-all addresses with a score of 85–90+ as usable ([Hunter help](https://help.hunter.io/en/articles/1935079-what-does-an-accept-all-email-status-mean), [Hunter blog](https://hunter.io/blog/ultimate-guide-accept-all-catch-all)).

**ClimbOS policy:**
- **Step 1 of campaigns:** send only to `verified` addresses, or to `likely` (accept-all with score ≥85).
- **`risky`:** never during ramp.
- **Accept-all share:** cap at 20% of any day's sends per mailbox.

### 3.2 SMTP verification: mechanics

1. **Syntax and normalisation.** Apply RFC 5321/5322 local-part rules and IDNA for domains. Reject quoted local parts and obvious junk.
2. **Domain checks.** Check for an MX record. If there is none, fall back to the A/AAAA record per RFC 5321 §5.1, but treat that as low confidence. A null MX (`0 .`, RFC 7505) means the domain does not accept mail.
3. **Classify the MX.** Patterns reveal the provider: Google (`*.google.com`), Microsoft (`*.mail.protection.outlook.com`), Proofpoint (`pphosted.com`), Mimecast (`mimecast.com`), Barracuda and so on. This drives the strategy and also feeds enrichment ("uses M365").
4. **Run the probe.** Connect to the MX on **port 25**:
   - send `EHLO verify.<your-domain>` (with a matching PTR record and an A record for that hostname)
   - send `STARTTLS`, then `MAIL FROM:<bounce@verify.<your-domain>>`, then `RCPT TO:<candidate>`
   - then `RCPT TO:<random-20-chars@domain>` for catch-all detection, then `RSET` and `QUIT`
   - **Never send DATA.**
5. **Interpret the responses:**
   - `250` on the candidate with `550` on the random address means **valid**.
   - `250` on both means **accept-all (catch-all)**.
   - `550`/`551`/`553`, `5.1.1` or `5.1.10` (M365 "recipient not found") means **invalid**.
   - `450`/`451`/`4.7.1`/greylisting means **retry**. Back off 5, 15, then 60 minutes from the same IP, because greylisting keys on IP and sender. After that, the result is **unknown**.
   - `421`, `554` or a connection drop usually means **blocked**: stop probing that MX, mark it unknown, and cool down for 24 h.
6. **Provider quirks:**
   - Google and M365 (Directory-Based Edge Blocking) usually give truthful RCPT answers.
   - Enterprise gateways (Proofpoint, Mimecast) are frequently accept-all or tarpit.
   - Yahoo and some consumer providers are not reliably verifiable.
   - Some servers accept at RCPT and bounce later.

### 3.3 Risks and running it safely at modest scale

- **IP reputation.** Probing looks like a dictionary attack. Spamhaus, Microsoft and Proofpoint will list or tarpit IPs that make many RCPT probes with no DATA. **Never probe from sending infrastructure.** Use dedicated verifier IPs on a separate domain, and keep it out of the IP space that sends customer mail.
- **Where to host.** Hosting with port 25 open is needed. GCP blocks outbound 25 entirely. AWS (including Lambda) blocks it by default and unblocks EC2 only on request. Many VPS hosts (Hetzner, DigitalOcean, OVH) restrict new accounts. Budget an unblock request and a clean IP with a PTR record.
- **Rate limits for ClimbOS's own prober:**
  - ≤1 concurrent connection per MX host
  - ≤20 RCPTs per connection
  - ≤60 probes per MX host per hour
  - ≤2,000 probes per IP per day
  - exponential backoff on any 4xx
  - global circuit breaker on 421/554 rates
- **Caching.** Cache results: `valid` for 90 days, `invalid` for 180, `accept_all` per *domain* for 30, `unknown` for 7. Never re-probe on every send. Re-verify anything older than 90 days before it goes into a campaign.
- **Legal and ethical.** RCPT probing is widespread, but it is unsolicited use of a third party's server. CAN-SPAM lists automated address generation by permutation as an aggravating factor when combined with a violation (15 U.S.C. §7704(b)(1)). Keep permutation narrow (≤3 candidates) and pair it with full compliance.
- **Buying verification instead.** It is cheap. Hunter Email Verifier costs 0.5 credit (about $0.006–0.012) and returns `valid | invalid | accept_all | webmail | disposable | unknown` ([Hunter API](https://hunter.io/api-documentation/v2)). Bulk verifiers (ZeroBounce, NeverBounce, MillionVerifier and others) run about $0.001–0.008 per address at volume. **Recommendation:** start with Hunter's verifier and only build the in-house prober for cost reasons at more than 200k verifications/month.

### 3.4 Role accounts and disposable domains

- **Role accounts:**
  - Keep a list: `info, hello, contact, sales, support, admin, office, team, enquiries, inquiries, billing, accounts, hr, jobs, careers, press, marketing, noreply, postmaster, abuse, webmaster`.
  - Role addresses are often shared, generate complaints and are frequently spam-trapped. For SMBs, though, `info@` is sometimes the owner's only address.
  - **Policy:** allow role addresses only for companies with 1–10 employees and only when no personal address is found. Never "Hi {first_name}" them. Cap at 10% of sends.
- **Disposable and free webmail:**
  - Use a maintained list (for example the open-source `disposable-email-domains` list) and Hunter's `disposable`/`webmail` flags.
  - Exclude disposable addresses entirely.
  - Allow webmail only when a sole trader publishes it as their business contact. In the UK and EU this is sensitive, because sole traders count as individuals under PECR and ePrivacy (section 7).

### 3.5 Company enrichment from public sources

| Source | What you get | Constraints |
|---|---|---|
| Company website (Firecrawl, already in the stack) | Name, description, services, locations, team page, contact details, socials, hiring pages | Respect robots.txt and rate limits; keep it SSRF-safe (already in `ai/research.ts`) |
| schema.org JSON-LD (`Organization`, `LocalBusiness`, `PostalAddress`, `sameAs`, `numberOfEmployees`, `foundingDate`) and OpenGraph | Structured name, address, phone, social profiles | Often missing or stale on SMB sites |
| DNS | MX provider (Google/M365), SPF includes (HubSpot, Mailchimp, Salesforce), TXT verification tokens; tech-stack signals | Free and fast; cache for 7 days |
| Tech detection (HTML signatures: Shopify, WordPress, Wix, GA4, Meta Pixel) | Firmographic and technographic filters | Heuristic |
| Companies House API (UK) | Legal name, number, status, SIC codes, officers, filings | Free; 600 requests per 5 minutes |
| OpenCorporates | About 200M companies across many jurisdictions | Free tier under share-alike licence with attribution; commercial API is paid |
| SEC EDGAR, state Secretary of State registries, EU business registers | Legal entity data | Patchy APIs |
| Google Places API | Category, address, phone, ratings for local SMBs | Maps Platform terms limit caching of Places content (place IDs may be stored) |
| LinkedIn public pages | Titles, headcount | **Do not scrape.** The LinkedIn User Agreement prohibits it, hiQ v. LinkedIn ended in LinkedIn's favour on contract claims, and the CNIL's KASPR decision found no lawful basis for harvesting restricted-visibility contacts. Use LinkedIn only as a human-clicked URL. |
| Clearbit | n/a | Absorbed into HubSpot (Breeze Intelligence); standalone and free APIs have been wound down. Don't design around it. |
| Hunter Company Enrichment (`/v2/companies/find`), Apollo Organization Enrichment | Firmographics by domain | Paid credits; licence terms on storage |

---

## 4. Hunter.io API v2 and Apollo

### 4.1 Hunter API v2

Base URL `https://api.hunter.io/v2/`. Authenticate with `api_key` in the query string, an `X-API-KEY` header, or `Authorization: Bearer`. Use the header form so keys don't end up in logs. `test-api-key` returns dummy data for Domain Search, Finder and Verifier ([Hunter API docs](https://hunter.io/api-documentation/v2)).

| Area | Endpoint | Purpose | Rate limit | Cost |
|---|---|---|---|---|
| Discover | `POST /discover` | Find companies by natural-language query or filters (industry, headcount, location, technology) | 5/s, 50/min | Free |
| Discover | `GET /discover/people` (beta) | Same, with email counts | n/s | Free |
| Finder | `GET /domain-search` | All known emails at a domain, with `pattern`, `confidence`, `sources`, `position`, `seniority`, `department`, `verification` | 15/s, 500/min | 1 credit per email returned; bulk is 1 per up to 10 |
| Finder | `GET /email-finder` | Best email for name + domain/company/LinkedIn handle; returns `score` and `verification.status` | 15/s, 500/min | 1 credit if found; 0 if not |
| Finder | `GET /domains-suggestion`, `GET /domain-finder` (beta), `GET /domain-count` | Company name to domain | n/s | Free / quota-limited |
| Finder | `POST /multi-domain-search` + `/reveal` (beta) | Masked search across many domains, then reveal | n/s | 1 credit per personal email revealed |
| Verifier | `GET /email-verifier` | `status ∈ {valid, invalid, accept_all, webmail, disposable, unknown}`, `score`, flags (`mx_records`, `smtp_check`, `accept_all`, `block`, `gibberish`) | 10/s, 300/min | 0.5 credit; unknown is free |
| Verifier | `GET /email-insight`, `GET /email-count` | Light signals / counts | n/s | Free |
| Enrichment | `GET /people/find`, `GET /companies/find`, `GET /combined/find` | Person/company data by email/domain | 15/s, 500/min | Not stated on pricing page; test against `/account` |
| Leads | `/leads` CRUD, `/leads/bulk` (100), `/leads/exist`, `/leads_lists`, tags, custom attributes | Hunter-side CRM | n/s | Mostly free |
| Sequences | `/campaigns` (alias `/sequences`): list, create/update draft, `POST /{id}/recipients` (≤50 per call), `POST /{id}/start`, plus pause, resume, archive and stats | Hunter's own sending through Hunter-connected mailboxes | n/s | Plan limits on email accounts and recipients |

Notes:
- **Repeat lookups.** Repeat searches and verifications count once per billing period ([pricing](https://hunter.io/pricing)), but ClimbOS should still cache.
- **Async responses.** Finder and verifier can take time (`max_duration` parameter). Handle HTTP 202 (still processing; retry) and 429 (rate limit) with backoff.
- **Sequences API.** Hunter's Sequences API lets you *drive* Hunter Campaigns. That conflicts with building ClimbOS's own sender and would also put customers' mailboxes into Hunter's account, so use it only if ClimbOS decides to white-label Hunter for sending.

**Plans** ([hunter.io/pricing](https://hunter.io/pricing), Oct 2026). API access is on every plan:

| Plan | Monthly | Annual (per mo) | Credits/mo | Email accounts | Recipients/sequence |
|---|---|---|---|---|---|
| Free | $0 | $0 | 50 | 1 | 500 |
| Starter | $49 | $34 | 2,000 | 3 | 2,500 |
| Growth | $149 | $104 | 10,000 | 10 | 5,000 |
| Scale | $299 | $209 | 25,000 | 20 | 15,000 |
| Enterprise | custom | custom | custom | custom | custom |
| Data Platform | API-only credit bundles (example: $6,500 = 1,000 search + 200,000 verification credits, 12 months) | | | | |

On Scale, a found email costs about $0.012 (1 credit) and a verification about $0.006. Hunter states search quotas separately from credits for some free endpoints, which are blocked once the monthly search quota is used.

**Licence check (blocking).** ClimbOS wants one platform Hunter account serving many customers, with results persisted into a shared database. Get written confirmation from Hunter that this is permitted under the plan, or move to the Data Platform or Enterprise agreement. Standard SaaS data terms typically bar resale or building a competing database.

### 4.2 Apollo (for comparison)

- **Plans.** Free, Basic, Professional, Organization/Custom. Apollo's page no longer prints prices ([apollo.io/pricing](https://www.apollo.io/pricing)). Third-party trackers put Basic at about $49 and Professional at about $79 per user/month on annual billing, with Organization at about $119 per user/month with a seat minimum ([Cotera](https://cotera.co/articles/apollo-io-pricing-guide), [Knowlee](https://www.knowlee.ai/blog/tools/apollo-io-pricing-2026)).
- **Credits.** Credits are pooled at team level and don't roll over. An email reveal costs about 1 credit and a mobile number more (reported as 5). Extra credits are bought with a slider in settings.
- **API access.** Apollo's pricing page highlights API access on Custom plans. Its docs publish per-endpoint rate limits for all tiers: Free 50/min, 200/h, 600/day; Basic and Professional 200/min, 400/h, 2,000/day; Organization 200/min, 600/h, 6,000/day ([Apollo rate limits](https://docs.apollo.io/reference/rate-limits)).
- **Endpoints.** People and organization search (filters, no emails returned) and enrichment endpoints (people match single and bulk, organization enrichment single and bulk, job postings). Enrichment consumes credits.
- **Fit for ClimbOS.** Apollo's database is larger for US mid-market B2B, but its seat-based licence and terms are built for end users, not for re-hosting into another platform's shared database. **Recommendation:** Hunter for finder and verifier (cheap, per-credit, clean API). If ClimbOS needs bulk prospect lists, buy licensed data under a redistribution agreement, or let customers connect their *own* Apollo or Hunter keys (BYO-key) so the licence sits with them.

---

## 5. Sending infrastructure engineering

### 5.1 SMTP submission

- **Port 587 + STARTTLS** (RFC 6409) or **465 implicit TLS** (RFC 8314, which prefers implicit TLS). Use 465 where the provider offers it, otherwise 587. Port 25 is for MTA-to-MTA only.
- **Endpoints:**
  - Google: `smtp.gmail.com:465/587`, auth by XOAUTH2 or app password.
  - Microsoft: `smtp.office365.com:587`, auth by XOAUTH2 with scope `https://outlook.office.com/SMTP.Send`, or Basic auth while it lasts. Per-mailbox SMTP AUTH is disabled by default in many tenants (`SmtpClientAuthenticationDisabled`).
- **Library.** Use Nodemailer in a Node runtime with pooled connections (`pool: true`, `maxConnections: 1` per mailbox, `maxMessages: 20`). Set the `Message-ID` yourself so replies can be threaded and correlated.
- **Graph API alternative for Microsoft:**
  - `POST /users/{id}/sendMail` returns 202, but its `internetMessageId` is not in the response. To capture it, create the draft (`POST /messages`), read `internetMessageId`, then `POST /messages/{id}/send` ([Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)).
  - Graph throttles per app+mailbox: 10,000 requests/10 min, 4 concurrent requests, 150 MB uploads/5 min ([Graph throttling](https://learn.microsoft.com/en-us/graph/throttling-limits)). Exchange's 30 messages/min and 10,000 recipients/day still apply.
  - Permissions: `Mail.Send`, `Mail.ReadBasic` or `Mail.Read`, and `offline_access`. Use delegated permissions with user consent. Multi-tenant apps need **publisher verification** (Microsoft Partner Network ID) before users outside your tenant can consent. Many tenants require admin consent anyway.
- **Gmail API alternative:** `users.messages.send` with `gmail.send` (sensitive scope, which needs OAuth verification but not CASA). For reply detection, see 5.6.

### 5.2 Reply detection: IMAP IDLE vs polling vs push

- **IMAP IDLE** (RFC 2177): the server pushes `EXISTS` on new mail. Re-issue IDLE every 25 minutes or less, because servers drop idle sessions at about 29–30 minutes. One connection per mailbox per folder: INBOX, plus Spam/Junk to detect replies that land there. Gmail caps simultaneous IMAP connections per account at about 15.
- **Polling fallback:** every 2–5 minutes, use `UID SEARCH UID <lastUid+1>:*`. Track `UIDVALIDITY`, because a change means a full resync. Use CONDSTORE/QRESYNC (RFC 7162) where supported. On Gmail, `X-GM-THRID` and `X-GM-MSGID` give stable thread IDs.
- **Push APIs** (when OAuth is used):
  - Gmail `users.watch` to Pub/Sub (restricted scope, so CASA applies).
  - Graph change notifications on `/users/{id}/mailFolders('Inbox')/messages`. Subscriptions expire after up to about 3 days for mail and must be renewed. Use delta queries to catch up.
- **Processing.** On each new message, parse the headers, correlate (5.3), classify (bounce, auto-reply, human reply), then stop the sequence for that contact. Also stop it for the whole company if configured. Hand off to the AI inbox agent.

### 5.3 Threading headers

- **Message-ID.** Generate `Message-ID: <{ulid}.{campaignShort}@{sending-domain}>`, with the domain matching the sending domain. Store it with the send record.
- **Follow-ups as replies in the same thread.** Use `Subject: Re: <original subject>`, `In-Reply-To: <step1-id>` and `References: <step1-id>`. Each later step appends: `References = parent.References + " " + parent.Message-ID`. The "Re:" is honest here because it is a reply in the same thread, so it is not a deceptive "fake Re:".
- **Correlating replies:**
  1. `In-Reply-To`/`References` against stored Message-IDs.
  2. Fallback: provider thread ID (Gmail `X-GM-THRID`, Graph `conversationId`).
  3. Fallback: sender address + normalised subject within 30 days.
  4. Fallback: the sender's domain matches an active contact's company. Flag these for review.
- **No hidden tracking headers.** Avoid custom `X-ClimbOS-*` headers. They fingerprint the platform across customers. Keep correlation in the database instead.

### 5.4 Bounce (DSN) handling

Through a user's own mailbox, bounces arrive **asynchronously as messages in that inbox**, because Return-Path is the mailbox itself.

- **Detection:** `Content-Type: multipart/report; report-type=delivery-status` (RFC 3464/6522), From `MAILER-DAEMON@`/`postmaster@`, and `Auto-Submitted: auto-replied` or `auto-generated`.
- **Parsing:** read the `message/delivery-status` part for `Final-Recipient`, `Action: failed|delayed`, `Status: 5.1.1` and `Diagnostic-Code`. Match the bounce to the send using the embedded original headers (`text/rfc822-headers` or `message/rfc822`) and the Message-ID. Non-standard bounces (some Exchange and older servers) need regex fallbacks and an LLM classifier as the last step.
- **Classification:**
  - **Hard:** 5.1.x (bad mailbox or domain), 5.4.1 (M365 recipient not found), 5.4.4. Suppress the address permanently and mark it invalid in the shared database (this benefits every customer).
  - **Soft:** 4.x.x, 5.2.2 (mailbox full), `Action: delayed`. Retry up to 3 times over 72 h, then treat as hard.
  - **Policy/reputation block:** 5.7.x (5.7.1, 5.7.26, 5.7.515, 5.7.708), Spamhaus or URIBL citations. This is **not** the recipient's fault. Pause the *mailbox* and alert, and don't suppress the address.
- **Synchronous rejections** at submission (5.x.x from smtp.gmail.com/office365) are usually quota or auth problems. Example: `5.4.5` for the Gmail daily limit, or Microsoft `5.2.2 submission quota exceeded`. Pause the mailbox for 24 h.

### 5.5 Auto-reply detection

- **Headers:** `Auto-Submitted` not equal to `no` (RFC 3834), `X-Autoreply`, `X-Autorespond`, `Precedence: auto_reply|bulk|junk|list`, `X-Auto-Response-Suppress` (Microsoft), `X-MS-Exchange-Inbox-Rules-Loop`, and an empty or `<>` Return-Path.
- **Subject and body patterns:** "Automatic reply", "Out of Office", "Abwesenheitsnotiz", "Réponse automatique", "Fuera de la oficina", "I am currently out", "will be back on".
- **Actions:**
  - **Out of office:** extract the return date (an LLM or date parser works) and reschedule the next step for return date + 1 business day.
  - **"No longer with the company" plus a referral:** create the referral as a new lead, subject to approval and compliance checks, and mark the original as invalid.
  - **Ticket systems** (Zendesk or Freshdesk acknowledgements): treat as non-human and stop the sequence to that role address.
- **Loop prevention:** never auto-reply to auto-replies. ClimbOS never sends automatic responses from customer mailboxes without approval.

**Reply classification** (LLM with a fixed label set):
- `interested`
- `meeting_request`
- `question`
- `not_now` (with date)
- `referral`
- `not_interested`
- `unsubscribe`
- `hostile`/`spam_complaint`
- `bounce`
- `ooo`
- `other`

`unsubscribe` and `hostile` write to suppression immediately, deterministically, before any human review.

### 5.6 Mailbox auth options in 2026

| Provider | Option | Status in Oct 2026 | Notes |
|---|---|---|---|
| Google Workspace / Gmail | App password + IMAP/SMTP | Works; needs 2-Step Verification; Workspace admins can disable it; not available under Advanced Protection | Legacy passwords ended 14 Mar 2025 ([Google](https://knowledge.workspace.google.com/admin/sync/transition-from-less-secure-apps-to-oauth)) |
| Google | OAuth `gmail.send` | Sensitive scope: brand verification, roughly 1–4 weeks, no CASA | Send-only; can't see replies |
| Google | OAuth `gmail.readonly`/`metadata`/`modify` or `https://mail.google.com/` (IMAP/SMTP XOAUTH2) | Restricted scope: yearly CASA Tier 2 (about $540+ through self-serve labs to $15k+; 2–8 weeks) | Required for full send+reply over OAuth. Unverified apps are capped at 100 users |
| Microsoft 365 | SMTP AUTH Basic | Allowed until **end Dec 2026**, then default-off for existing tenants; final removal date to be announced H2 2027 | `550 5.7.30` after removal |
| Microsoft 365 | IMAP/POP Basic | Already retired (since 2022–23) | Only OAuth IMAP works |
| Microsoft 365 | OAuth SMTP/IMAP (XOAUTH2) or Graph `Mail.Send`/`Mail.Read` | Supported | Needs publisher verification; admin consent often required |
| Outlook.com consumer | Basic auth | Removed for IMAP/SMTP in Sept 2024 | OAuth only |
| Yahoo / AOL | App password + IMAP/SMTP | Works | |
| Other hosts (Zoho, cPanel, Fastmail, Migadu, etc.) | Password IMAP/SMTP | Works | Zoho/Fastmail also offer app passwords |

**Recommendation for ClimbOS's connect flow:**
- **v1:**
  - Generic IMAP/SMTP with app passwords (Google, Yahoo, Zoho, cPanel hosts).
  - **Microsoft via OAuth** (Graph or XOAUTH2), because Basic SMTP becomes default-off in two months.
  - Gmail OAuth with `gmail.send` only, plus app-password IMAP for replies. This hybrid is clunky. The cleaner path is to start CASA now.
- **v1.1:** after CASA, full Gmail OAuth with restricted scopes.

Encrypt credentials at rest with envelope encryption (already the pattern in `connections*.ts`). Never log the SMTP conversation's AUTH lines.

### 5.7 Can serverless open SMTP/IMAP?

| Runtime | Outbound 25 | 465/587 | 993 IMAP | Long-lived | Verdict |
|---|---|---|---|---|---|
| Convex default runtime | No raw TCP (fetch only) | No | No | No | HTTP APIs only (Graph, Gmail API, Hunter) |
| Convex Node action (AWS Lambda) | Blocked by default | Works (community-confirmed Nodemailer) | Works for short sessions | 10-minute cap, 512 MiB | OK for **batched sends** and **short IMAP polls**; not for IDLE or probing |
| Vercel Functions | Blocked | Allowed ([Vercel](https://vercel.com/support/articles/serverless-functions-and-smtp)) | Allowed | Duration-capped | Same as above |
| Always-on container (Fly.io, Railway, Render, ECS Fargate, a Hetzner VPS) | Provider-dependent | Yes | Yes | Yes | **Mail worker** for IDLE, connection pools and schedulers |
| VPS with port 25 unblocked and a clean IP + PTR | Yes (after request) | Yes | Yes | Yes | **Verification prober only** |

**Pattern:**
- **Convex** stays the source of truth: campaigns, sends, schedule, suppression and events.
- **A mail-worker service** (Node, roughly 1 vCPU per 500–1,000 IDLE connections) does three things. It leases due sends from Convex through an authenticated HTTP action with idempotency keys. It sends over SMTP or Graph. It holds IMAP IDLE connections and posts parsed events back.
- **Scaling.** Shard mailboxes across workers with consistent hashing and a lease or heartbeat, so a mailbox's connection lives on exactly one worker.
- **Fallback.** A Convex cron runs a short IMAP poll for mailboxes whose worker heartbeat is stale.

---

## 6. Provisioning dedicated domains and mailboxes

### 6.1 Domains through registrar APIs

| Registrar | API status | Notes |
|---|---|---|
| **Cloudflare Registrar** | Registration API in **beta since 15 Apr 2026**: `POST .../domain-check` (≤20 domains), `POST .../registrar/registrations`; curated TLD set; renewals and management not yet in the API ([Cloudflare blog](https://blog.cloudflare.com/registrar-api-beta), [docs](https://developers.cloudflare.com/registrar/registrar-api/)) | At-cost pricing (about $10–11/yr for .com); needs a billing profile and default registrant contact; DNS API is excellent; also on the Cloudflare MCP |
| **Vercel** | Domain search, price and buy via REST API and MCP; DNS records API | Natural fit with the stack; check TLD coverage and price against Cloudflare |
| **Namecheap** | Mature XML API | Gated: 20+ domains, $50+ balance or $50 spent in 2 years; IPv4 allow-list; sandbox is a separate account ([Namecheap FAQ](https://www.namecheap.com/support/knowledgebase/article.aspx/9739/63/api-faq/)) |
| Porkbun, Dynadot, Name.com | APIs available | Good fallbacks |

**Registrant.** The customer should be the registrant and owner, with ClimbOS as the technical contact or an agent under a signed mandate. That way the customer keeps their domains if they churn, and ClimbOS doesn't hold a portfolio of look-alikes of other people's brands. Pass through the cost plus a margin. Enable WHOIS privacy and auto-renew.

### 6.2 Mailbox hosts

| Host | Cost/mailbox/mo | Cold-email suitability | Notes |
|---|---|---|---|
| **Google Workspace** Business Starter | about $7 annual / $8.40 flexible ([pricing summary](https://www.emailvendorselection.com/google-workspace-pricing/)) | Best Gmail-to-Gmail placement; strict new-tenant suspensions (vendor-reported about 22% of high-volume new accounts in Q1 2026, unverified) | Reseller program requires Google partner approval; Admin SDK Directory API for users; DKIM key generation historically console-driven, so check API support |
| **Microsoft 365** Business Basic | about $6 | Good placement into M365 recipients (most B2B); tenant creation and licensing through CSP or a direct account | Graph for users and licences; DKIM through `New-DkimSigningConfig` with CNAME selectors; SMTP AUTH must be OAuth |
| Zoho Mail Lite | about $1–1.25 | Weak placement; AUP prohibits unsolicited bulk | Fine for low volume |
| Migadu, Fastmail, Proton | flat or about $3–5 | Low outbound limits; AUPs prohibit cold bulk | Not suitable |
| Self-hosted Postfix/Mailcow on own IPs | about $1 + ops | Fresh-IP reputation problem; Microsoft especially hostile; ClimbOS becomes an ESP with abuse-desk duties | Not recommended |
| Specialist cold-email mailbox providers (Workspace/M365 resellers or private SMTP: Mailforge, Infraforge, Maildoso, Zapmail, Scaledmail, Inboxology, etc.) | about $2–5 | Fast, automated DNS; shared or bulk tenants with high correlated-suspension risk; terms grey vs Google/Microsoft | Could be a v0 shortcut through their APIs, but reputation is pooled with strangers |

**Recommendation:**
- **One dedicated M365 or Workspace tenant per ClimbOS customer.** Choose by the customer's target audience: M365 for B2B-heavy targets, Workspace if prospects are mostly on Google. Never pool customers in one tenant.
- **Start size:** 1–2 domains × 2–3 mailboxes.
- **All-in cost:** about $25–35/month per domain (domain $1/mo amortised + 3 × $6–8.40), plus ClimbOS margin. A 6-mailbox setup comes to about $50–60/mo in cost.

### 6.3 DNS automation, per domain

1. MX records for the provider.
2. SPF TXT.
3. DKIM. For Workspace, a TXT at `google._domainkey`. For M365, two CNAMEs, `selector1`/`selector2._domainkey` → `*.onmicrosoft.com`.
4. DMARC at `_dmarc`, starting with `p=none; rua=...`. A scheduled job promotes it to `quarantine` after 21 clean days.
5. Tracking CNAME `link.` (optional).
6. Unsubscribe host `u.` (CNAME to ClimbOS, TLS through the platform).
7. 301 redirect of the root and `www` to the customer's site (Vercel or Cloudflare redirect rules).
8. Postmaster Tools verification TXT.
9. Optional MTA-STS and TLS-RPT.

A validator job re-checks all records daily: DNS drift, expiry, blocklists (Spamhaus DBL, SURBL, URIBL), and DMARC report anomalies.

---

## 7. Compliance

### 7.1 United States: CAN-SPAM

Cold B2B email is legal without consent if:
- header information is accurate
- the subject line is not deceptive
- the message is identified as an advertisement (a "clear and conspicuous" identification; in practice, plain commercial context plus disclosure)
- a valid physical postal address is included
- a working opt-out stays functional for at least 30 days after sending
- opt-outs are honoured within **10 business days**, at no cost
- opted-out addresses are never sold or transferred

Penalties are per email: up to $53,088 under the 2025 inflation adjustment ([Federal Register](https://public-inspection.federalregister.gov/2025-01361.pdf)), adjusted every year. Liability attaches to the sender **and** to whoever "initiates" or procures the message. ClimbOS's customers are senders, and ClimbOS could be pulled in as a procurer if its agents choose recipients and write the copy. Aggravating factors (§7704(b)) include harvested addresses and **automated permutation of names** (a "dictionary attack"), so ClimbOS's own compliance record matters more because it does pattern inference.

### 7.2 EU / UK GDPR

- **Lawful basis.** Legitimate interests (Art 6(1)(f)). Recital 47 says direct marketing *may* be a legitimate interest. Document a **Legitimate Interests Assessment** with three parts:
  1. *Purpose:* B2B outreach about products relevant to the recipient's role.
  2. *Necessity:* minimal data (name, work email, title, company, public role info), no sensitive data.
  3. *Balancing:* work context, reasonable expectations, easy opt-out, short retention, no LinkedIn scraping, no profiling beyond firmographics.
- **Controllers.** ClimbOS is the **controller** of the shared database. Each customer becomes an independent controller when it uses a contact. Data-sharing terms must require customers to comply and pass objections back.
- **Article 14 notice** (data not obtained from the data subject). Provide the information (identity, purposes, legal basis, categories, **source**, recipients, retention, rights, the right to complain) within a reasonable period, at the latest one month after collection, or **at the latest at the first communication** if the data is used to contact the person. The Art 14(5)(b) "disproportionate effort" exemption is read narrowly by regulators. Practical approach: a short privacy line in each first-touch email ("We found your work email on {source}. See how we handle data: {link}. Reply 'no' to opt out.") plus a public ClimbOS privacy notice for the database. The shared database also needs a mechanism for people never contacted. Publish the notice and an opt-out or lookup portal.
- **Article 21 right to object.** For direct marketing the objection is absolute (Art 21(3)). When it reaches ClimbOS as controller, the person is suppressed for **all** customers.
- **Retention.** Re-verify or delete records not used or confirmed in 12–24 months, and document the period.
- **Enforcement example.** The CNIL fined KASPR €240,000 in December 2024 over a database of about 160M contacts collected from LinkedIn (including restricted-visibility profiles) and other sources. The findings cited lack of a legal basis, alongside transparency and retention issues ([CNIL](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000)).
- **ePrivacy (national e-marketing rules) applies on top of GDPR.** Treat this as a per-country allow-list ([summary of national divergence](https://www.ediware.eu/b2b-email-marketing/b2b-cold-emailing-legal-framework/), verify with counsel):
  - **France (CNIL):** B2B email without consent is allowed if it relates to the recipient's professional role, with identification and opt-out.
  - **Germany (UWG §7):** prior consent is required even B2B in practice, enforced through competitor lawsuits. **Default ClimbOS to blocking DE and AT cold email.**
  - **Other countries:** NL, IE, IT, ES, BE and others vary. Run a per-country rules table and keep it updated.

### 7.3 UK PECR

- **Corporate subscribers.** PECR regulation 22's consent rule applies to *individual* subscribers. Emails to **corporate subscribers** (companies, LLPs, Scottish partnerships, public bodies) need no consent. They must identify the sender and give a valid address for opt-out (reg 23), and UK GDPR still applies to the named employee's data.
- **Individual subscribers.** **Sole traders and (non-Scottish) partnerships count as individuals**, so they need consent or the soft opt-in. Many of ClimbOS's SMB targets are sole traders: classify legal form, for example through the Companies House lookup, and block those without consent.
- **Data (Use and Access) Act 2025.** Royal Assent 19 Jun 2025. It raises PECR maximum fines from £500k to **£17.5m or 4% of turnover** (commencement staged), and the government dropped the idea of extending consent rules to B2B ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/06/the-data-use-and-access-act-pecr-reform-rules-relating-to-electronic-marketing-and-cookies-in-the-uk), [Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2025/data-protection/data-use-and-access-act-2025-top-7-changes/)).

### 7.4 Canada: CASL

- **Consent.** Every commercial electronic message needs consent, express or implied.
- **Implied consent by conspicuous publication** (s.10(9)(b)) covers cold B2B where:
  1. the address was conspicuously published by, or with permission of, the person
  2. there is no statement that they don't want unsolicited messages
  3. the message is relevant to their business role
- **Store the evidence:** source URL, capture date and a screenshot or hash. Under CASL the burden of proof is on the sender.
- **Message content:** identify the sender with mailing address plus phone, email or web contact, and include an unsubscribe processed within **10 business days**.
- **Penalties:** administrative penalties up to C$10M per violation for organisations. Directors and officers can be liable. **Guessed addresses do not qualify** for conspicuous-publication implied consent, so default to blocking CA for pattern-inferred emails. Only verbatim published addresses qualify.

### 7.5 Australia: Spam Act 2003

- **Consent.** Express or **inferred** consent is required. Inferred consent from conspicuous publication needs a published address, no statement refusing messages, and relevance to the person's role or business.
- **Message content:** accurate sender identification, and a functional unsubscribe honoured within **5 business days**.
- **Address harvesting.** Address-harvesting software and harvested lists are prohibited outright (Part 3).
- **Enforcement.** The ACMA actively issues multi-million-dollar penalties.
- **Default:** like Canada, only verbatim-published addresses. Block AU for inferred addresses and treat it as stricter than the US.

### 7.6 US data-broker registration laws

- **California (Delete Act, SB 362).**
  - **Definition.** A data broker is a business that knowingly collects and sells to third parties the personal information of consumers with whom it has no direct relationship. Since 1 Jan 2023, B2B contact data is CCPA personal information.
  - **Registration.** Annual registration with CalPrivacy (the CPPA). The 2026 fee is $6,000 plus processing ([CalPrivacy](https://privacy.ca.gov/drop-for-data-brokers/account-creation-fees-and-annual-registration/)), and a vote to raise it to $9,500 is reported.
  - **DROP.** Since **1 Aug 2026**, brokers must access the DROP every 45 days and delete matching records ([CalPrivacy DROP](https://privacy.ca.gov/drop-for-data-brokers/)). Penalties for failing to register were raised to $200/day.
  - **Applicability.** If ClimbOS provides contact records to customers as part of a paid subscription, assume this applies unless counsel concludes the customer relationship or a service-provider structure takes it out of scope.
- **Vermont (9 V.S.A. ch. 62):** annual registration by 31 Jan, a security program, and disclosures.
- **Texas (Bus. & Com. Code ch. 509):** applies if broker activity is the principal revenue source or covers 50,000+ individuals. Requires registration, a website notice and a security program. Penalties are capped at $10k per 12 months ([Mondaq](https://mondaq.com/unitedstates/privacy-protection/1451210/dont-forget-to-register-as-a-data-broker-in-texas)).
- **Oregon (HB 2052):** registration with DCBS, about $600/yr ([FKKS](https://technologylaw.fkks.com/post/102imzj/oregon-passes-data-broker-registration-law)).

None of these statutes clearly exempts business contact data. Budget about $8–12k/yr for registrations plus the DROP integration.

### 7.7 Guardrails the shared B2B database must have

1. **Provenance on every field:** `source_type` (operator CSV, website URL, Hunter, customer upload, inferred), `source_url`, `collected_at`, `lawful_basis`, `licence` (who may see it), and `published_verbatim` (bool, which drives CASL/AU eligibility).
2. **Operator CSV intake checks:**
   - The uploader attests to source and licence.
   - The schema is validated.
   - Any record without provenance is rejected.
   - Rows with personal/free-mail domains are quarantined.
   - Rows are de-duplicated on normalised email and LinkedIn URL.
3. **Global objection list** (hashed emails and domains): Art 21 objections, DROP deletions, "never contact" requests, and hard bounces. It is checked at query time **and** at send time across all customers.
4. **Per-customer suppression lists:** that customer's unsubscribes, existing customers and competitors.
5. **Jurisdiction engine:** country from the company address and TLD. The rules table blocks DE/AT and, for inferred addresses, CA/AU. UK sole traders are blocked. It also sets the required footer and notice text per country.
6. **Retention:** records not re-verified within 12 months are hidden, and after 24 months deleted. Deletion is real and logged.
7. **No sensitive data:** no personal phone numbers, home addresses, personal social profiles or special-category inferences. Only work context.
8. **Access controls:** customers see contacts only through ICP-filtered queries with per-day reveal caps, not bulk export. Watermark exports per customer to trace leaks.
9. **Public transparency:** a privacy notice for the database, a lookup and opt-out portal, and Article 14 text in first-touch emails.
10. **Audit log** of who revealed or exported which contact, and when, for DSARs and regulator queries.

---

## 8. Cold email copy, 2026

### 8.1 Benchmarks (vendor-published; treat as directional)

- **Reply rate.** Instantly's 2026 report (2025 data) puts the platform average at **3.43%**, the top quartile at 5.5% and the top 10% at 10.7%+. **58% of replies come from step 1.** Its best-practice guidance is 4–7 steps and under 80 words ([Instantly](https://instantly.ai/blog/cold-email-sequence-best-practices/)).
- **Other platforms.** Saleshandy reports a 3.7% average (H1 2026) ([Saleshandy](https://saleshandy.com/blog/cold-email-statistics/)). Hunter reports 4.5% overall and about 3% for sales outreach ([Hunter](https://hunter.io/the-state-of-cold-email)).
- **Length.** Smartlead finds first emails under 50 words earn about one reply per 68 contacts, against about one per 97 at 100–149 words ([Smartlead](https://www.smartlead.ai/benchmarks)).
- **ClimbOS targets** for an SMB customer with good ICP fit:
  - reply ≥5%
  - positive reply ≥1.5%
  - meeting ≥0.5–1% of contacts
  - bounce <2%
  - unsubscribe <1%
  - negative/hostile reply <0.3%

### 8.2 Defaults

- **Length:** step 1 at 50–90 words, follow-ups at 25–60 words. Plain text, 3–5 short paragraphs, readable on a phone.
- **Subject:** 2–5 words, lower-case or sentence case, specific and boring: "{company} reviews", "question about {service}", "{mutual topic}". No "Re:"/"Fwd:" on first touches (deceptive under CAN-SPAM), no emojis, no clickbait, no ALL CAPS, no "$$$".
- **Opening line:** a specific observation the AI can **cite**, i.e. a fact from their site or public signals with a stored source URL. Examples: "Saw you added same-day boiler repair in Leeds" or "Your booking page only takes phone calls". No "I hope this finds you well", no fake flattery ("Loved your recent post!") and no feigned familiarity.
- **Body:** one problem relevant to *their* business, one concrete outcome or proof (a number, a named similar customer if permitted), and why now.
- **CTA:** one, low-friction, interest-based: "Worth a 2-line summary?", "Open to seeing how?" or "Should I send the example?". Ask for a meeting only after interest. No calendar links in step 1.
- **Signature:** a real name, role and company. In the footer: the postal address, one plain-text opt-out line, and the Article 14 notice line for EU/UK contacts.
- **Sequence** (business days): step 1 day 0 → step 2 day 3 (same thread, adds a new angle or proof) → step 3 day 7 (a short useful resource, offered without a link: "want it?") → step 4 day 14 (a brief, polite close-out). Optionally step 5 at day 30 with new news. Stop on any reply, bounce or unsubscribe, and on any reply from the same company if configured.
- **Personalisation tiers:**
  - **Tier 1:** firmographic, i.e. industry and location. Weak on its own.
  - **Tier 2:** a specific observation from their website or listings. **This is the ClimbOS default.**
  - **Tier 3:** a trigger event, such as hiring, new location, a review trend or a site change. Use it when the data exists.
  - Never personalise on personal-life information.

### 8.3 Quality rubric (AI writer self-check and human review gate)

Score each dimension 1–5. A message ships only if it averages ≥4 with no dimension below 3, and **Accuracy** and **Compliance** must both be 5.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Accuracy** | Contains an unverifiable or false claim about the prospect (hallucinated fact, wrong name/company) | All claims plausible but one not traceable to a stored source | Every prospect-specific claim maps to a stored source URL; names/titles verified |
| **Relevance** | Generic pitch that could go to anyone | Industry-relevant but not specific to this company | Ties a specific observation to a problem this company plausibly has right now |
| **Clarity of value** | Feature list or jargon; reader can't say what's offered | Value stated but vague ("grow your business") | One concrete outcome with a number or comparable proof |
| **Brevity** | >150 words or walls of text | 90–130 words | ≤90 words (step 1), ≤60 (follow-ups), scannable on a phone |
| **CTA** | Multiple asks or a hard meeting demand with a link | Single ask but high-friction | Single, low-friction, interest-based question |
| **Tone and honesty** | Manipulative (fake urgency, fake Re:, flattery, pretending to know them) | Neutral but salesy clichés | Peer-to-peer, plain, respectful; nothing a recipient would feel tricked by |
| **Compliance** | Missing opt-out/identity, or blocked jurisdiction | Opt-out present but footer/notice incomplete | Sender identity, postal address, opt-out, Art 14 line where required, jurisdiction rules passed |

### 8.4 Failure modes to test for

- Hallucinated personalisation ("congrats on the Series A" to a bakery). This is the biggest AI-specific risk. Enforce source-grounding.
- Wrong name, merge-field leaks (`{{first_name}}`), "Hi Info".
- Over-long emails, several CTAs, links and images in step 1.
- Deceptive subjects ("Re: our call"), false scarcity, implying a prior relationship.
- Identical templates across many mailboxes. Content fingerprinting across a domain is a filter signal, so vary structure, not just merge fields.
- Spam-trap-like targeting (role accounts, stale addresses), sending to competitors or existing customers.
- Language and locale mismatch (English to a French-only business), US spelling to UK prospects.
- AI tells: "I hope this email finds you well", "game-changer", "unlock", "leverage", heavy em-dash and tricolon cadence.
- Follow-ups that only say "bumping this".

---

## 9. Lead magnets and inbound capture

- **Inbound is the fully compliant lane.** It is also the only lane Resend may carry. SMB buyers respond to **instant, personalised utility**:
  - a free website or local-SEO audit (ClimbOS's landing "live preview" already does this)
  - a "what your competitors charge" or review benchmark
  - ROI and pricing calculators
  - templates (offer pages, follow-up scripts)
  - a short benchmark report by industry and city
- **Capture design:**
  - Ask only for email (and optionally website) to deliver the result. Show part of the result before the gate and send the full result by email.
  - Use a double opt-in for EU/DE.
  - Store consent evidence: timestamp, IP hash, form version and text shown.
  - Tag the source magnet to use for segmentation.
- **Hand-off.** Leads who opt in go into a *consented* nurture sequence through Resend or the customer's ESP, never into the cold engine. A cold-sourced prospect who downloads a magnet moves to the consented lane with the new consent recorded.
- **Measurement.** Track magnet-to-conversion rate, not opens. Good SMB magnets convert 20–40% of landing visitors who start the tool, and gated PDFs much less (practitioner ranges).

---

## 10. Engineering recommendations for ClimbOS

**Architecture**
1. **Convex holds the source of truth.** It owns contacts, companies, provenance, suppression and objection lists, campaigns, steps, schedules, sends, events, mailbox health and domain health. All writes stay tenant-scoped (`orgId`), and shared-database tables are platform-scoped with strict read APIs.
2. **A new `mail-worker` service** (Node, a Fly.io or Railway container, or ECS Fargate; at least 2 instances) handles the persistent mail work:
   - SMTP send pools
   - IMAP IDLE plus Junk polling
   - Graph change-notification receivers (or HTTP actions on Convex)
   - DSN and auto-reply parsing
   - it leases work from Convex through authenticated HTTP actions with idempotency keys (`sendId`), and posts events back
   - per-mailbox token-bucket limits (default 30/day, jittered 3–9 min, recipient business hours)
3. **Verification:** use Hunter's verifier first. Build the in-house RCPT prober later on a separate VPS with port 25 unblocked, a dedicated verification domain and IPs, and conservative rate limits (section 3.3). Never run it on Convex or Vercel.
4. **Keep Resend out of the cold path.** Enforce this in code: the cold-send code path cannot import the Resend adapter.

**Mailbox connections**
5. **v1 connect options:**
   - generic IMAP/SMTP with app passwords (Google, Yahoo, Zoho and others)
   - Microsoft OAuth (Graph `Mail.Send`/`Mail.Read`, or XOAUTH2 SMTP/IMAP)
   - Google `gmail.send` OAuth (sensitive scope) for sending
   - Start the Google restricted-scope verification and CASA Tier 2 now. Budget about $1–5k/yr and 4–8 weeks, plus a public privacy policy and a demo video.
6. **Microsoft publisher verification:** complete Microsoft Partner Network publisher verification for the Entra app before any customer-facing Microsoft connect.

**Provisioned infrastructure**
7. **One tenant per customer** (M365 or Workspace). The customer owns the domain registrations. Cloudflare Registrar API (beta) or Vercel for purchase, Cloudflare or Vercel DNS API for records. Run the full DNS checklist (section 6.3), a 14-day minimum domain age gate and a daily health validator.
8. **Default sizing:** 2 domains × 3 mailboxes, about 180 sends/day capacity after ramp, about $50–60/mo cost passed through.

**Deliverability defaults** (store as platform config, editable by ops only):
9. **Per-mailbox limits:**
   - 30/day steady state (50 hard cap)
   - ≤100/day per domain
   - Mon–Fri 08:00–17:00 recipient local time
   - plain text, opens and clicks off
   - no links or images in step 1
   - RFC 8058 headers on every message
   - unsubscribe processed synchronously
10. **Circuit breakers:**

| Trigger | Action |
|---|---|
| Hard bounce >2% over the last 100 sends | Pause the campaign |
| Hard bounce >3% | Pause the mailbox |
| Any 5.7.x policy block | Pause the mailbox 72 h and alert |
| Negative-reply rate >1% | Pause and re-review the copy |
| Seed placement below 70% on Gmail or Outlook | Pause the mailbox |
| Yahoo CFL complaint >0.1% | Pause the domain |
| Ops-level stop | Reuses the existing `ops.ts` "fleet stop" |

11. **Warm-up = "Smart ramp-up":** the ramp schedule, real-traffic nudges and ClimbOS-owned seed placement tests (20–40 seeds, read-only, weekly). **No peer engagement pool.**

**Data and enrichment**
12. **Contact pipeline:** operator CSV or AI discovery → provenance check → company enrichment (website via Firecrawl, schema.org, DNS/MX, Companies House/OpenCorporates) → people (website team pages, Hunter Domain Search) → pattern inference → ≤3 candidates → verification → confidence score → jurisdiction rules → available to ICP queries.
13. **Hunter usage:**
    - platform key in Convex env
    - cache everything (finder 90 days, verifier 90 days, domain search 30 days)
    - call `/account` daily for quota alerts
    - Discover (free) for company sourcing
    - Domain Search with `type=personal&seniority=senior,executive` and `limit` set, to control credits
    - **Get written licence confirmation before persisting Hunter-sourced emails in the shared database.** Until then, store Hunter results per customer org (the customer's own lookup), or use BYO-key.
14. **AI agent rules:**
    - The prospect-finder agent may only use public web pages (no LinkedIn scraping) and must record source URLs.
    - The writer agent must ground every personal claim in a stored source.
    - An automated rubric check (section 8.3) blocks sends below threshold.
    - The first campaign for each customer needs human approval of the template and 10 sample messages (consistent with the existing "approved execution" principle).

**Compliance plumbing**
15. **Jurisdiction rules table, the global objection list and DROP integration** (a job pulls DROP every ≤30 days, matches hashed identifiers and deletes or suppresses).
16. **Register as a data broker** where counsel confirms: CA, VT, TX, OR.
17. **Privacy notice and opt-out portal** for the shared database.
18. **Article 14 line in EU/UK first touches.**
19. **Footer builder** that adds the customer's postal address.
20. **CAN-SPAM 30-day unsubscribe-link lifetime** (make it permanent).

**Metrics:** sends, delivered, hard and soft bounces, replies by class, positive replies, meetings, unsubscribes, Yahoo complaints, seed placement, and Postmaster v2 compliance status. Open rate is not a headline metric.

---

## 11. Policy risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Look-alike domains seen by Google/Microsoft as evading per-domain bulk-sender limits and reputation** (counting is per primary domain; multiple domains for one sender is circumvention in spirit) | Medium | Tenant or mailbox suspensions, domain blocklisting | Low per-domain volumes, real people, honest content, customer-owned brand variants only, no domain-hopping after burns (30-day rest, then retire) |
| 2 | **Workspace AUP "evade filtering" / "unsolicited mass email" clauses**, enforced through suspension of provisioned tenants | Medium–High for aggressive senders | Lost mailboxes, customer churn | Volume caps, verified-only lists, relevance gate, no warm-up pool, per-customer tenants to contain blast radius |
| 3 | **Warm-up pool** (if ever built) threatening ClimbOS's Google OAuth verification (GMass precedent) | High if built | Loss of Google connect for *all* customers | Don't build it; ramp plus seed tests |
| 4 | **Gmail restricted-scope CASA** not obtained, or lost on failing reassessment | Medium | No OAuth reply detection for Google users | App-password IMAP fallback; annual CASA calendar; minimise stored mail content (store headers and classification, not bodies, where possible) |
| 5 | **Microsoft SMTP AUTH Basic default-off (end Dec 2026)** | Certain | Password-based M365 connections break | Ship OAuth/Graph before launch |
| 6 | **ClimbOS as data broker** (CA Delete Act/DROP, VT, TX, OR) | High if the shared database is sold | $200/day/request penalties, registration fines, reputational harm | Counsel review, registration, DROP job, provenance and deletion tooling |
| 7 | **GDPR controller liability** for the shared database: lawful basis, Art 14 transparency, Art 21 objections, retention (KASPR precedent) | Medium–High in EU | Fines up to 4% of turnover, orders to delete the database | LIA, notices, global objection list, retention limits, no LinkedIn scraping, EU country allow-list (block DE/AT) |
| 8 | **CAN-SPAM procurement liability** plus aggravation from permutation/harvesting | Low–Medium | Per-email penalties around $53k | Mandatory footer, opt-out, honest headers and subjects, automatic suppression; limit permutation to 3 candidates |
| 9 | **CASL/Spam Act**: implied consent fails for guessed addresses | Medium if CA/AU targeted | C$10M/violation; ACMA penalties | Only verbatim-published addresses for CA/AU; store evidence |
| 10 | **UK PECR sole-trader rule** | Medium (SMB-heavy targets) | ICO fines (now up to £17.5m) | Legal-form classification, block sole traders/partnerships without consent |
| 11 | **Hunter/Apollo licence breach** by persisting or redistributing data across customers | Medium | Account termination, contract claims | Written licence, Data Platform agreement, or BYO-key |
| 12 | **Resend AUP breach** if any cold mail leaks into Resend | Low (code guard) | Loss of platform transactional email (sign-in codes!) | Hard separation in code; separate Resend domain for marketing consented mail |
| 13 | **AI hallucinated personalisation or deceptive copy** | Medium | Complaints, brand harm, FTC deception exposure | Source-grounding, rubric gate, human approval of first campaign |
| 14 | **SMTP probing gets IPs blocklisted**, or is treated as abuse by MX operators | Medium if in-house prober | Verification outage; sending collateral if IPs are shared | Separate IPs and domain, conservative rates, Hunter first |
| 15 | **Cross-customer contamination** (shared tracking domains, shared tenants, shared IPs) | Medium | One bad customer burns many | Per-customer tenant, per-domain tracking subdomain, no shared pools, customer-level kill switch |
| 16 | **Tracking pixels under ePrivacy/PECR cookie rules** in EU/UK | Low–Medium | Regulator complaints | Opens off by default |

---

## Appendix: key numbers

| Item | Value |
|---|---|
| Gmail/Yahoo/Outlook bulk threshold | about 5,000/day to that provider's consumer users, per primary domain (Gmail: permanent once crossed) |
| Spam-rate targets | <0.1% target; 0.3% hard line (Gmail, Yahoo) |
| Unsubscribe processing | Gmail 48 h; Yahoo 2 days; CAN-SPAM 10 business days; CASL 10 business days; AU 5 business days |
| DKIM key | ≥1024 bits, 2048 recommended |
| Workspace sending limits | 2,000/day per user (500 trial); 2,000 unique external recipients/day |
| Exchange Online limits | 10,000 recipients/24 h, 30 messages/min per mailbox |
| Safe cold volume | 30/mailbox/day (50 max); 2–3 mailboxes/domain; ≤100/domain/day |
| Domain age before first send | ≥14 days |
| Hunter credits | Finder/Domain Search 1 per email found; Verifier 0.5; Starter $49 for 2k, Growth $149 for 10k, Scale $299 for 25k |
| Hunter rate limits | Domain Search/Finder 15/s, 500/min; Verifier 10/s, 300/min; Discover 5/s, 50/min |
| Apollo API limits | 50–200/min; 600–6,000/day per endpoint by plan |
| Convex Node action | 10 min, 512 MiB, Lambda-hosted (port 25 blocked) |
| M365 SMTP Basic auth | Default-off for existing tenants end Dec 2026; final removal date announced H2 2027 |
| CASA Tier 2 | about $540–$5k+/yr, 2–8 weeks, annual |
| California data broker fee | $6,000 (2026); DROP every 45 days since 1 Aug 2026 |
| Cold reply benchmarks | average about 3.4–3.7%; top quartile 5.5%; top decile 10%+; 58% of replies from step 1 |
