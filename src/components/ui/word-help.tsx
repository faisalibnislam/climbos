export const BUSINESS_WORDS = [
  ["Campaign", "A set of posts, emails, or ads working toward one goal."],
  ["Lead or prospect", "Someone who might become a customer. This does not mean they have agreed to receive marketing."],
  ["Conversion", "An action you want someone to take, such as buying or booking."],
  ["Revenue", "Money from sales, before subtracting costs."],
  ["Profit", "What is left after the relevant costs are subtracted."],
  ["SEO", "Making your website easier for search engines and people to understand."],
  ["AI-search visibility", "Whether your business appears in the AI answers you check. These are samples, not a complete picture."],
  ["Audience", "The people you want to reach."],
  ["Channel", "A place to reach people, such as email, Google, or Instagram."],
  ["Retention", "How many customers continue using or paying for your product over time."],
  ["Funnel", "The steps people take from discovering your business to becoming customers."],
  ["Cohort", "A group of customers who started around the same time, compared over later periods."],
  ["SWOT", "A way to list strengths, weaknesses, opportunities, and risks."],
  ["CAC", "The relevant cost of getting a new customer. Check which costs a calculation includes."],
  ["LTV", "An estimate of customer value over time. Its meaning depends on the stated revenue, margin, and cost assumptions."],
  ["ROI and ROAS", "ROI compares a return with relevant costs. ROAS compares attributed sales with ad spending; it is not full profit or proof of cause."],
  ["Attribution", "Rules for linking a recorded result to a source. This does not prove that source caused it."],
  ["Forecast or scenario", "An estimate of what might happen, based on stated inputs. It is not a promised result."],
  ["Credits", "The allowance used for AI work. Check the estimate before starting. Advertising costs are separate."],
] as const;

/** Optional explanations stay available without crowding the main task. */
export function WordHelp() {
  return (
    <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink">What do these words mean?</summary>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {BUSINESS_WORDS.map(([word, meaning]) => (
          <div key={word}><dt className="text-ui font-medium text-ink">{word}</dt><dd className="mt-1 text-sm text-ink-3">{meaning}</dd></div>
        ))}
      </dl>
    </details>
  );
}
