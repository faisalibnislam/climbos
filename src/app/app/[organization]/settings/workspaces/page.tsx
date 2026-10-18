"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { WorkspacesSettings } from "@/components/app/settings/WorkspacesSettings";

export default function WorkspacesSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <WorkspacesSettings slug={organization} />
    </QueryBoundary>
  );
}
