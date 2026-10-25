"use client";

import { useState } from "react";
import { Badge, Button, Callout, Field, Select, Textarea, type Tone } from "@/components/ui";
import { EvidenceReferences } from "./EvidenceReferences";
import type { BusinessModelCheck } from "../../../../shared/agents/businessModel";

type Target = "deciding" | "grounded" | "adjacent" | "bold";
type TestState = "not_started" | "designed" | "run" | "observed";
type Evidence = "measured" | "owner_reported" | "unknown";
type Decision = "undecided" | "keep_current_model" | "keep_testing" | "adopt_alternative" | "drop_alternative";
export interface BusinessModelTestView { testState: TestState; outcomeNote: string | null; outcomeEvidence: Evidence; ownerDecision: Decision; createdAt: number }
export interface TestDraft { target: Target; testState: TestState; outcomeNote?: string; outcomeEvidence: Evidence; ownerDecision: Decision }

const VERDICT: Record<BusinessModelCheck["verdict"]["status"], { label: string; tone: Tone }> = {
  model_holding: { label: "Model holding up", tone: "green" },
  watch: { label: "Worth watching", tone: "amber" },
  at_risk: { label: "Model at risk", tone: "red" },
  insufficient_evidence: { label: "Not enough evidence", tone: "neutral" },
};
const DECISION: Record<BusinessModelCheck["recommendation"]["decision"], string> = {
  persist: "Keep the current model",
  adjust: "Adjust the current model",
  test_a_pivot: "Test a different model",
  insufficient_evidence: "Not enough evidence to decide",
};
const MODE: Record<Target, string> = { deciding: "Deciding test", grounded: "Grounded · established practice", adjacent: "Adjacent · evidence-supported stretch", bold: "Bold · may have no precedent" };
const DIRECTION: Record<BusinessModelCheck["marketSignals"][number]["direction"], string> = { headwind: "Headwind", tailwind: "Tailwind", neutral: "Neutral", unknown: "Direction unknown" };
const BASIS: Record<string, string> = { owner_report: "owner-reported", measured: "measured", research: "research", site_claim: "website claim", inference: "inference", assumption: "assumption", unknown: "unknown" };
const STATE_LABEL: Record<TestState, string> = { not_started: "Not started", designed: "Designed", run: "Running or run", observed: "Result observed" };
const DECISION_LABEL: Record<Decision, string> = { undecided: "Undecided", keep_current_model: "Keep the current model", keep_testing: "Keep testing", adopt_alternative: "Adopt this alternative", drop_alternative: "Drop this alternative" };
const label = (s: string) => s.replace(/_/g, " ");

/** Owner-recorded progress for one test; observed results need a note, evidence applies only to observed results. */
function TestRecorder({ target, saved, canEdit, onRecord }: { target: Target; saved?: BusinessModelTestView; canEdit: boolean; onRecord?: (draft: TestDraft) => Promise<unknown> }) {
  const [state, setState] = useState<TestState>(saved?.testState ?? "not_started");
  const [note, setNote] = useState(saved?.outcomeNote ?? "");
  const [evidence, setEvidence] = useState<Evidence>(saved?.outcomeEvidence ?? "unknown");
  const [decision, setDecision] = useState<Decision>(saved?.ownerDecision ?? "undecided");
  const [busy, setBusy] = useState(false);
  const decisions = (Object.keys(DECISION_LABEL) as Decision[]).filter((d) => target !== "deciding" || (d !== "adopt_alternative" && d !== "drop_alternative"));
  if (!canEdit) return saved ? <p className="text-xs text-ink-3">Test: {STATE_LABEL[saved.testState]} · {DECISION_LABEL[saved.ownerDecision]}{saved.outcomeNote ? ` · “${saved.outcomeNote}”` : ""} (owner-reported)</p> : null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-surface-2 p-2.5">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Test status"><Select options={(Object.keys(STATE_LABEL) as TestState[]).map((value) => ({ value, label: STATE_LABEL[value] }))} value={state} onValueChange={(v) => { setState(v as TestState); if (v !== "observed") setEvidence("unknown"); }} /></Field>
        <Field label="Evidence"><Select options={[{ value: "unknown", label: "Unknown" }, ...(state === "observed" ? [{ value: "owner_reported", label: "I observed it" }, { value: "measured", label: "Measured" }] : [])]} value={evidence} onValueChange={(v) => setEvidence(v as Evidence)} /></Field>
        <Field label="Your decision"><Select options={decisions.map((value) => ({ value, label: DECISION_LABEL[value] }))} value={decision} onValueChange={(v) => setDecision(v as Decision)} /></Field>
      </div>
      {state === "observed" ? <Field label="What happened"><Textarea value={note} maxLength={600} rows={2} autosize onChange={(e) => setNote(e.target.value)} placeholder="3 of 20 past customers asked to join" /></Field> : null}
      <div>
        <Button size="sm" variant="secondary" disabled={busy || !onRecord || (state === "observed" && !note.trim())} onClick={async () => {
          setBusy(true);
          try { await onRecord?.({ target, testState: state, ...(note.trim() && state === "observed" ? { outcomeNote: note.trim() } : {}), outcomeEvidence: evidence, ownerDecision: decision }); } finally { setBusy(false); }
        }}>Save test result</Button>
      </div>
    </div>
  );
}

/** The latest business model check: current model, market signals, labelled verdict, three alternatives, and the deciding test. */
export function BusinessModelCheckView({ check, createdAt, isFixture, tests, canEdit, onRecord }: { check: BusinessModelCheck; createdAt: number; isFixture?: boolean; tests: Partial<Record<Target, BusinessModelTestView>>; canEdit: boolean; onRecord?: (draft: TestDraft) => Promise<unknown> }) {
  const v = VERDICT[check.verdict.status];
  return (
    <div className="flex flex-col gap-4">
      {isFixture ? <Callout tone="info" title="Demo example">This check uses labelled demo data, not an analysis of a real business.</Callout> : null}
      <section aria-label="Current business model" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <h2 className="heading-card">How the business makes money today</h2>
        <p className="text-ui text-ink">{check.currentModel.summary}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-ink-3">Who pays</dt><dd className="text-ink">{check.currentModel.whoPays}</dd></div>
          <div><dt className="text-xs text-ink-3">What they buy</dt><dd className="text-ink">{check.currentModel.whatTheyBuy}</dd></div>
          <div><dt className="text-xs text-ink-3">Pricing</dt><dd className="text-ink">{label(check.currentModel.pricingStructure)}</dd></div>
          <div><dt className="text-xs text-ink-3">How it sells · delivery</dt><dd className="text-ink">{label(check.currentModel.salesMotion)} · {check.currentModel.delivery}</dd></div>
        </dl>
        <EvidenceReferences references={check.currentModel.evidenceRefs} />
      </section>

      <section aria-label="Verdict" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="heading-card">Is the model holding up?</h2>
          <Badge tone={v.tone}>{v.label}</Badge>
          <span className="text-xs text-ink-3">AI judgment · {check.verdict.confidence} confidence · {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <p className="text-ui text-ink">{check.verdict.reasoning}</p>
        <p className="text-xs text-ink-3">What would change this: {check.verdict.whatWouldChangeIt}</p>
        <p className="text-xs text-ink-3">This is the assistant&apos;s judgment from the evidence below, for you to review. It isn&apos;t a verified finding and doesn&apos;t change anything in your business.</p>
      </section>

      {check.marketSignals.length ? (
        <section aria-label="Market signals" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <h2 className="heading-card">What the market is doing</h2>
          <ul className="flex flex-col gap-3">
            {check.marketSignals.map((s, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium text-ink">{DIRECTION[s.direction]} · {label(s.dimension)}</span>
                <span className="text-ink-2">{s.finding}</span>
                <span className="text-xs text-ink-3">{BASIS[s.basis]}{s.observedAt ? ` · evidence from ${s.observedAt}` : ""} · limit: {s.limitation}</span>
                <EvidenceReferences references={s.evidenceRefs} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Alternative business models" className="flex flex-col gap-3">
        <h2 className="heading-card">Other ways to make money</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {check.alternatives.map((a) => (
            <article key={a.mode} className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <p className="text-xs font-medium text-ink-3">{MODE[a.mode]}</p>
              <h3 className="text-ui font-semibold text-ink">{a.name}</h3>
              <p className="text-sm text-ink-2">{a.modelChange}</p>
              <dl className="flex flex-col gap-1.5 text-xs">
                <div><dt className="text-ink-3">Why it could work</dt><dd className="text-ink">{a.mechanism}</dd></div>
                <div><dt className="text-ink-3">Reuses</dt><dd className="text-ink">{a.assetsUsed}</dd></div>
                <div><dt className="text-ink-3">Who pays · pricing</dt><dd className="text-ink">{a.whoPays} · {label(a.pricingStructure)}</dd></div>
                <div><dt className="text-ink-3">Convention it challenges</dt><dd className="text-ink">{a.conventionChallenged}</dd></div>
                <div><dt className="text-ink-3">What stays the same</dt><dd className="text-ink">{a.whatPersists}</dd></div>
                {a.unitEconomicsInputs.length ? <div><dt className="text-ink-3">Numbers it depends on</dt><dd className="text-ink"><ul className="list-disc pl-4">{a.unitEconomicsInputs.map((u, i) => <li key={i}>{u.input}: {u.value} <span className="text-ink-3">({BASIS[u.basis]})</span></li>)}</ul></dd></div> : null}
                {a.assumptions.length ? <div><dt className="text-ink-3">Assumptions</dt><dd className="text-ink"><ul className="list-disc pl-4">{a.assumptions.map((x, i) => <li key={i}>{x}</li>)}</ul></dd></div> : null}
                {a.risks.length ? <div><dt className="text-ink-3">Risks</dt><dd className="text-ink"><ul className="list-disc pl-4">{a.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></dd></div> : null}
              </dl>
              <p className="text-xs text-ink-3">Novelty {a.novelty} · evidence {a.evidenceStrength} · fit {a.businessFit} · feasibility {a.feasibility} · risk {a.risk} · {label(a.evidenceBasis)}</p>
              <EvidenceReferences references={a.evidenceRefs} />
              <div className="rounded-[var(--radius-control)] border border-line p-2.5 text-xs">
                <p className="font-medium text-ink">Smallest test: {a.smallestTest.test}</p>
                <p className="text-ink-2">Success: {a.smallestTest.successSignal} · Stop if: {a.smallestTest.stopCondition} · Limit: {a.smallestTest.maxCostOrTime}</p>
              </div>
              <TestRecorder target={a.mode} saved={tests[a.mode]} canEdit={canEdit} onRecord={onRecord} />
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Recommendation" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <h2 className="heading-card">Recommendation: {DECISION[check.recommendation.decision]}</h2>
        <p className="text-ui text-ink">{check.recommendation.rationale}</p>
        <p className="text-sm text-ink-2">Deciding test: {check.recommendation.decidingTest}{check.recommendation.recommendedAlternative ? ` (start with the ${check.recommendation.recommendedAlternative} option)` : ""}</p>
        <TestRecorder target="deciding" saved={tests.deciding} canEdit={canEdit} onRecord={onRecord} />
        {check.unknowns.length ? <p className="text-xs text-ink-3">Still unknown: {check.unknowns.join("; ")}</p> : null}
        <p className="text-xs text-ink-3">Nothing here changes your prices, offers or operations. Any change is your decision.</p>
      </section>
    </div>
  );
}
