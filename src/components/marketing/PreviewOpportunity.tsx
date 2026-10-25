import { ExternalLink } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export interface PreviewOpportunityData {
  observation: string;
  evidenceQuote: string;
  whyItMayMatter: string;
  firstStep: string;
  sourceUrl: string;
}

export function PreviewOpportunity({ finding }: { finding: PreviewOpportunityData }) {
  return (
    <section className="mt-5 rounded-xl border border-line bg-surface p-4 animate-step-in" aria-label="Preliminary opportunity">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-overline">Possible opportunity to check</h3>
        <Badge tone="neutral">Preliminary</Badge>
      </div>
      <p className="mt-2 heading-card">{finding.observation}</p>
      <blockquote className="mt-3 border-l-2 border-brand-600 pl-3 text-sm italic text-ink-2">
        “{finding.evidenceQuote}”
      </blockquote>
      <a
        href={finding.sourceUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-ui font-medium text-brand-800 underline underline-offset-4"
      >
        Check the homepage evidence
        <ExternalLink aria-hidden="true" className="size-3.5" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <p className="mt-3 text-sm text-ink-2"><span className="font-medium text-ink">Why it may matter: </span>{finding.whyItMayMatter}</p>
      <p className="mt-2 text-sm text-ink"><span className="font-medium">A small first step: </span>{finding.firstStep}</p>
      <p className="mt-3 text-xs text-ink-3">This is an AI interpretation of one homepage, not a confirmed business problem. Check it before acting.</p>
    </section>
  );
}
