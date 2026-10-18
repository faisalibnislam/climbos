"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { FlaskConical } from "lucide-react";
import { errorMessage } from "../errors";
import { relativeTime } from "../money";
import { Badge, Button, Card, CardContent, EmptyState, Progress, toast } from "@/components/ui";

const AGENT = { growth_plays: "Growth plays", growth_strategy: "Growth plan", business_insights: "Insights", channel_fit: "Channel fit" } as Record<string, string>;
const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** Engine lab: rules learned from reviews; test on the Formkit case, approve to ship. */
export function EngineLab() {
  const d = useQuery(api.engineLab.overview, {});
  const test = useMutation(api.engineLab.test);
  const decide = useMutation(api.engineLab.decide);
  if (!d) return null;
  const run = (fn: () => Promise<unknown>, ok: string) => fn().then(() => toast({ tone: "success", title: ok }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  const open = d.proposals.filter((p) => p.status !== "approved");
  const live = d.proposals.filter((p) => p.status === "approved");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading-page">Engine lab</h1>
        <p className="text-sm text-ink-3">Every Tuesday the engine proposes rules from what reviewers flagged on real plans. Test, then approve to ship.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="flex justify-between text-sm">
            <span className="font-medium text-ink">Lab budget this month</span>
            <span className="tabular-nums text-ink-2">
              {usd(d.spentMicros)} / {usd(d.capMicros)}
            </span>
          </p>
          <Progress value={Math.min(100, (d.spentMicros / d.capMicros) * 100)} label="Lab budget used" />
        </CardContent>
      </Card>
      {d.health.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="heading-section">Engine health, last 14 days</h2>
          <Card>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Agent</th>
                    <th className="py-1 pr-3 font-medium">Runs</th>
                    <th className="py-1 pr-3 font-medium">Check errors, draft → final</th>
                    <th className="py-1 pr-3 font-medium">Untraced numbers</th>
                    <th className="py-1 pr-3 font-medium">Numbers lost in revision</th>
                    <th className="py-1 font-medium">Shipped</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-ink-2">
                  {d.health.map((h) => (
                    <tr key={`${h.agent}-${h.mode}`} className="border-t border-line">
                      <td className="py-1.5 pr-3 text-ink">
                        {AGENT[h.agent] ?? h.agent} <span className="text-xs text-ink-3">{h.mode}</span>
                      </td>
                      <td className="py-1.5 pr-3">{h.runs}</td>
                      <td className="py-1.5 pr-3">
                        {h.draftErrors} → {h.finalErrors}
                      </td>
                      <td className="py-1.5 pr-3">{h.inventedFinal}</td>
                      <td className="py-1.5 pr-3">{h.numbersDropped}</td>
                      <td className="py-1.5">{h.shipRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="heading-section">Proposals</h2>
        {open.length === 0 ? (
          <EmptyState icon={<FlaskConical />} title="No proposals yet" body="They appear once real plans have enough reviewer feedback." />
        ) : (
          open.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-2">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{AGENT[p.agentId] ?? p.agentId}</span>
                  <span className="text-xs text-ink-3">{relativeTime(p.createdAt)}</span>
                </p>
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-ink-2">{p.rules}</pre>
                {p.rationale ? <p className="text-xs text-ink-3">Why: {p.rationale}</p> : null}
                {p.test ? (
                  <p className="text-sm text-ink-2">
                    {p.status === "testing" ? "Testing… " : ""}
                    {p.test.baseline !== undefined ? `Now ${p.test.baseline.toFixed(2)}` : ""}
                    {p.test.variant !== undefined ? ` → with rules ${p.test.variant.toFixed(2)}` : ""} (review score, 1–5) · {usd(p.test.costMicros)}
                    {p.test.error ? <span className="text-red-800"> · {p.test.error}</span> : null}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {p.agentId === "growth_plays" && p.status === "proposed" ? (
                    <Button size="sm" variant="secondary" onClick={() => run(() => test({ id: p.id }), "Testing on the Formkit case (≈$0.30)")}>
                      Test (≈$0.30)
                    </Button>
                  ) : null}
                  <Button size="sm" disabled={p.status === "testing"} onClick={() => run(() => decide({ id: p.id, decision: "approved" }), "Approved: live in the next plan")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" disabled={p.status === "testing"} onClick={() => run(() => decide({ id: p.id, decision: "rejected" }), "Rejected")}>
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-section">Live rules</h2>
        {live.length === 0 ? <p className="text-sm text-ink-3">None yet.</p> : null}
        {live.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-2">
              <p className="flex items-center gap-2">
                <Badge tone="green">Live</Badge> <span className="font-medium text-ink">{AGENT[p.agentId] ?? p.agentId}</span>
              </p>
              <pre className="whitespace-pre-wrap text-sm text-ink-2">{p.rules}</pre>
              <Button size="sm" variant="ghost" className="self-start" onClick={() => run(() => decide({ id: p.id, decision: "retired" }), "Retired")}>
                Retire
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="heading-section">Quality on real plans</h2>
        <p className="text-xs text-ink-3">Average first-review score (1–5) per week.</p>
        {d.trend.length ? (
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="py-1">Week</th>
                <th>Agent</th>
                <th>Score</th>
                <th>Plans</th>
              </tr>
            </thead>
            <tbody>
              {d.trend.map((r) => (
                <tr key={`${r.agent}-${r.week}`} className="border-t border-line">
                  <td className="py-1">{r.week}</td>
                  <td>{AGENT[r.agent]}</td>
                  <td className="tabular-nums">{r.score.toFixed(2)}</td>
                  <td className="tabular-nums">{r.plans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-3">No reviewed plans yet.</p>
        )}
      </section>
    </div>
  );
}
