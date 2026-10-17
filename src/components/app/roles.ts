/** The ten ClimbOS roles as owners see them. */
export const ROLE_META: Record<string, { emoji: string; title: string; short: string; job: string }> = {
  ceo: { emoji: "🧠", title: "AI CEO", short: "CEO", job: "Understands your goal, sets priorities and coordinates the team" },
  coo: { emoji: "⚙️", title: "AI COO", short: "COO", job: "Turns requests into clear actions and runs the workflow" },
  cmo: { emoji: "📈", title: "AI CMO", short: "CMO", job: "Builds and runs your marketing strategy" },
  cso: { emoji: "💰", title: "AI CSO", short: "CSO", job: "Improves sales and conversion using leads you already have" },
  creative_director: { emoji: "🎨", title: "AI Creative Director", short: "Creative", job: "Concepts, graphics and ad creatives" },
  social_media_manager: { emoji: "📱", title: "AI Social Media Manager", short: "Social", job: "Creates, schedules and publishes posts" },
  ads_manager: { emoji: "🎯", title: "AI Ads Manager", short: "Ads", job: "Creates and monitors ads within your approved budget" },
  seo_specialist: { emoji: "🔍", title: "AI SEO Specialist", short: "SEO", job: "Search visibility and organic traffic" },
  data_analyst: { emoji: "📊", title: "AI Data Analyst", short: "Data", job: "Monitors results and explains what the numbers mean" },
  customer_success_manager: { emoji: "🤝", title: "AI Customer Success Manager", short: "Customers", job: "Retention, engagement and loyalty" },
};

export function roleTitle(key: string | null | undefined): string {
  return (key && ROLE_META[key]?.title) || "ClimbOS";
}

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube",
  google_search_ad: "Google search ad",
  meta_ad: "Meta ad",
  linkedin_ad: "LinkedIn ad",
  email: "Email",
  website: "Website",
  blog: "Blog / SEO page",
};

export const ARTIFACT_STATUS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" | "violet"; help: string }> = {
  draft: { label: "Draft", tone: "neutral", help: "Not sent for review yet." },
  in_review: { label: "Needs your approval", tone: "amber", help: "Nothing goes live until it's approved." },
  approved: { label: "Approved", tone: "green", help: "Approved. Not scheduled yet." },
  scheduled: { label: "Scheduled in ClimbOS", tone: "blue", help: "ClimbOS will send it at the scheduled time. The platform hasn't accepted it yet." },
  publishing: { label: "Sending…", tone: "blue", help: "Sending to the platform now." },
  published: { label: "Accepted by platform", tone: "green", help: "The platform confirmed it." },
  exported: { label: "Exported for manual posting", tone: "violet", help: "You copied or downloaded it. ClimbOS can't confirm it was posted." },
  failed: { label: "Didn't go out", tone: "red", help: "The platform didn't accept it. Nothing was posted." },
  uncertain: { label: "Outcome uncertain", tone: "amber", help: "We couldn't confirm whether it was posted, so we won't repeat it until it's checked." },
  archived: { label: "Archived", tone: "neutral", help: "Hidden from active lists." },
};
