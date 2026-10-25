/** Customer language and route ownership in one place; legacy URLs stay valid. */
export type AppArea = "today" | "plan" | "work" | "customers" | "results" | "tools";
export const PRIMARY_NAV = [
  { key: "today", label: "Home", description: "Ask for help and see your next step." },
  { key: "plan", label: "Your plan", description: "Decide what to focus on and why." },
  { key: "work", label: "Your work", description: "Make posts, emails, ads, images, and pages." },
  { key: "customers", label: "Customers", description: "Find people to reach and manage conversations." },
  { key: "results", label: "Results", description: "See what happened and what is still unknown." },
  { key: "tools", label: "All tools", description: "Find any tool, with a short explanation." },
] as const;

export const APP_TOOLS: { key: string; label: string; description: string; area: AppArea; search: string }[] = [
  { key: "content", label: "Posts, emails & ads", description: "Create drafts, check them, and see your posting calendar.", area: "work", search: "content social calendar campaigns marketing" },
  { key: "autopilot", label: "Regular posting", description: "Set up repeated work with clear rules and approval limits.", area: "work", search: "autopilot automation schedule" },
  { key: "pages", label: "Pages for your offers", description: "Make a ClimbOS-hosted page where people can learn more or get in touch.", area: "work", search: "landing website conversion" },
  { key: "images", label: "Images", description: "Create and reuse pictures for your posts and offers.", area: "work", search: "creative assets graphics" },
  { key: "reels", label: "Short videos", description: "Prepare short-video material using the available video tools.", area: "work", search: "reels scripts video" },
  { key: "studio", label: "Design editor", description: "Edit supported graphics and layouts.", area: "work", search: "studio carousel creative" },
  { key: "outbound", label: "Find possible customers", description: "Research relevant businesses and prepare messages with sources you can check.", area: "customers", search: "outbound prospect leads sales outreach" },
  { key: "pipeline", label: "Customer progress", description: "Keep track of people from first contact to a recorded sale or booking.", area: "customers", search: "pipeline crm deals sales" },
  { key: "inbox", label: "Messages", description: "Read available messages and prepare replies.", area: "customers", search: "inbox inquiries conversations" },
  { key: "reviews", label: "Customer reviews", description: "Review imported feedback and prepare responses or eligible invitations.", area: "customers", search: "reputation feedback" },
  { key: "chat", label: "Chat on your website", description: "Set up the visitor chat that answers questions and collects inquiries.", area: "customers", search: "widget chatbot customer support" },
  { key: "visibility", label: "Help people find you", description: "Check website search readiness and the search data you provide.", area: "plan", search: "seo aeo geo ai visibility search console" },
  { key: "business-model", label: "Business model check", description: "See whether the way you make money is holding up, with three alternatives to test.", area: "plan", search: "business model pivot viability outdated pricing subscription strategy" },
  { key: "competitors", label: "Similar businesses", description: "Research other businesses and compare what they offer.", area: "plan", search: "competitors competitive research" },
  { key: "links", label: "Links & clicks", description: "Manage links and inspect the clicks recorded for them.", area: "results", search: "tracking attribution bio" },
  { key: "connections", label: "Connected accounts", description: "Connect the accounts needed for a task and check what each can do.", area: "tools", search: "integrations setup oauth" },
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
