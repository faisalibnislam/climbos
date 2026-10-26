/** Choices shared by onboarding and Settings → Business & goal. */

export type BusinessType = "saas" | "ecommerce" | "services" | "physical_products" | "other";
export type GoalKind = "more_sales" | "more_customers" | "more_reach" | "custom";

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "saas", label: "Software or an app" },
  { value: "ecommerce", label: "Online store" },
  { value: "services", label: "Services or appointments" },
  { value: "physical_products", label: "Physical products" },
  { value: "other", label: "Something else" },
];

export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "SGD", "AED"].map((c) => ({ value: c, label: c }));

export const HORIZON_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
];

export const REVIEW_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => ({ value: d, label: d }));

export const GOAL_KIND_OPTIONS: { value: GoalKind; title: string; description: string; icon: string }[] = [
  { value: "more_customers", title: "More customers", description: "Help more people become customers", icon: "🙋" },
  { value: "more_sales", title: "More sales", description: "Get more purchases or orders", icon: "💰" },
  { value: "more_reach", title: "Help people find me", description: "Introduce your business to more people", icon: "📣" },
  { value: "custom", title: "Something else", description: "Your own words", icon: "✏️" },
];

/** A ready-made goal sentence for each kind. */
export function goalDefaults(name: string): Record<GoalKind, string> {
  return {
    more_customers: `Help ${name} get more paying customers.`,
    more_sales: `Help ${name} sell more to the right people.`,
    more_reach: `Help more of the right people discover ${name}.`,
    custom: "",
  };
}

/** Goal sentences tuned to the kind of business, shown as tap-to-add suggestions (no AI call). */
const TYPE_SUGGESTIONS: Record<string, string[]> = {
  saas: ["Get more free trials to become paying customers.", "Help new users reach their first useful result.", "Keep more customers from cancelling.", "Get more demo bookings from the right companies."],
  ecommerce: ["Get more repeat orders from past customers.", "Turn more store visitors into buyers.", "Raise the average order value.", "Bring back people who left items in their cart."],
  services: ["Get more booked appointments each week.", "Fill quiet days and slow weeks.", "Get more referrals from happy clients.", "Win more local customers nearby."],
  physical_products: ["Get more stores to stock my products.", "Sell more online as well as in person.", "Get more repeat buyers.", "Launch a new product to existing customers."],
  other: ["Get more enquiries from the right people.", "Win back past customers.", "Build a steady flow of new customers."],
};

const KIND_SUGGESTIONS: Record<GoalKind, string[]> = {
  more_customers: ["Win more first-time customers."],
  more_sales: ["Sell more to the customers I already have."],
  more_reach: ["Get found more often on Google and AI answers.", "Grow a following that turns into customers."],
  custom: [],
};

/** Up to eight suggestions for this business: its type first, then the chosen goal types, then local reach for local businesses. */
export function goalSuggestions({ businessType, kinds, local }: { businessType?: string | null; kinds: GoalKind[]; local?: boolean }): string[] {
  const out = [
    ...(TYPE_SUGGESTIONS[businessType ?? "other"] ?? TYPE_SUGGESTIONS.other),
    ...kinds.flatMap((k) => KIND_SUGGESTIONS[k] ?? []),
    ...(local ? ["Become the first choice nearby."] : []),
  ];
  return [...new Set(out)].slice(0, 8);
}

/** Add or remove one suggestion sentence in the owner's goal text, leaving the rest of their words as written. */
export function toggleGoalSentence(text: string, sentence: string): string {
  const current = text.trim();
  if (current.includes(sentence)) return current.replace(sentence, "").replace(/\s{2,}/g, " ").trim();
  return current ? `${current}${/[.!?]$/.test(current) ? "" : "."} ${sentence}` : sentence;
}

/** Sensible starting success events per business type (owner confirms before use). */
export function defaultEvents(type: string) {
  const ev = (key: string, label: string, definition: string) => ({ key, label, definition, confirmed: true });
  switch (type) {
    case "saas":
      return [ev("signup", "Sign-up", "A new account is created"), ev("activation", "First success", "A new account completes its first key action"), ev("paid_conversion", "Upgrade to paid", "An account starts a paid plan")];
    case "ecommerce":
    case "physical_products":
      return [ev("add_to_cart", "Add to cart", "A visitor adds a product to the cart"), ev("purchase", "Purchase", "A paid order is placed"), ev("repeat_purchase", "Repeat purchase", "A customer places a second order")];
    case "services":
      return [ev("inquiry", "An inquiry from someone you can help", "Someone asks about a service and fits your criteria"), ev("booking", "Booking", "A call or appointment is booked"), ev("closed", "New paying client", "A client signs or pays")];
    default:
      return [ev("lead", "Someone gets in touch", "Someone gets in touch or signs up"), ev("customer", "New customer", "Someone pays for the first time")];
  }
}
