"use client";

import { useParams } from "next/navigation";
import { ForecastDetail } from "@/components/app/results/ForecastDetail";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";

/** One forecast: history + projection, status, backtest evidence and held-out coverage. */
export default function ForecastPage() {
  const { organization, forecastId } = useParams<{ organization: string; forecastId: string }>();
  return (
    <QueryBoundary>
      <ForecastDetail slug={organization} forecastId={forecastId} />
    </QueryBoundary>
  );
}
