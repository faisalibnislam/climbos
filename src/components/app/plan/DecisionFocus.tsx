type DecisionFocusFields = {
  primaryPlay?: string;
  supportingMove?: string;
  maintenanceWork?: string;
};

/** Shows the concrete next move saved with a structured plan decision. */
export function DecisionFocus({ focus, details = false }: { focus?: DecisionFocusFields | null; details?: boolean }) {
  const fields = details
    ? [
        ["Also do", focus?.supportingMove],
        ["Keep checking", focus?.maintenanceWork],
      ] as const
    : [["Start with", focus?.primaryPlay]] as const;
  const available = fields.filter(([, value]) => value?.trim());

  if (!available.length) return null;

  const rows = available.map(([label, value]) => (
        <div key={label}>
          <dt className="inline font-semibold text-ink">{label}: </dt>
          <dd className="inline text-ink-2">{value}</dd>
        </div>
      ));

  return details ? <dl className="flex flex-col gap-1 text-ui">{rows}</dl> : <>{rows}</>;
}
