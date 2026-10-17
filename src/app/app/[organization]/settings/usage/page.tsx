"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { UsageSettings } from "@/components/app/settings/UsageSettings";

export default function UsageSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <UsageSettings slug={organization} />
    </QueryBoundary>
  );
}
