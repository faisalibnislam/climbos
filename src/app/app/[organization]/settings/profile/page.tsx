"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { ProfileSettings } from "@/components/app/settings/ProfileSettings";

export default function ProfileSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <ProfileSettings slug={organization} />
    </QueryBoundary>
  );
}
