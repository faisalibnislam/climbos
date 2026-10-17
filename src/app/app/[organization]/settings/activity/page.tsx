"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { ActivitySettings } from "@/components/app/settings/ActivitySettings";

export default function ActivitySettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <ActivitySettings slug={organization} />
    </QueryBoundary>
  );
}
