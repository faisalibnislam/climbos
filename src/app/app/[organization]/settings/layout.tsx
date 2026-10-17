"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsNav } from "@/components/app/settings/SettingsNav";

/** Settings frame: sub-navigation (Team, Billing, Policies, Activity, Usage, Privacy, Profile) + page. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { organization } = useParams<{ organization: string }>();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:gap-10">
      <SettingsNav slug={organization} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
