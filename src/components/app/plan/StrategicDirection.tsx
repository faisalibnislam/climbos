import type { StrategicDirection } from "../../../../shared/agents/strategicDirection";
import { StrategicDirectionSchema } from "../../../../shared/agents/strategicDirection";
import { Card, CardContent } from "@/components/ui";
import { Compass } from "@/components/icons";
import { PlanSection } from "./PlanSections";

/** Older saved plans remain readable without fabricating a missing direction. */
export function StrategicDirectionPanel({ direction }: { direction: unknown }) {
  const parsed = StrategicDirectionSchema.safeParse(direction);
  if (!parsed.success) return null;
  return <Direction direction={parsed.data} />;
}

function Direction({ direction: d }: { direction: StrategicDirection }) {
  return (
    <PlanSection id="strategic-direction" title="Where your business could go" icon={Compass} navLabel="Why this plan" bare>
      <Card className="border-brand-200 bg-brand-50">
        <CardContent className="flex flex-col gap-4">
          <p className="heading-section">{d.ambition}</p>
          <p className="text-sm text-ink-2">A longer-term idea for {d.horizon}. We start small and change it as we learn.</p>
          <dl className="space-y-4">
            <div><dt className="font-semibold">Who we want to reach</dt><dd className="mt-1 text-ui text-ink">{d.customer}</dd><dd className="mt-1 text-sm text-ink-2">{d.unmetNeed}</dd></div>
            <div><dt className="font-semibold">Why they would choose you</dt><dd className="mt-1 text-ui text-ink">{d.winningApproach}</dd><dd className="mt-1 text-sm text-ink-2">{d.whyThisBusiness}</dd></div>
            <div><dt className="font-semibold">How this could grow</dt><dd className="mt-1 text-ui text-ink">{d.compoundingAdvantage}</dd><dd className="mt-1 text-sm text-ink-2">{d.nextHorizon}</dd></div>
          </dl>
          <p className="text-xs text-ink-3">A proposed direction to test. The ambition is not a forecast or a promised result.</p>
          <details className="border-t border-brand-200 pt-3">
            <summary className="min-h-9 cursor-pointer text-sm font-medium text-brand-900">What we are assuming and when to change course</summary>
            <dl className="mt-3 grid gap-4 text-ui sm:grid-cols-2">




              <div><dt className="font-medium">What can wait</dt><dd><ul className="mt-1 list-disc pl-5 text-ink-2">{d.notNow.map((item, i) => <li key={i}>{item}</li>)}</ul></dd></div>
              <div><dt className="font-medium">Assumptions to check</dt><dd><ul className="mt-1 list-disc pl-5 text-ink-2">{d.assumptions.map((item, i) => <li key={i}>{item}</li>)}</ul></dd></div>
              <div className="sm:col-span-2"><dt className="font-medium">When to change direction</dt><dd className="mt-1 text-ink-2">{d.changeCourseIf}</dd></div>
            </dl>
            {d.evidenceRefs.length ? <ul className="mt-3 flex flex-wrap gap-3 text-xs text-ink-3" aria-label="Direction evidence">{d.evidenceRefs.map((ref) => <li key={ref}>{/^https?:\/\//i.test(ref) ? <a href={ref} className="text-link underline" target="_blank" rel="noreferrer">Source</a> : `Business evidence ${ref.replace(/^fact:/i, "")}`}</li>)}</ul> : <p className="mt-3 text-xs text-ink-3">No direct evidence cited; treat this direction as a hypothesis.</p>}
          </details>
        </CardContent>
      </Card>
    </PlanSection>
  );
}
