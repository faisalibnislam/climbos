/** Choices shared by onboarding and Settings → Business & goal. */

export type BusinessType = "saas" | "ecommerce" | "services" | "physical_products" | "other";
export type GoalKind = "more_sales" | "more_customers" | "more_reach" | "custom";

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "saas", label: "Software / app (subscriptions)" },
  { value: "ecommerce", label: "Online store" },
  { value: "services", label: "Services (bookings, clients)" },
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
  { value: "more_customers", title: "More customers", description: "New sign-ups or buyers", icon: "🙋" },
  { value: "more_sales", title: "More sales", description: "More revenue", icon: "💰" },
  { value: "more_reach", title: "More reach", description: "More awareness", icon: "📣" },
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
      return [ev("inquiry", "Qualified inquiry", "Someone asks about a service and fits your criteria"), ev("booking", "Booking", "A call or appointment is booked"), ev("closed", "Closed deal", "A client signs or pays")];
    default:
      return [ev("lead", "New lead", "Someone gets in touch or signs up"), ev("customer", "New customer", "Someone pays for the first time")];
  }
}
