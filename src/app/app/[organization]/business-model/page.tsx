"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { useCostDisplay } from "@/components/app/useCostDisplay";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { BusinessModelCheckView } from "@/components/app/plan/BusinessModelCheckView";
import { Button, Callout, EmptyState, toast } from "@/components/ui";

/** Business model check: is the way this business makes money holding up, and which alternatives are worth a small test? */
export default function BusinessModelPage() {
  const fmt = useCostDisplay();
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.businessModel.latest, { slug });
  const estimate = useQuery(api.businessModel.estimate, { slug });
  const start = useMutation(api.businessModel.start);
  const recordTest = useMutation(api.businessModel.recordTest);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await start({ slug });
      toast({ tone: "success", title: "Business model check started" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const action = data?.canEdit ? (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={run} disabled={busy || Boolean(data.running)}>{data.running ? "Checking…" : data.result ? "Check again" : "Check my business model"}</Button>
      {estimate ? <span className="text-xs text-ink-3">Up to {fmt.upTo(estimate.maxCostMicros)}</span> : null}
    </div>
  ) : null;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader section="business-model" title="Business model check" intro="Plus three other models worth a small test." actions={action} />
      {data === undefined ? <LoadingBlock label="Loading business model check…" lines={4} /> : null}
      {data?.running ? <Callout tone="info" title="Check in progress">Reading your records and the market. This page updates when done.</Callout> : null}
      {data && !data.result && !data.running ? <EmptyState title="No business model check yet" body="Run one to see how your model holds up, with three alternatives." /> : null}
      {data?.result ? (
        <BusinessModelCheckView
          check={data.result.check}
          createdAt={data.result.createdAt}
          isFixture={data.result.isFixture}
          tests={data.result.tests}
          canEdit={data.canEdit}
          onRecord={(draft) => recordTest({ slug, runId: data.result!.runId, ...draft }).then(() => toast({ tone: "success", title: "Test result saved" }), (e) => toast({ tone: "danger", title: errorMessage(e) }))}
        />
      ) : null}
    </div>
  );
}
