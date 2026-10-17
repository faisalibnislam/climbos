"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button, Callout, Card, CardContent } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const accept = useMutation(api.settings.acceptInvite);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-8">
          <Logo />
          <h1 className="font-display text-2xl">You’re invited to a ClimbOS workspace</h1>
          {error && <Callout tone="danger">{error}</Callout>}
          {isLoading ? null : isAuthenticated ? (
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { slug } = await accept({ token });
                  router.replace(`/app/${slug}/today`);
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Accept invitation
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>
            </Button>
          )}
          <p className="text-sm text-ink-3">Sign in with the email address the invitation was sent to.</p>
        </CardContent>
      </Card>
    </main>
  );
}
