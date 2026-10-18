"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Callout, Card, CardContent } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

/** Public unsubscribe page linked from every outbound email footer. One click, no sign-in. */
export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const unsubscribe = useMutation(api.outboundSending.unsubscribe);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <h1 className="heading-page">{done ? "You're unsubscribed" : "Unsubscribe"}</h1>
          {done ? (
            <p className="text-sm text-ink-2">You won&apos;t get any more emails from {done} about this.</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">Stop receiving these emails. This takes effect right away.</p>
              {error ? <Callout tone="danger">{error}</Callout> : null}
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await unsubscribe({ token });
                    setDone(r.company);
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Unsubscribe
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
