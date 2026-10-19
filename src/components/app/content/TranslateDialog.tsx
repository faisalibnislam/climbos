"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Languages } from "@/components/icons"
import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogTrigger, Field, Select, toast } from "@/components/ui";
import { CONTENT_LANGUAGES } from "../../../../shared/languages";
import { errorMessage } from "../errors";
import { RunDrafts } from "./RunDrafts";
import { RunProgressCompact } from "./RunProgress";

/** Translate a draft into another language: a new draft goes to review. */
export function TranslateDialog({ slug, artifactId }: { slug: string; artifactId: Id<"artifacts"> }) {
  const start = useMutation(api.translate.start);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("Spanish");
  const [runId, setRunId] = useState<Id<"workflowRuns"> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRunId(null); }}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Languages aria-hidden /> Translate
        </Button>
      </DialogTrigger>
      <DialogContent title="Translate" description="New draft · about 1 credit">
        {runId ? (
          <div className="flex flex-col gap-3">
            <RunProgressCompact slug={slug} runId={runId} />
            <RunDrafts slug={slug} runId={runId} onOpen={() => setOpen(false)} />
          </div>
        ) : (
          <Field label="Language">
            <Select options={CONTENT_LANGUAGES.map((l) => ({ value: l, label: l }))} value={language} onValueChange={setLanguage} />
          </Field>
        )}
        <DialogFooter>
          {runId ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setRunId(await start({ slug, artifactId, language }));
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Languages aria-hidden /> Translate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
