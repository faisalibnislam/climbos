"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { ResultsView } from "@/components/app/results/ResultsView";

/** Results: business outcome → funnel → attribution → platform claims → forecasts → scenarios. */
export default function ResultsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <ResultsView slug={organization} />
    </QueryBoundary>
  );
}
