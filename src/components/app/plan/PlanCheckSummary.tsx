import { fixWhere, type PlanQuality } from "@shared/agents/quality";

/** Show the saved reason first; detailed checks remain available without opening the research view. */
export function PlanCheckSummary({ quality }: { quality: Pick<PlanQuality, "reasons" | "fixes"> }) {
  const reasons = quality.reasons.filter(reason => reason.trim());
  const fixes = quality.fixes ?? [];
  return <div className="space-y-2">
    <p>{reasons[0] ?? "No detailed explanation was saved for this version."}</p>
    {reasons.length > 1 || fixes.length ? <details>
      <summary className="min-h-9 cursor-pointer text-sm font-medium">What needs fixing</summary>
      <div className="space-y-2 pb-2 text-sm">
        {reasons.length > 1 ? <ul className="list-disc space-y-1 pl-5">{reasons.slice(1).map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul> : null}
        {fixes.length ? <ul className="list-disc space-y-1 pl-5">{fixes.map((fix, index) => <li key={`${index}:${fix.rule}:${fix.path}`}><span className="font-medium">{fixWhere(fix.path)}: </span>{fix.message}</li>)}</ul> : null}
      </div>
    </details> : null}
  </div>;
}
