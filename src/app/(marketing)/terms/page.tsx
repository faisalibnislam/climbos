import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service (draft)",
  description: "A plain-English draft of the terms for using ClimbOS. Pending legal review.",
  alternates: { canonical: "/terms" },
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="17 October 2026"
      draft
      intro="These terms describe the agreement between you and ClimbOS when you use climbos.app. We've written them to be read, not skimmed past."
    >
      <h2>Using ClimbOS</h2>
      <p>
        ClimbOS helps you research, plan, create and measure growth work for your business. You need to be at least 16 and able to
        enter a contract for your business to use it.
      </p>

      <h2>Your account</h2>
      <p>
        Keep access to your email account secure, since sign-in codes are sent there. You&apos;re responsible for activity in your
        workspace, including by people you invite.
      </p>

      <h2>You approve what goes live</h2>
      <p>
        ClimbOS prepares work and asks for your approval before publishing, sending or launching it. Once you approve something, you
        are the publisher or sender of that content. Please review AI-generated work before approving it — it can contain mistakes.
      </p>

      <h2>Your content and data</h2>
      <p>
        You own the content and data you bring to ClimbOS and the work it creates for you. You give us permission to use them only to
        provide the service. You can export or delete your data at any time. See our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Connected platforms</h2>
      <p>
        When you connect accounts such as Facebook, Instagram, Google Ads or your email provider, their own terms and policies also
        apply. Some platforms review ads or posts before they run; their decisions are outside our control.
      </p>

      <h2>Credits, packages and payment</h2>
      <ul>
        <li>ClimbOS is free to use; the work your AI team does is paid for with credits. Each job shows the most it can use before it starts and charges only what it used.</li>
        <li>New accounts get 50 free credits once. Packages are billed monthly in US dollars; applicable sales tax or VAT may be added at checkout.</li>
        <li>Package credits reset at each renewal and don&apos;t carry over. Top-ups are one-time purchases for active packages; their credits last 12 months.</li>
        <li>When credits run out, new work pauses. We never charge for overages or buy credits for you automatically.</li>
        <li>
          Ad spend is paid directly by you to the ad platform, and your email provider bills you directly. These costs are not part
          of your ClimbOS plan, and we don&apos;t mark them up.
        </li>
        <li>You can change or cancel your plan from Settings → Billing.</li>
      </ul>

      <h2>No guaranteed results</h2>
      <p>
        Marketing outcomes depend on many things outside anyone&apos;s control. ClimbOS gives honest estimates and ranges, but we
        don&apos;t guarantee any particular result, revenue or ranking.
      </p>

      <h2>Acceptable use</h2>
      <p>Please don&apos;t use ClimbOS to:</p>
      <ul>
        <li>create fake reviews, testimonials or misleading claims;</li>
        <li>send messages to people who haven&apos;t agreed to hear from you, or buy and use contact lists without permission;</li>
        <li>break the law or the rules of the platforms you connect;</li>
        <li>infringe others&apos; rights, or attempt to access other workspaces or disrupt the service.</li>
      </ul>
      <p>We may pause activity or suspend accounts that break these rules, and we&apos;ll tell you why when we can.</p>

      <h2>Ending the agreement</h2>
      <p>
        You can stop using ClimbOS and delete your workspace at any time. We may end or suspend the service for serious or repeated
        breaches of these terms.
      </p>

      <h2>Liability</h2>
      <p>
        This section is being finalized with our legal advisers. Our intention is to be fair: we take responsibility for our own
        service, within reasonable limits that will be set out here.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If we change these terms in a meaningful way, we&apos;ll let account owners know before the change takes effect. Questions?
        Email <a href="mailto:hello@climbos.app">hello@climbos.app</a>.
      </p>
    </LegalPage>
  );
}
