import type { AiSearchProvider } from "@shared/aiSearch/visibility";

const PROVIDER: Record<AiSearchProvider, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", google_ai_overview: "Google AI Overview", other: "Other" };

/** What owner-checked AI answers got wrong about the business, so corrections can be targeted. Sampled, not platform-wide. */
export function AnswerAccuracyCard({ accuracy }: { accuracy: { byProvider: { provider: AiSearchProvider; checked: number; withErrors: number }[]; recentErrors: { provider: AiSearchProvider; query: string; checkedAt: number; incorrectClaim: string; correctFact: string }[] } }) {
  if (!accuracy.byProvider.length) return null;
  return (
    <section aria-label="Answer accuracy" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm">
      <h3 className="text-sm font-semibold text-ink">What AI answers say about you</h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
        {accuracy.byProvider.map((p) => <li key={p.provider}>{PROVIDER[p.provider]}: {p.withErrors} of {p.checked} checked answers had an error</li>)}
      </ul>
      {accuracy.recentErrors.length ? (
        <ul className="flex flex-col gap-2">
          {accuracy.recentErrors.map((e) => (
            <li key={`${e.provider}-${e.checkedAt}`} className="rounded-[var(--radius-control)] bg-surface-2 p-2.5">
              <p className="text-xs text-ink-3">{PROVIDER[e.provider]} · “{e.query}” · {new Date(e.checkedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              <p className="text-ink">Said: <q>{e.incorrectClaim}</q></p>
              <p className="text-ink-2">Correct: {e.correctFact}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-ink-3">Your own checks of sampled answers. Fixing the facts on your site and listings may help, but ClimbOS can&apos;t make an AI tool change its answer.</p>
    </section>
  );
}
