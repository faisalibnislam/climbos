/** Customer language and route ownership in one place; legacy URLs stay valid. */
export type AppArea = "today" | "plan" | "channels" | "work" | "customers" | "results" | "tools";
export const PRIMARY_NAV = [
  { key: "today", label: "Home", description: "Ask for help and see what needs you." },
  { key: "plan", label: "Plan", description: "Your goal and what to focus on." },
  { key: "channels", label: "Channels", description: "Where to find customers and followers." },
  { key: "work", label: "Work", description: "Posts, emails, ads, images and pages." },
  { key: "customers", label: "Customers", description: "People, messages and reviews." },
  { key: "results", label: "Results", description: "What happened, in numbers." },
  { key: "tools", label: "More", description: "Every other tool." },
] as const;

export const APP_TOOLS: { key: string; label: string; description: string; area: AppArea; search: string }[] = [
  { key: "content", label: "Posts, emails & ads", description: "Drafts and your posting calendar.", area: "work", search: "content social calendar campaigns marketing" },
  { key: "autopilot", label: "Regular posting", description: "Repeat work with rules and approval limits.", area: "work", search: "autopilot automation schedule" },
  { key: "pages", label: "Pages for your offers", description: "Hosted pages where people get in touch.", area: "work", search: "landing website conversion" },
  { key: "images", label: "Images", description: "Pictures for posts and offers.", area: "work", search: "creative assets graphics" },
  { key: "reels", label: "Short videos", description: "Prepare short videos.", area: "work", search: "reels scripts video" },
  { key: "studio", label: "Design editor", description: "Edit graphics and layouts.", area: "work", search: "studio carousel creative" },
  { key: "outbound", label: "Find possible customers", description: "Find businesses and draft messages, with sources.", area: "customers", search: "outbound prospect leads sales outreach" },
  { key: "pipeline", label: "Customer progress", description: "Track people from first contact to sale.", area: "customers", search: "pipeline crm deals sales" },
  { key: "inbox", label: "Messages", description: "Read messages and draft replies.", area: "customers", search: "inbox inquiries conversations" },
  { key: "reviews", label: "Customer reviews", description: "Read feedback, draft replies, ask for reviews.", area: "customers", search: "reputation feedback" },
  { key: "chat", label: "Chat on your website", description: "Answer visitor questions and collect inquiries.", area: "customers", search: "widget chatbot customer support" },
  { key: "visibility", label: "Help people find you", description: "Check how search tools see your site.", area: "plan", search: "seo aeo geo ai visibility search console" },
  { key: "business-model", label: "Business model check", description: "Is the way you make money still working?", area: "plan", search: "business model pivot viability outdated pricing subscription strategy" },
  { key: "competitors", label: "Similar businesses", description: "Compare what others offer.", area: "plan", search: "competitors competitive research" },
  { key: "links", label: "Links & clicks", description: "Your links and their clicks.", area: "results", search: "tracking attribution bio" },
  { key: "connections", label: "Connected accounts", description: "Connect accounts and see what each can do.", area: "tools", search: "integrations setup oauth" },
];

export function appHref(slug: string, key: string) {
  if (key === "review") return `/app/${encodeURIComponent(slug)}/today#review`;
  return key === "studio" ? `/studio/${encodeURIComponent(slug)}` : `/app/${encodeURIComponent(slug)}/${key}`;
}

export function appArea(section: string): AppArea | "settings" {
  if (section === "settings" || section === "connections") return "settings";
  if (PRIMARY_NAV.some((item) => item.key === section)) return section as AppArea;
  return APP_TOOLS.find((tool) => tool.key === section)?.area ?? "today";
}

export function findTools(query: string, area?: AppArea) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return APP_TOOLS.filter((tool) => (!area || tool.area === area) && words.every((word) => `${tool.label} ${tool.description} ${tool.search}`.toLowerCase().includes(word)));
}
