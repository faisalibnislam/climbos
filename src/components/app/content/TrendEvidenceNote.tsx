type TrendEvidence = {
  sourceUrl: string;
  observationDate: string;
  observation: string;
};

export function TrendEvidenceNote({ evidence }: { evidence: TrendEvidence }) {
  return (
    <section aria-label="Trend evidence" className="rounded-[var(--radius-control)] bg-surface-2 p-3">
      <p className="text-xs font-medium text-ink-2">Trend evidence from the research</p>
      <p className="mt-1 text-xs text-ink-3">
        Source reported this on <time dateTime={evidence.observationDate}>{evidence.observationDate}</time>
      </p>
      <p className="mt-1 text-sm text-ink">{evidence.observation}</p>
      <p className="mt-1 text-xs text-ink-3">This does not prove the trend will fit your audience or improve results.</p>
    </section>
  );
}
