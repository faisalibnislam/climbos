"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Magic, Plus, X } from "@/components/icons";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";
import { Button, Callout, Card, CardContent, Checkbox, ColorPicker, Field, Input, Progress, Select, Textarea, toast } from "@/components/ui";
import { CONTENT_LANGUAGES } from "../../../../../../shared/languages";

/** Brand kit: voice, tone, colours, never-say list, and rules learned from your edits. */
export default function BrandSettingsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.brand.get, { slug });
  if (data === undefined) return <LoadingBlock label="Loading brand kit" lines={4} />;
  return <BrandForm key={JSON.stringify([data.voice, data.toneWords, data.colors, data.doNots, data.approvedExamples, data.voiceLearningEnabled])} slug={slug} data={data} />;
}

type Brand = NonNullable<ReturnType<typeof useQuery<typeof api.brand.get>>>;

/** The language every post, email, ad and page is written in. Saved right away. */
function LanguageField({ slug }: { slug: string }) {
  const lang = useQuery(api.translate.language, { slug });
  const set = useMutation(api.translate.setLanguage);
  if (lang === undefined) return null;
  return (
    <Field label="Content language" hint="Replies match the customer’s language.">
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
  const [approvedExamples, setApprovedExamples] = useState([...data.approvedExamples, "", ""].slice(0, 3));
  const [voiceLearningEnabled, setVoiceLearningEnabled] = useState(data.voiceLearningEnabled);
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
      <SettingsHeader title="Brand kit" />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Voice" hint="1–2 sentences">
            <Textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} autosize />
          </Field>
          <Field label="Tone words" hint="Up to 8, comma-separated">
            <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="warm, direct, confident" />
          </Field>
          <LanguageField slug={slug} />
          <Field label="Never say or do" hint="One per line">
            <Textarea value={doNots} onChange={(e) => setDoNots(e.target.value)} rows={3} autosize />
          </Field>
          <section aria-labelledby="approved-examples-heading" className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <div>
              <h3 id="approved-examples-heading" className="text-sm font-semibold text-ink">Examples ClimbOS may learn style from</h3>
              <p className="mt-1 text-sm text-ink-3">Add up to three examples you approve. They guide voice and format only; they are not proof that a marketing claim or result is true.</p>
            </div>
            {approvedExamples.map((example, index) => (
              <Field key={index} label={`Approved example ${index + 1}`} optional>
                <Textarea value={example} disabled={!data.canManageVoiceLearning} onChange={(e) => setApprovedExamples(approvedExamples.map((item, i) => i === index ? e.target.value.slice(0, 1000) : item))} rows={2} autosize maxLength={1000} />
              </Field>
            ))}
            {!data.canManageVoiceLearning ? <p className="text-xs text-ink-3">Only a workspace owner or admin can approve examples.</p> : null}
          </section>
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
            disabled={!data.exists || !data.canEdit}
            onClick={() => run("save", () => save({ slug, voice, toneWords: tone.split(","), colors, doNots: doNots.split("\n"), ...(data.canManageVoiceLearning ? { approvedExamples, voiceLearningEnabled } : {}) }), "Brand kit saved")}
          >
            Save
          </Button>
          {!data.canEdit ? <p className="text-xs text-ink-3">Changing the brand kit needs workspace edit access.</p> : null}
          {!data.exists ? <p className="text-xs text-ink-3">Finish onboarding first.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="heading-card">Learned from your edits</p>
          <p className="text-sm text-ink-3">Updates every {data.learnAfter} edits · ~1 credit</p>
          <Checkbox
            checked={voiceLearningEnabled}
            disabled={!data.canManageVoiceLearning}
            onCheckedChange={(checked) => setVoiceLearningEnabled(checked === true)}
            label="Allow ClimbOS to learn from my draft edits"
            description="When on, ClimbOS stores before-and-after versions of your edits and may use them to draft voice rules for this workspace. This does not train a shared model."
          />
          {voiceLearningEnabled !== data.voiceLearningEnabled ? (
            <Callout tone={voiceLearningEnabled ? "info" : "warning"}>
              {voiceLearningEnabled ? "Save to turn on learning for future edits." : "Save to turn off learning and delete stored edit samples and learned voice rules for this workspace."}
            </Callout>
          ) : null}
          {!data.canManageVoiceLearning ? <p className="text-xs text-ink-3">Only a workspace owner or admin can change this consent.</p> : null}
          {data.learnedRules.length ? (
            <ul className="flex flex-col gap-1.5">
              {data.learnedRules.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  {r}
                  <Button size="sm" variant="ghost" disabled={!data.canEdit} aria-label={`Forget: ${r}`} onClick={() => run("rm", () => removeRule({ slug, index: i }))}>
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Nothing yet</p>
          )}
          <Progress value={(Math.min(data.pending, data.learnAfter) / data.learnAfter) * 100} label="Edits until the next update" />
          <p className="flex items-center justify-between gap-2 text-xs text-ink-3">
            {data.pending}/{data.learnAfter} edits
            {data.pending >= 2 ? (
              <Button size="sm" variant="secondary" disabled={!data.canEdit} loading={busy === "learn"} onClick={() => run("learn", () => learnNow({ slug }), "Learning from your edits")}>
                <Magic aria-hidden /> Learn now
              </Button>
            ) : null}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
