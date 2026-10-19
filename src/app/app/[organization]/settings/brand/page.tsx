"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Plus, Sparkles, X } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";
import { Button, Card, CardContent, ColorPicker, Field, Input, Progress, Select, Textarea, toast } from "@/components/ui";
import { CONTENT_LANGUAGES } from "../../../../../../shared/languages";

/** Brand kit: voice, tone, colours, never-say list, and rules learned from your edits. */
export default function BrandSettingsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.brand.get, { slug });
  if (data === undefined) return <LoadingBlock label="Loading brand kit" lines={4} />;
  return <BrandForm key={JSON.stringify([data.voice, data.toneWords, data.colors, data.doNots])} slug={slug} data={data} />;
}

type Brand = NonNullable<ReturnType<typeof useQuery<typeof api.brand.get>>>;

/** The language every post, email, ad and page is written in. Saved right away. */
function LanguageField({ slug }: { slug: string }) {
  const lang = useQuery(api.translate.language, { slug });
  const set = useMutation(api.translate.setLanguage);
  if (lang === undefined) return null;
  return (
    <Field label="Content language" hint="Posts, emails, ads and pages are written in this language. Chat and inbox replies match the customer's language.">
      <Select
        options={CONTENT_LANGUAGES.map((l) => ({ value: l, label: l }))}
        value={lang}
        onValueChange={(v) => set({ slug, language: v }).then(() => toast({ tone: "success", title: `Writing in ${v}` }), (e) => toast({ tone: "danger", title: errorMessage(e) }))}
      />
    </Field>
  );
}

function BrandForm({ slug, data }: { slug: string; data: Brand }) {
  const save = useMutation(api.brand.update);
  const removeRule = useMutation(api.brand.removeRule);
  const learnNow = useMutation(api.brand.learnNow);
  const [voice, setVoice] = useState(data.voice);
  const [tone, setTone] = useState(data.toneWords.join(", "));
  const [colors, setColors] = useState<string[]>(data.colors.length ? data.colors : ["#0b5d46"]);
  const [doNots, setDoNots] = useState(data.doNots.join("\n"));
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Brand kit" intro="How your team writes and what it looks like. Every draft, image and reel uses this." />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Voice" hint="One or two sentences. E.g. “Friendly expert, plain words, a little playful.”">
            <Textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} autosize />
          </Field>
          <Field label="Tone words" hint="Up to 8, separated by commas.">
            <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="warm, direct, confident" />
          </Field>
          <LanguageField slug={slug} />
          <Field label="Never say or do" hint="One per line.">
            <Textarea value={doNots} onChange={(e) => setDoNots(e.target.value)} rows={3} autosize />
          </Field>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">Brand colours</p>
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ColorPicker label={i === 0 ? "Main colour" : `Colour ${i + 1}`} value={c} onChange={(hex) => setColors(colors.map((x, j) => (j === i ? hex : x)))} />
                  {i > 0 ? (
                    <Button size="sm" variant="ghost" aria-label="Remove colour" onClick={() => setColors(colors.filter((_, j) => j !== i))}>
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </span>
              ))}
              {colors.length < 6 ? (
                <Button size="sm" variant="ghost" onClick={() => setColors([...colors, "#f59e0b"])}>
                  <Plus aria-hidden /> Colour
                </Button>
              ) : null}
            </div>
          </div>
          <Button
            className="self-start"
            loading={busy === "save"}
            disabled={!data.exists}
            onClick={() => run("save", () => save({ slug, voice, toneWords: tone.split(","), colors, doNots: doNots.split("\n") }), "Brand kit saved")}
          >
            Save
          </Button>
          {!data.exists ? <p className="text-xs text-ink-3">Finish onboarding first; your team drafts a brand kit from your website.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="heading-card">Learned from your edits</p>
          <p className="text-sm text-ink-3">When you rewrite a draft, your team notices. Every {data.learnAfter} edits it updates these rules (about 1 credit).</p>
          {data.learnedRules.length ? (
            <ul className="flex flex-col gap-1.5">
              {data.learnedRules.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  {r}
                  <Button size="sm" variant="ghost" aria-label={`Forget: ${r}`} onClick={() => run("rm", () => removeRule({ slug, index: i }))}>
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Nothing learned yet.</p>
          )}
          <Progress value={(Math.min(data.pending, data.learnAfter) / data.learnAfter) * 100} label="Edits until the next update" />
          <p className="flex items-center justify-between gap-2 text-xs text-ink-3">
            {data.pending} of {data.learnAfter} edits collected
            {data.pending >= 2 ? (
              <Button size="sm" variant="secondary" loading={busy === "learn"} onClick={() => run("learn", () => learnNow({ slug }), "Learning from your edits")}>
                <Sparkles aria-hidden /> Learn now
              </Button>
            ) : null}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
