type TrendEvidence = {
  sourceUrl: string;
  observationDate: string;
  observation: string;
  retrievedAt?: number;
};

export function TrendEvidenceNote({ evidence }: { evidence: TrendEvidence }) {
  const retrieved = evidence.retrievedAt === undefined ? null : new Date(evidence.retrievedAt);
  const retrievedIso = retrieved && Number.isFinite(retrieved.getTime()) ? retrieved.toISOString() : null;
  let sourceUrl: string | null = null;
  try {
    const url = new URL(evidence.sourceUrl);
    if (["http:", "https:"].includes(url.protocol)) sourceUrl = url.href;
  } catch { /* Older drafts can contain incomplete source information. */ }
  return (
    <section aria-label="Trend evidence" className="rounded-[var(--radius-control)] bg-surface-2 p-3">
      <p className="text-xs font-medium text-ink-2">Trend evidence</p>
      <p className="mt-1 text-xs text-ink-3">
        Source observation dated <time dateTime={evidence.observationDate}>{evidence.observationDate}</time>
      </p>
      <p className="mt-1 text-xs text-ink-3">
        {retrievedIso ? <>Research retrieved <time dateTime={retrievedIso}>{retrievedIso.slice(0, 16).replace("T", " ")} UTC</time></> : "Research retrieval time was not recorded for this draft."}
        {sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Read source</a></>}
      </p>
      <p className="mt-1 text-sm text-ink">{evidence.observation}</p>
      <p className="mt-1 text-xs text-ink-3">This does not prove the trend will fit your audience or improve results.</p>
    </section>
  );
}
