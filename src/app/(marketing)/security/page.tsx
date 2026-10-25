import type { Metadata } from "next";
import Link from "next/link";
import { CURRENT_ENTITLEMENTS } from "@shared/economics";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Security and data handling",
  description: "How ClimbOS keeps you in control: approvals, spending limits, encrypted account connections, data export and deletion, and what we don't do yet.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  const r = CURRENT_ENTITLEMENTS.retentionDays;
  return (
    <LegalPage
      title="Security and your data"
      updated="17 October 2026"
      intro="An honest summary of how ClimbOS protects your business, your accounts and your money — including what isn't in place yet."
    >
      <h2>You stay in control</h2>
      <ul>
        <li>
          <strong>Approval before anything goes live.</strong> Posts, ads, emails and page changes wait for your OK. On plans with
          recurring campaigns, you approve the campaign and its rules first, and ClimbOS stays inside them.
        </li>
        <li>
          <strong>Pause all activity.</strong> One button stops publishing, sending and ad changes across your workspace.
        </li>
        <li>
          <strong>Spending limits.</strong> Ad campaigns are created paused and launched only with your approval, within the budget
          you set. Ad spend is paid directly to Google or Meta from your own ad account.
        </li>
        <li>
          <strong>Activity log.</strong> Actions taken by ClimbOS and your team are recorded in plain language, so you can see what
          happened and why.
        </li>
      </ul>

      <h2>Signing in</h2>
      <p>
        You sign in with a one-time code sent to your email (codes expire after 15 minutes) or, where enabled, with Google. ClimbOS
        doesn&apos;t ask you to create a password, so there&apos;s no ClimbOS password to leak or reuse.
      </p>

      <h2>Connected accounts</h2>
      <ul>
        <li>Accounts like Facebook, Instagram, Google Ads and your email provider are connected through their official sign-in screens. We never ask for your passwords to those services.</li>
        <li>We ask only for the permissions a feature needs, and access tokens are stored encrypted.</li>
        <li>You can disconnect any account at any time, from ClimbOS or from the platform itself.</li>
      </ul>

      <h2>Keeping workspaces separate</h2>
      <p>
        Every request to our backend checks who you are and whether you belong to the workspace you&apos;re asking about. One
        business can&apos;t see another&apos;s data.
      </p>

      <h2>Your data</h2>
      <ul>
        <li>You can export your workspace data or delete it at any time.</li>
        <li>We never sell your data.</li>
        <li>
          We keep detailed technical records (like raw website snapshots) for up to {r.rawPayloads} days, detailed activity for up to{" "}
          {r.detailedActivity} days, and summary numbers for up to {r.aggregates} days so you can compare results over time.
        </li>
        <li>
          Product analytics, where enabled, are configured not to record sessions and to mask on-screen text, so your business data
          isn&apos;t captured.
        </li>
      </ul>

      <h2>The free website preview</h2>
      <p>
        The preview on our homepage reads only your public homepage. We don&apos;t store visitors&apos; IP addresses — only a one-way
        hash used to prevent abuse. We record when the first snapshot and completed ideas are ready. You may optionally send one
        usefulness response for a completed preview; it is stored with that preview and shown only in aggregate. Previews expire from
        public access after 7 days and are deleted within 30 days.
      </p>

      <h2>Service providers</h2>
      <p>
        Like most software, ClimbOS relies on trusted providers for hosting and our database, sending email, payments and AI models.
        They process data only to provide their service to us. A full list of these providers will be published here before general
        availability.
      </p>

      <h2>What isn&apos;t in place yet</h2>
      <p>
        ClimbOS is new. We don&apos;t yet hold formal certifications such as SOC 2 or ISO 27001. If your organization needs them, or
        needs SSO or a service-level agreement, contact us and we&apos;ll be straightforward about what we can offer today.
      </p>

      <h2>Reporting a security issue</h2>
      <p>
        If you think you&apos;ve found a security problem, please email <a href="mailto:hello@climbos.app">hello@climbos.app</a> with
        the subject &ldquo;Security&rdquo;. Please don&apos;t access other people&apos;s data while testing. We&apos;ll reply and keep
        you updated.
      </p>
      <p>
        See also our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.
      </p>
    </LegalPage>
  );
}
