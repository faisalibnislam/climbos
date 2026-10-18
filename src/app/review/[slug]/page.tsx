"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, Star } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses, Card, CardContent, Skeleton, Textarea } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";

/**
 * Public review page. Everyone gets the same "Leave a review" button (no
 * filtering of unhappy customers); a private note to the owner is optional.
 */
export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useSearchParams().get("t") ?? undefined;
  const page = useQuery(api.reviews.publicPage, { slug });
  const opened = useMutation(api.reviews.opened);
  const feedback = useMutation(api.reviews.privateFeedback);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          {page === undefined ? (
            <Skeleton className="h-40 w-full" />
          ) : page === null ? (
            <p className="text-sm text-ink-2">This page isn&apos;t available.</p>
          ) : (
            <>
              <div>
                <h1 className="heading-page">How was {page.name}?</h1>
                <p className="mt-1 text-sm text-ink-3">A short review helps others find us. Thank you!</p>
              </div>
              <a href={page.reviewUrl} target="_blank" rel="noopener noreferrer" onClick={() => void opened({ slug, t })} className={buttonClasses({ className: "w-full" })}>
                Leave a review <ExternalLink aria-hidden />
              </a>
              <div className="border-t border-line pt-5">
                {sent ? (
                  <p className="text-sm text-ink-2">Thanks, your note went straight to the team.</p>
                ) : (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError(null);
                      try {
                        await feedback({ slug, t, text, rating: rating || undefined });
                        setSent(true);
                      } catch (err) {
                        setError(errorMessage(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <p className="text-sm font-medium text-ink">Or tell us privately</p>
                    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className="rounded p-0.5">
                          <Star className={cn("size-6", n <= rating ? "fill-amber-400 text-amber-500" : "text-ink-3")} aria-hidden />
                        </button>
                      ))}
                    </div>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autosize aria-label="Your note" placeholder="What went well, or what could be better?" />
                    {error ? <p className="text-sm text-red-800">{error}</p> : null}
                    <Button type="submit" variant="secondary" loading={busy} disabled={text.trim().length < 3}>
                      Send to the team
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
