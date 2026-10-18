"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { buttonClasses, Button, Card, CardContent, Skeleton } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

/** The guest's private page for a booked call: cancel it or pick another time. */
export default function ManageBookingPage() {
  const { token } = useParams<{ token: string }>();
  const b = useQuery(api.bookings.manageView, { token });
  const cancel = useMutation(api.bookings.cancelByGuest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
          {b === undefined ? (
            <Skeleton className="h-32 w-full" />
          ) : b === null ? (
            <p className="text-sm text-ink-2">This link isn&apos;t valid.</p>
          ) : (
            <>
              <h1 className="heading-page">{b.status === "cancelled" ? "Call cancelled" : b.title}</h1>
              <p className="text-sm text-ink-2">
                {new Date(b.startAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} · {b.minutes} min · with {b.withName}
              </p>
              {error ? <p className="text-sm text-red-800">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <a href={b.rebookUrl} className={buttonClasses({ variant: b.status === "cancelled" ? "primary" : "secondary" })}>
                  Pick another time
                </a>
                {b.status === "confirmed" && !b.past ? (
                  <Button
                    variant="ghost"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await cancel({ token });
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel this call
                  </Button>
                ) : null}
              </div>
              {b.status === "confirmed" && !b.past ? <p className="text-xs text-ink-3">Booking a new time doesn&apos;t cancel this one, so cancel it if you won&apos;t make it.</p> : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
