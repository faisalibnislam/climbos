"use client";

import { useParams } from "next/navigation";
import { ConnectionsView } from "@/components/app/connections/ConnectionsView";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";

/** Connections: per-capability states (not a single "connected" flag), connect/disconnect, uploads. */
export default function ConnectionsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <ConnectionsView slug={organization} />
    </QueryBoundary>
  );
}
