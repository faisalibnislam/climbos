import type { Metadata } from "next";
import Link from "next/link";
import { CURRENT_ENTITLEMENTS } from "@shared/economics";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy (draft)",
  description: "A plain-English draft of how ClimbOS collects, uses and protects your information. Pending legal review.",
  alternates: { canonical: "/privacy" },
  robots: { index: false },
};

export default function PrivacyPage() {
  const r = CURRENT_ENTITLEMENTS.retentionDays;
  return (
    <LegalPage
      title="Privacy Policy"
      updated="25 October 2026"
      draft
      intro="This explains, in plain English, what information ClimbOS collects, why, and the choices you have."
    >
      <h2>Who we are</h2>
      <p>
        ClimbOS (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an AI growth service for small businesses at climbos.app. You can
        reach us at <a href="mailto:hello@climbos.app">hello@climbos.app</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your email address, name if you give it, and your sign-in method.
        </li>
        <li>
          <strong>Business information you share:</strong> your website, goals, brand details, and anything you type or upload.
        </li>
        <li>
          <strong>Information from accounts you connect:</strong> for example post performance from Facebook or Instagram, ad results
          from Google Ads or Meta, or contacts from your CRM or email provider — only what&apos;s needed for the features you use.
        </li>
        <li>
          <strong>Public information:</strong> pages from your website and publicly available information about your market and
          competitors.
        </li>
        <li>
          <strong>Billing information:</strong> handled by our payment provider. We don&apos;t store your full card number.
        </li>
        <li>
          <strong>Usage information:</strong> basic records of how the product is used, so we can keep it working and improve it.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide ClimbOS: researching your business, building your plan, creating work and measuring results.</li>
        <li>To publish or send things you&apos;ve approved, on the accounts you&apos;ve connected.</li>
        <li>To send you sign-in codes, approval requests, alerts and service messages.</li>
        <li>To keep the service secure, prevent abuse and meet legal obligations.</li>
        <li>
          To improve plans for everyone: we combine results (counts and rates, such as reply or sign-up rates) across businesses of the same type. These
          statistics never include names, messages, contacts or anything that identifies you, and are only used when at least five businesses contribute.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data.</li>
        <li>We don&apos;t sell or provide contact lists, and we don&apos;t add people to your lists without their agreement.</li>
        <li>We don&apos;t publish, send or spend anything on your behalf without your approval.</li>
      </ul>

      <h2>Contacts and customer data you bring</h2>
      <p>
        If you connect a CRM, upload a customer list or use email features, you&apos;re responsible for having the right to use that
        data and for people&apos;s consent to marketing. We process it only to provide ClimbOS to you, and marketing emails are sent
        through your own email provider with unsubscribes handled.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We use service providers for hosting and our database, email delivery, payments, product analytics and AI models. They may
        process your information only to provide their service to us. When you run a website audit, we send the public page URL being
        checked to Google PageSpeed Insights and, when configured, the Chrome UX Report API to retrieve mobile performance
        measurements. When you run a social content audit, we send a bounded sample of recent post text/captions, platform, post
        identifiers, timestamps, content type and available post links from ClimbOS and connected Facebook Pages or Instagram
        professional accounts to our AI provider for review. We do not download or analyze the post images or videos in this audit.
        LinkedIn post history is not read because this app does not have the required restricted permission. We read from the
        platforms you connect (such as Meta or Google) when you ask us to audit, publish, send or launch something there. We may
        disclose information if the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account information while your account is open. Detailed technical records are kept for up to {r.rawPayloads}{" "}
        days, detailed activity for up to {r.detailedActivity} days, and summary numbers for up to {r.aggregates} days. Free website
        previews expire after 7 days. When you delete your workspace, we delete its data, except where we must keep something for
        legal or billing reasons.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Export or delete your workspace data at any time.</li>
        <li>Disconnect any connected account at any time.</li>
        <li>Ask us to access, correct or delete your personal information by emailing hello@climbos.app.</li>
        <li>Depending on where you live, you may have additional rights. We&apos;ll honor them as the law requires.</li>
      </ul>

      <h2>Security</h2>
      <p>
        We protect your information with access checks on every request and encrypted storage of account connections. Read more on our{" "}
        <Link href="/security">Security page</Link>.
      </p>

      <h2>Children</h2>
      <p>ClimbOS is for businesses and isn&apos;t intended for anyone under 16.</p>

      <h2>Changes</h2>
      <p>If we make meaningful changes, we&apos;ll update this page and let account owners know before they take effect.</p>
    </LegalPage>
  );
}
