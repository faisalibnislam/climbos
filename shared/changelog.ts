/** What's new in ClimbOS (newest first). Short, plain, owner-facing. */
export interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-18",
    title: "Your growth team got a lot bigger",
    items: [
      "Inbox: replies, bookings, website chats, leads and reviews in one place, with AI-drafted answers.",
      "Pipeline: everyone you're talking to, from first reply to won. Won deals count as revenue in Results.",
      "Website chat: one line of code; Climb AI answers from your facts and hands over to you.",
      "Landing pages: written from your facts, edited by you, live in a minute. Leads go to your Pipeline.",
      "Reviews: ask happy customers from your own mailbox and reply to reviews with AI drafts.",
      "Competitor watch: we read their homepage and pricing every Monday and tell you what really changed.",
      "Repurpose and translate: one piece becomes posts, threads, emails and video scripts, in 32 languages.",
      "A/B tests on landing page headlines and email subject lines, with the winner applied automatically.",
      "Tracked links that count real clicks, and a weekly CEO report every Monday.",
      "Brand kit with voice learning: your team learns from how you edit drafts.",
      "Phone app and notifications: install ClimbOS and approve from your home screen.",
      "Client reports for agencies, in your own brand.",
      "Direct publishing to LinkedIn and X.",
      "Refer a friend: you both get 200 credits when they buy a package.",
    ],
  },
  {
    date: "2026-10-17",
    title: "Credits, packages and Climb AI Expert",
    items: [
      "Simple credits shared across your workspaces, with top-ups that last 12 months.",
      "Climb AI Expert for deeper plans, insights and ads on any package.",
      "Retry a job from where it stopped, without starting over.",
      "Reels: short vertical videos from your own screenshots and photos.",
    ],
  },
];
