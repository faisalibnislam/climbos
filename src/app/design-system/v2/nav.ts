/*
 * Design system navigation. Each item is a page; `elements` are the specimens on
 * that page (their anchors are slugify(name)), which ⌘K searches too.
 */
export interface NavItem {
  title: string;
  href: string;
  elements?: string[];
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/⌘/g, "cmd")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const B = "/design-system/v2";

export const NAV: NavGroup[] = [
  {
    title: "Start",
    items: [{ title: "Overview", href: B, elements: ["Principles", "Brand", "Marketing hero"] }],
  },
  {
    title: "Foundations",
    items: [
      { title: "Colour", href: `${B}/foundations/colour`, elements: ["Palette", "Chart colours", "Colour standard", "Contrast"] },
      { title: "Typography", href: `${B}/foundations/typography`, elements: ["Type hierarchy", "Voice", "Body font options"] },
      { title: "Icons", href: `${B}/foundations/icons`, elements: ["ClimbOS Sharp", "Icon sizes", "Icon grid"] },
      { title: "Layout & density", href: `${B}/foundations/layout`, elements: ["Spacing system", "Grid layouts", "Responsive breakpoints", "Density", "Dashboard structure"] },
      { title: "Shape & elevation", href: `${B}/foundations/shape`, elements: ["Corner radius", "Borders", "Dividers", "Background surfaces", "Surface elevation", "Shadows", "Focus rings"] },
      { title: "Motion", href: `${B}/foundations/motion`, elements: ["Durations", "Easing", "Microinteractions", "Reduced motion"] },
      { title: "States", href: `${B}/foundations/states`, elements: ["Design states", "Hover states", "Active states", "Selected states", "Disabled states", "Read-only", "Loading", "Dragging", "Drop target"] },
    ],
  },
  {
    title: "Components",
    items: [
      { title: "Navigation", href: `${B}/components/navigation`, elements: ["Primary sidebar", "Secondary sidebar", "Collapsible sidebar", "Top navigation bar", "Navigation groups", "Nested navigation", "Breadcrumbs", "Tab navigation", "Segmented controls", "Command menu", "Global search", "Recent pages", "Favorites", "Workspace switcher", "Organization switcher", "Project switcher", "Account switcher", "App launcher", "Navigation badges", "Sidebar footer", "Mobile bottom navigation", "Mobile navigation drawer"] },
      { title: "Buttons & actions", href: `${B}/components/actions`, elements: ["Button variants", "Icon-only button", "Split button", "Dropdown button", "Floating action button", "Toggle button", "Loading button", "Copy button", "Back button", "Close button", "Refresh button", "Expand / collapse button", "Add / remove button", "Save / cancel buttons", "Undo / redo buttons", "Bulk action toolbar", "Contextual action button", "Button groups", "Keyboard shortcut indicators"] },
      { title: "Forms", href: `${B}/components/forms`, elements: ["Text input", "Textarea", "Number input", "Email input", "Password input", "Search input", "Select dropdown", "Multi-select dropdown", "Combobox", "Autocomplete input", "Checkbox", "Radio button", "Toggle switch", "Date picker", "Date range picker", "Time picker", "Date-time picker", "Color picker", "File upload", "Drag-and-drop upload", "Slider", "Range slider", "Stepper input", "Tag input", "URL input", "Phone input", "Currency input", "Rich text editor", "Markdown editor", "Code editor", "OTP input", "Input with prefix / suffix", "Input with inline action", "Form validation message", "Character counter", "Field description", "Required field indicator", "Form section divider"] },
      { title: "Cards & containers", href: `${B}/components/containers`, elements: ["Standard content card", "KPI card", "Summary card", "Activity card", "Profile card", "Project card", "Task card", "Pricing card", "Integration card", "Feature card", "Notification card", "Status card", "Empty-state card", "Expandable card", "Selectable card", "Draggable card", "Card grid", "Card carousel", "Card with header and footer", "Bordered container", "Elevated container", "Collapsible section", "Accordion", "Panel", "Resizable panel", "Split-view container"] },
      { title: "Data display", href: `${B}/components/data`, elements: ["Data table", "Sortable table", "Filterable table", "Paginated table", "Editable table", "Expandable table rows", "Selectable table rows", "Sticky table header", "Column visibility controls", "Row actions", "List view", "Grid view", "Kanban board", "Calendar view", "Timeline view", "Gantt chart", "Tree view", "Description list", "Key-value pairs", "Data comparison", "JSON viewer", "Code viewer", "Diff viewer", "Audit log", "Activity feed", "Pagination"] },
      { title: "Charts & analytics", href: `${B}/components/charts`, elements: ["Bar chart", "Stacked bar chart", "Horizontal bar chart", "Area chart", "Donut chart", "Scatter plot", "Bubble chart", "Heatmap", "Calendar heatmap", "Funnel chart", "Cohort chart", "Retention chart", "Waterfall chart", "Radar chart", "Treemap", "Sankey diagram", "Histogram", "Gauge chart", "Progress ring", "KPI counter", "Trend indicator", "Comparison chart", "Forecast chart", "Goal progress chart", "Real-time chart", "Geographic map", "Chart legend", "Chart tooltip", "Chart annotation", "Chart date selector", "Chart metric selector", "Chart zoom controls", "Chart export action"] },
      { title: "Filters & search", href: `${B}/components/filters`, elements: ["Local search", "Search suggestions", "Recent searches", "Saved searches", "Advanced search", "Filter dropdown", "Filter sidebar", "Filter chips", "Multi-filter builder", "Date range filter", "Status filter", "Assignee filter", "Sort dropdown", "Sort direction control", "Group-by control", "Saved views", "Clear filters", "Active filter counter"] },
      { title: "Feedback & status", href: `${B}/components/feedback`, elements: ["Toast notification", "Alert banner", "Inline alert", "Confirmation dialog", "Loading spinner", "Skeleton loader", "Progress bar", "Circular progress", "Step progress", "Upload progress", "Processing status", "Sync status", "Connection status", "Online / offline indicator", "Status badge", "Status dot", "Notification badge", "Empty state", "No-results state", "Error state", "Maintenance state", "Retry action", "Unsaved changes indicator", "Auto-save indicator"] },
      { title: "Overlays", href: `${B}/components/overlays`, elements: ["Modal dialog", "Full-screen modal", "Side drawer", "Popover", "Tooltip", "Dropdown menu", "Context menu", "Command palette", "Action sheet", "Hover card", "Quick preview", "Lightbox", "Notification center", "Onboarding overlay"] },
      { title: "Users & accounts", href: `${B}/components/accounts`, elements: ["User avatar", "Avatar group", "User profile menu", "Team member list", "Invite member dialog", "Role selector", "Permission matrix", "Access control indicator", "User presence indicator", "Profile completion", "Verification badge", "Security settings", "API key management", "Connected accounts", "Session management"] },
      { title: "Dashboard", href: `${B}/components/dashboard`, elements: ["Welcome header", "Date range selector", "KPI overview", "Goal tracking", "Upcoming tasks", "Pending approvals", "Quick actions", "Recommendations", "Insights panel", "Alerts panel", "Announcements", "Customizable widgets", "Widget library", "Dashboard sharing", "Refresh indicator", "Last updated timestamp"] },
      { title: "Billing", href: `${B}/components/billing`, elements: ["Current plan card", "Plan comparison table", "Upgrade button", "Subscription status", "Billing cycle selector", "Payment method card", "Invoice history", "Usage meter", "Credit balance", "Quota progress bar", "Overage indicator", "Trial countdown", "Renewal date", "Cancellation flow", "Add-on selector", "Seat management", "Coupon input", "Payment confirmation"] },
      { title: "Collaboration", href: `${B}/components/collaboration`, elements: ["Comments", "Threaded comments", "Mentions", "Reactions", "Presence avatars", "Live editing indicator", "Version history", "Assignment selector", "Approval workflow", "Share dialog", "Public/private toggle", "Copy share link", "Conflict resolution indicator"] },
      { title: "AI", href: `${B}/components/ai`, elements: ["AI chat interface", "AI prompt input", "AI command bar", "AI assistant panel", "AI suggestion card", "AI-generated insights", "AI action preview", "AI execution timeline", "AI task queue", "AI agent status", "AI reasoning summary", "AI confidence indicator", "AI model selector", "AI automation toggle", "AI approval request", "AI content preview", "AI regenerate button", "AI prompt templates", "AI usage tracker", "AI cost breakdown", "AI anomaly alert", "AI source citations", "AI feedback controls", "AI memory controls", "AI tool permissions", "AI execution logs"] },
      { title: "Onboarding & help", href: `${B}/components/onboarding`, elements: ["Welcome screen", "Setup wizard", "Onboarding checklist", "Product tour", "Guided tooltip", "Feature spotlight", "Starter templates", "Setup completion indicator", "Contextual help", "Keyboard shortcut guide", "What's new panel", "Feature announcement", "Feedback widget", "Support chat"] },
    ],
  },
  {
    title: "Patterns",
    items: [
      { title: "Interactions", href: `${B}/patterns/interactions`, elements: ["Drag and drop", "Inline editing", "Multi-item selection", "Keyboard navigation", "Hover-reveal actions", "Reorderable lists", "Undo / redo", "Auto-save", "Optimistic updates", "Real-time updates", "Infinite scrolling", "Sticky action bars", "Progressive disclosure", "Conditional fields", "Multi-step forms", "Copy-to-clipboard feedback"] },
      { title: "Analytics showcase", href: `${B}/patterns/analytics`, elements: ["Analytics bento"] },
    ],
  },
  {
    title: "Screens",
    items: [
      { title: "Today", href: `${B}/screens/today`, elements: ["Today dashboard"] },
      { title: "Results", href: `${B}/screens/results`, elements: ["Results report"] },
      { title: "Mobile", href: `${B}/screens/mobile`, elements: ["Mobile screens"] },
      { title: "Component reference", href: `${B}/reference`, elements: ["Legacy reference"] },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
