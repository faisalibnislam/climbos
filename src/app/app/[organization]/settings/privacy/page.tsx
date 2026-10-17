"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { PrivacySettings } from "@/components/app/settings/PrivacySettings";

export default function PrivacySettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <PrivacySettings slug={organization} />
    </QueryBoundary>
  );
}
