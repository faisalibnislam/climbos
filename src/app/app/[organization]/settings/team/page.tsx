"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { TeamSettings } from "@/components/app/settings/TeamSettings";

export default function TeamSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <TeamSettings slug={organization} />
    </QueryBoundary>
  );
}
