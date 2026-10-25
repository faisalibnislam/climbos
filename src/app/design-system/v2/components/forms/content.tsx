"use client";

import { RequestComposer } from "@/components/ui/request-composer";
import { useId, useState } from "react";
import { AtSign, Building2, Globe, Mail, Megaphone, Sparkles, Store, Tag, Users } from "@/components/icons";
import { Button, Checkbox, ColorPicker, DatePicker, DateTimePicker, Field, FileInput, HexInput, Input, Label, Select, Switch, Textarea } from "@/components/ui";
import {
  AffixInput,
  Autocomplete,
  CharacterCounter,
  CodeEditor,
  Combobox,
  CopyInput,
  CurrencyInput,
  DateRangePicker,
  DropZone,
  EmailInput,
  FieldDescription,
  FieldMessage,
  FormDivider,
  FormSection,
  InlineIconButton,
  MarkdownEditor,
  MultiSelect,
  NumberInput,
  OtpInput,
  PasswordInput,
  PhoneInput,
  RadioGroup,
  RangeSlider,
  RequiredMark,
  RichTextEditor,
  SearchInput,
  Slider,
  TagInput,
  TimePicker,
  UrlInput,
  formatRange,
  formatTime,
  type DateRange,
  type PhoneValue,
} from "@/components/ds/forms";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

export function FormsContent() {
  return (
    <DocPage eyebrow="Components" title="Forms" intro="Every field has a visible label, says what it wants in plain words, and explains errors next to the field.">
      <RequestComposerSpecimen />
      <TextInputSpecimen />
      <TextareaSpecimen />
      <NumberSpecimen />
      <EmailSpecimen />
      <PasswordSpecimen />
      <SearchSpecimen />
      <SelectSpecimen />
      <MultiSelectSpecimen />
      <ComboboxSpecimen />
      <AutocompleteSpecimen />
      <CheckboxSpecimen />
      <RadioSpecimen />
      <SwitchSpecimen />
      <DatePickerSpecimen />
      <DateRangeSpecimen />
      <TimeSpecimen />
      <DateTimeSpecimen />
      <ColorSpecimen />
      <FileSpecimen />
      <DropSpecimen />
      <SliderSpecimen />
      <RangeSliderSpecimen />
      <StepperSpecimen />
      <TagSpecimen />
      <UrlSpecimen />
      <PhoneSpecimen />
      <CurrencySpecimen />
      <RichTextSpecimen />
      <MarkdownSpecimen />
      <CodeSpecimen />
      <OtpSpecimen />
      <AffixSpecimen />
      <InlineActionSpecimen />
      <ValidationSpecimen />
      <CounterSpecimen />
      <DescriptionSpecimen />
      <RequiredSpecimen />
      <SectionSpecimen />
    </DocPage>
  );
}

/* ---------------------------------------------------------------- */

function TextInputSpecimen() {
  const [name, setName] = useState("Bloom Florist");
  return (
    <Specimen title="Text input" description="One height scale shared with buttons. Labels above, never placeholder-only.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" hint="As customers see it on Google.">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
        </Field>
        <Field label="Owner name" error={name.trim() ? undefined : "Enter your business name first"}>
          <Input placeholder="Priya Shah" autoComplete="name" />
        </Field>
        <Field label="Workspace ID" hint="Set by ClimbOS.">
          <Input value="ws_bloom_0193" disabled />
        </Field>
        <div className="flex flex-col gap-2">
          <Label>Sizes</Label>
          <Input size="sm" aria-label="Small input" placeholder="sm · toolbars, tables" />
          <Input aria-label="Medium input" placeholder="md · default" />
          <Input size="lg" aria-label="Large input" placeholder="lg · marketing forms" />
        </div>
      </Stage>
      <Spec items={[["Height", "var(--h-sm|md|lg)"], ["Radius", "--radius-field (3px)"], ["Border", "--control-border, ink-dark on hover, sage on focus, red-800 when invalid"]]} />
    </Specimen>
  );
}

function TextareaSpecimen() {
  const [v, setV] = useState("Family-run florist in Leeds. Same-day delivery, wedding flowers and weekly subscriptions.");
  return (
    <Specimen title="Textarea" description="Grows with content up to a limit, then scrolls.">
      <Stage tone="white" className="max-w-xl">
        <Field label="What do you sell?" hint="One or two sentences. ClimbOS uses this to draft posts.">
          <Textarea value={v} onChange={(e) => setV(e.target.value)} autosize maxRows={8} />
        </Field>
      </Stage>
    </Specimen>
  );
}

function NumberSpecimen() {
  const [leads, setLeads] = useState<number | null>(40);
  const [rate, setRate] = useState<number | null>(2.5);
  return (
    <Specimen title="Number input" description="Spinbutton: ↑/↓ steps, Shift ×10, Home/End jump to the limits. Out-of-range values clamp on blur.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="New leads per day" hint="0 to 500.">
          <NumberInput value={leads} onValueChange={setLeads} min={0} max={500} unit="leads" suffix="per day" />
        </Field>
        <Field label="Target click rate">
          <NumberInput value={rate} onValueChange={setRate} min={0} max={100} step={0.1} unit="percent" suffix="%" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function EmailSpecimen() {
  const [email, setEmail] = useState("priya@gmial.com");
  return (
    <Specimen title="Email input" description="Checks the format on blur and offers a fix for common domain typos.">
      <Stage tone="white" className="max-w-md">
        <Field label="Work email">
          <EmailInput value={email} onValueChange={setEmail} placeholder="name@business.com" />
        </Field>
        <p className="mt-2 text-xs text-ink-3">Tab out of the field to see the suggestion.</p>
      </Stage>
    </Specimen>
  );
}

function PasswordSpecimen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("spring2026");
  return (
    <Specimen title="Password input" description="Show/hide toggle on every password. New passwords get a strength meter and the rules in words.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Current password">
          <PasswordInput value={current} onValueChange={setCurrent} />
        </Field>
        <Field label="New password">
          <PasswordInput value={next} onValueChange={setNext} showStrength />
        </Field>
      </Stage>
    </Specimen>
  );
}

const PLAYS = ["Google review push", "Win-back email", "Spring offer posts", "Local SEO fixes", "Referral ask", "Instagram reels"];

function SearchSpecimen() {
  const [q, setQ] = useState("");
  const shown = PLAYS.filter((p) => p.toLowerCase().includes(q.toLowerCase()));
  return (
    <Specimen title="Search input" description="Icon, clear button, Esc clears. Press / anywhere on the page to focus it.">
      <Stage tone="white" className="flex max-w-md flex-col gap-3">
        <SearchInput aria-label="Search plays" placeholder="Search plays" value={q} onValueChange={setQ} shortcut={["/"]} />
        <ul className="flex flex-col gap-1 text-ui text-ink-2" aria-live="polite">
          {shown.map((p) => (
            <li key={p}>{p}</li>
          ))}
          {shown.length === 0 ? <li className="text-ink-3">No plays match “{q}”.</li> : null}
        </ul>
      </Stage>
    </Specimen>
  );
}

function SelectSpecimen() {
  const [goal, setGoal] = useState("calls");
  return (
    <Specimen title="Select dropdown" description="Our own popup, never the system menu. For 7+ options use a combobox.">
      <Stage tone="white" className="max-w-sm">
        <Field label="Main goal">
          <Select
            value={goal}
            onValueChange={setGoal}
            options={[
              { value: "calls", label: "More booked calls" },
              { value: "walkins", label: "More walk-ins" },
              { value: "orders", label: "More online orders" },
              { value: "reviews", label: "More reviews", disabled: true },
            ]}
          />
        </Field>
      </Stage>
    </Specimen>
  );
}

const CHANNELS = [
  { value: "google", label: "Google Ads" },
  { value: "gbp", label: "Google Business Profile" },
  { value: "ig", label: "Instagram" },
  { value: "fb", label: "Facebook" },
  { value: "email", label: "Cold email" },
  { value: "news", label: "Newsletter" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "nextdoor", label: "Nextdoor", disabled: true },
];

function MultiSelectSpecimen() {
  const [v, setV] = useState(["google", "ig", "email", "news"]);
  return (
    <Specimen title="Multi-select dropdown" description="Checkable options with search, Select all and Clear. Enter toggles the highlighted option.">
      <Stage tone="white" className="max-w-sm">
        <Field label="Channels">
          <MultiSelect options={CHANNELS} value={v} onValueChange={setV} noun="channels" placeholder="Choose channels" />
        </Field>
      </Stage>
    </Specimen>
  );
}

const INDUSTRIES = [
  { value: "dental", label: "Dental clinic", description: "Healthcare" },
  { value: "florist", label: "Florist", description: "Retail" },
  { value: "plumbing", label: "Plumbing & heating", description: "Home services" },
  { value: "roofing", label: "Roofing", description: "Home services" },
  { value: "salon", label: "Hair salon", description: "Beauty" },
  { value: "cafe", label: "Café", description: "Food & drink" },
  { value: "gym", label: "Gym", description: "Fitness" },
  { value: "law", label: "Law firm", description: "Professional services" },
  { value: "accountant", label: "Accountant", description: "Professional services" },
  { value: "auto", label: "Auto repair", description: "Automotive" },
  { value: "vet", label: "Vet", description: "Healthcare" },
];

function ComboboxSpecimen() {
  const [v, setV] = useState<string | null>("florist");
  return (
    <Specimen title="Combobox" description="Type to filter, ↑/↓ to move, Enter to pick, Esc to close. The value must be one of the options.">
      <Stage tone="white" className="max-w-sm">
        <Field label="Business type">
          <Combobox options={INDUSTRIES.map((o) => ({ ...o, icon: <Store /> }))} value={v} onValueChange={setV} placeholder="Search business types" />
        </Field>
      </Stage>
    </Specimen>
  );
}

const AREAS = ["Leeds", "Leeds city centre", "Headingley", "Harrogate", "Halifax", "Huddersfield", "Horsforth", "Wakefield", "York", "Bradford"];

function AutocompleteSpecimen() {
  const [v, setV] = useState("H");
  const [committed, setCommitted] = useState<string | null>(null);
  return (
    <Specimen title="Autocomplete input" description="Free text with suggestions. Anything typed is allowed; suggestions just save keystrokes.">
      <Stage tone="white" className="flex max-w-sm flex-col gap-2">
        <Field label="Service area">
          <Autocomplete value={v} onValueChange={setV} suggestions={AREAS} onCommit={setCommitted} icon={<Globe />} placeholder="Town or postcode" />
        </Field>
        <p className="text-xs text-ink-3" aria-live="polite">
          {committed ? `Added ${committed}` : "Press Enter to add."}
        </p>
      </Stage>
    </Specimen>
  );
}

function CheckboxSpecimen() {
  const items = ["Email me new leads", "Email me weekly results", "Email me approvals"];
  const [on, setOn] = useState([true, false, true]);
  const all = on.every(Boolean);
  const some = on.some(Boolean);
  return (
    <Specimen title="Checkbox" description="For independent choices. The parent shows a dash when only some are on.">
      <Stage tone="white" className="flex max-w-md flex-col">
        <Checkbox label="All email updates" checked={all ? true : some ? "indeterminate" : false} onCheckedChange={() => setOn(on.map(() => !all))} />
        <div className="ml-7 flex flex-col">
          {items.map((t, i) => (
            <Checkbox key={t} label={t} checked={on[i]} onCheckedChange={(c) => setOn(on.map((x, j) => (j === i ? c === true : x)))} />
          ))}
        </div>
        <Checkbox label="Share anonymised results" description="Helps improve plays for businesses like yours." disabled />
      </Stage>
    </Specimen>
  );
}

function RadioSpecimen() {
  const [freq, setFreq] = useState("weekly");
  const [mode, setMode] = useState("approve");
  return (
    <Specimen title="Radio button" description="One choice from a few visible options. Arrow keys move and select.">
      <Stage tone="white" className="flex flex-col gap-6">
        <RadioGroup
          label="Report frequency"
          value={freq}
          onValueChange={setFreq}
          options={[
            { value: "daily", label: "Daily", description: "Every morning at 8am" },
            { value: "weekly", label: "Weekly", description: "Mondays" },
            { value: "monthly", label: "Monthly", description: "First of the month" },
          ]}
        />
        <RadioGroup
          label="How ClimbOS runs"
          appearance="card"
          orientation="horizontal"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "suggest", label: "Suggest only", description: "You do the work" },
            { value: "approve", label: "Ask first", description: "Drafts wait for approval" },
            { value: "auto", label: "Autopilot", description: "Runs within your limits" },
          ]}
        />
      </Stage>
    </Specimen>
  );
}

function SwitchSpecimen() {
  const [auto, setAuto] = useState(true);
  const [digest, setDigest] = useState(false);
  return (
    <Specimen title="Toggle switch" description="For settings that apply immediately. State is written next to it, not shown by colour alone.">
      <Stage tone="white" className="flex max-w-md flex-col divide-y divide-line">
        <Switch label="Autopilot" description="Publish approved posts on schedule." checked={auto} onCheckedChange={setAuto} className="py-1" />
        <Switch label="Daily digest" description="One email with everything that happened." checked={digest} onCheckedChange={setDigest} className="py-1" />
        <Switch label="SMS alerts" description="Available on Pro." checked={false} disabled className="py-1" />
      </Stage>
    </Specimen>
  );
}

function DatePickerSpecimen() {
  const [d, setD] = useState("2026-10-24");
  return (
    <Specimen title="Date picker" description="Our calendar popup. Arrow keys move by day and week, PageUp/PageDown by month.">
      <Stage tone="white" className="max-w-xs">
        <Field label="Launch date">
          <DatePicker value={d} onChange={setD} min="2026-10-19" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function DateRangeSpecimen() {
  const [r, setR] = useState<DateRange>({ start: "2026-09-20", end: "2026-10-19" });
  return (
    <Specimen title="Date range picker" description="Presets first, then two months. First click sets the start, second the end.">
      <Stage tone="white" className="flex max-w-sm flex-col gap-2">
        <Field label="Report period">
          <DateRangePicker value={r} onChange={setR} today="2026-10-19" max="2026-10-19" />
        </Field>
        <p className="text-xs text-ink-3">Selected: {formatRange(r)}</p>
      </Stage>
    </Specimen>
  );
}

function TimeSpecimen() {
  const id = useId();
  const [t, setT] = useState("09:30");
  return (
    <Specimen title="Time picker" description="Typed segments: ↑/↓ change, digits type, ←/→ move, A/P set the period.">
      <Stage tone="white" className="flex flex-col gap-2">
        <Label id={id}>Send time</Label>
        <div className="flex flex-wrap items-center gap-2">
          <TimePicker value={t} onChange={setT} aria-labelledby={id} step={15} />
          {["08:00", "12:00", "17:30"].map((v) => (
            <Button key={v} variant="ghost" size="sm" aria-pressed={t === v} onClick={() => setT(v)} className="aria-pressed:bg-surface-3">
              {formatTime(v)}
            </Button>
          ))}
        </div>
      </Stage>
    </Specimen>
  );
}

function DateTimeSpecimen() {
  const [v, setV] = useState("2026-10-24T09:30");
  return (
    <Specimen title="Date-time picker" description="Date plus a time list, in the viewer's time zone.">
      <Stage tone="white" className="max-w-sm">
        <Field label="Publish at">
          <DateTimePicker value={v} onChange={setV} min="2026-10-19T00:00" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function ColorSpecimen() {
  const [c, setC] = useState("#0b5d46");
  return (
    <Specimen title="Color picker" description="Brand palette first, hex for anything else.">
      <Stage tone="white" className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-ui font-medium">Brand colour</span>
          <ColorPicker label="Brand colour" value={c} onChange={setC} />
        </div>
        <HexInput value={c} onChange={setC} label="Brand colour hex" />
      </Stage>
    </Specimen>
  );
}

function FileSpecimen() {
  return (
    <Specimen title="File upload" description="Compact picker that matches the other controls. The native input keeps keyboard and screen-reader use.">
      <Stage tone="white" className="max-w-md">
        <Field label="Logo" hint="PNG or SVG, at least 256px.">
          <FileInput accept="image/png,image/svg+xml" buttonLabel="Choose logo" hint="No file chosen" />
        </Field>
      </Stage>
    </Specimen>
  );
}

const fakeUpload = (file: File, onProgress: (n: number) => void) =>
  new Promise<void>((resolve, reject) => {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 9 + (file.size % 9));
      onProgress(p);
      if (p >= 100) {
        clearInterval(t);
        if (/fail/i.test(file.name)) reject(new Error("The server rejected this file"));
        else resolve();
      }
    }, 160);
  });

function DropSpecimen() {
  return (
    <Specimen title="Drag-and-drop upload" description="Drop files or use the button. Type and size are checked before upload; each file shows progress.">
      <Stage tone="white" className="max-w-xl">
        <DropZone accept=".csv,.xlsx,image/*" maxSizeMb={10} onUpload={fakeUpload} title="Drop a lead list or images" hint="CSV, XLSX or images, up to 10 MB each" />
      </Stage>
    </Specimen>
  );
}

function SliderSpecimen() {
  const [budget, setBudget] = useState(25);
  return (
    <Specimen title="Slider" description="Value always shown as text. ←/→ step, PageUp/PageDown jump, Home/End go to the ends.">
      <Stage tone="white" className="max-w-md">
        <Slider
          label="Daily ad budget"
          hint="ClimbOS never spends more than this."
          value={budget}
          onValueChange={setBudget}
          min={5}
          max={100}
          step={5}
          format={(n) => `$${n}`}
          marks={[
            { value: 5, label: "$5" },
            { value: 50, label: "$50" },
            { value: 100, label: "$100" },
          ]}
        />
      </Stage>
    </Specimen>
  );
}

const hour = (n: number) => `${n % 12 === 0 ? 12 : n % 12} ${n >= 12 && n < 24 ? "PM" : "AM"}`;

function RangeSliderSpecimen() {
  const [win, setWin] = useState<[number, number]>([8, 18]);
  return (
    <Specimen title="Range slider" description="Low and high values on one track. The thumbs can't cross.">
      <Stage tone="white" className="max-w-md">
        <RangeSlider label="Send window" value={win} onValueChange={setWin} min={6} max={22} format={hour} thumbLabels={["Earliest send", "Latest send"]} minStepsBetween={2} marks={[{ value: 6, label: "6 AM" }, { value: 14, label: "2 PM" }, { value: 22, label: "10 PM" }]} />
      </Stage>
    </Specimen>
  );
}

function StepperSpecimen() {
  const [posts, setPosts] = useState<number | null>(4);
  const [seats, setSeats] = useState<number | null>(1);
  return (
    <Specimen title="Stepper input" description="Number input with − and + for small ranges. The buttons disable at the limits.">
      <Stage tone="white" className="flex flex-wrap gap-6">
        <Field label="Posts per week">
          <NumberInput stepper value={posts} onValueChange={setPosts} min={1} max={14} unit="posts" />
        </Field>
        <Field label="Seats">
          <NumberInput stepper size="sm" value={seats} onValueChange={setSeats} min={1} max={10} unit="seats" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function TagSpecimen() {
  const [tags, setTags] = useState(["wedding flowers", "same-day delivery"]);
  return (
    <Specimen title="Tag input" description="Enter or comma adds, Backspace on empty removes the last, pasted lists split on commas.">
      <Stage tone="white" className="max-w-lg">
        <Field label="Keywords" hint="Up to 8. ClimbOS targets these in ads and posts.">
          <TagInput value={tags} onValueChange={setTags} max={8} suggestions={["florist leeds", "flower subscription", "funeral flowers"]} validate={(t) => (t.length > 40 ? "Keep keywords under 40 characters" : null)} />
        </Field>
      </Stage>
    </Specimen>
  );
}

function UrlSpecimen() {
  const [url, setUrl] = useState("https://bloomflorist.co.uk");
  return (
    <Specimen title="URL input" description="Fixed https:// add-on; pasted schemes are stripped. Valid addresses get an open link.">
      <Stage tone="white" className="max-w-md">
        <Field label="Website">
          <UrlInput value={url} onValueChange={setUrl} placeholder="yourbusiness.com" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function PhoneSpecimen() {
  const [p, setP] = useState<PhoneValue & { e164?: string }>({ country: "GB", national: "1132960190" });
  return (
    <Specimen title="Phone input" description="Country code picker and as-you-type formatting. Stores E.164.">
      <Stage tone="white" className="flex max-w-md flex-col gap-2">
        <Field label="Business phone">
          <PhoneInput value={p} onValueChange={setP} />
        </Field>
        <p className="text-xs text-ink-3">Stored as {p.e164 ?? `+44${p.national}`}</p>
      </Stage>
    </Specimen>
  );
}

function CurrencySpecimen() {
  const [usd, setUsd] = useState<number | null>(1250);
  const [gbp, setGbp] = useState<number | null>(null);
  return (
    <Specimen title="Currency input" description="Symbol before, code after, digits grouped when you leave the field.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Monthly budget">
          <CurrencyInput value={usd} onValueChange={setUsd} currency="USD" />
        </Field>
        <Field label="Average order value" optional>
          <CurrencyInput value={gbp} onValueChange={setGbp} currency="GBP" placeholder="0.00" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function RichTextSpecimen() {
  return (
    <Specimen title="Rich text editor" description="Bold, italic, underline, heading, bullets and links. Paste keeps safe formatting only.">
      <Stage tone="white" className="max-w-2xl">
        <RichTextEditor
          aria-label="Email body"
          defaultValue="<p>Hi {first_name},</p><p>We've just opened <b>autumn wedding</b> bookings. Book before 31 October and get <i>free table flowers</i>.</p><ul><li>Same-day delivery in Leeds</li><li>Free consultation</li></ul>"
        />
      </Stage>
    </Specimen>
  );
}

function MarkdownSpecimen() {
  const [md, setMd] = useState("## Weekly summary\n\nCalls are **up 18%** since the review push started.\n\n- 12 new Google reviews\n- 3 booked consultations\n\n> Next: invite customers to share photos.\n\nSee the [full report](https://climbos.app/results).");
  return (
    <Specimen title="Markdown editor" description="Write and Preview tabs. The preview is rendered to elements, never raw HTML.">
      <Stage tone="white" className="max-w-2xl">
        <MarkdownEditor aria-label="Play notes" value={md} onValueChange={setMd} rows={9} />
      </Stage>
    </Specimen>
  );
}

function CodeSpecimen() {
  const [code, setCode] = useState('{\n  "event": "lead.created",\n  "lead": {\n    "name": "Maya Chen",\n    "source": "google_ads"\n  }\n}');
  return (
    <Specimen title="Code editor" description="Monospace with line numbers. Tab indents; Esc then Tab leaves the editor.">
      <Stage tone="white" className="max-w-2xl">
        <CodeEditor aria-label="Webhook test payload" language="JSON" value={code} onValueChange={setCode} rows={8} />
      </Stage>
    </Specimen>
  );
}

function OtpSpecimen() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const msgId = useId();
  return (
    <Specimen title="OTP input" description="Auto-advances, Backspace goes back, paste fills every box. Try 428913.">
      <Stage tone="white" className="flex flex-col gap-3">
        <p className="text-ui font-medium">Enter the 6-digit code we sent to p•••@bloomflorist.co.uk</p>
        <OtpInput
          value={code}
          onValueChange={(v) => {
            setCode(v);
            setState("idle");
          }}
          onComplete={(v) => setState(v === "428913" ? "ok" : "bad")}
          invalid={state === "bad"}
          aria-describedby={msgId}
        />
        <div id={msgId}>
          {state === "ok" ? <FieldMessage tone="success">Verified</FieldMessage> : state === "bad" ? <FieldMessage>That code doesn&apos;t match. Check the latest email.</FieldMessage> : <FieldDescription>Codes expire after 10 minutes.</FieldDescription>}
        </div>
      </Stage>
    </Specimen>
  );
}

function AffixSpecimen() {
  return (
    <Specimen title="Input with prefix / suffix" description="Inline text or icons for units; grey add-ons for fixed parts of a value.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Instagram handle">
          <AffixInput prefix={<AtSign />} defaultValue="bloomleeds" />
        </Field>
        <Field label="Discount">
          <AffixInput suffix="%" defaultValue="20" inputMode="numeric" className="tabular-nums" />
        </Field>
        <Field label="Site address">
          <AffixInput addon suffix=".climbos.site" defaultValue="bloom" />
        </Field>
        <Field label="Company">
          <AffixInput prefix={<Building2 />} placeholder="Company name" />
        </Field>
      </Stage>
    </Specimen>
  );
}

function InlineActionSpecimen() {
  const [coupon, setCoupon] = useState("SPRING20");
  const [applied, setApplied] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  return (
    <Specimen title="Input with inline action" description="One small action inside the field: copy, apply, suggest.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Webhook URL">
          <CopyInput value="https://hooks.climbos.app/in/bloom/leads" label="Copy webhook URL" />
        </Field>
        <Field label="Coupon" hint={applied ? `${applied} applied: 20% off for 3 months` : undefined}>
          <AffixInput
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            prefix={<Tag />}
            className="uppercase"
            action={
              <Button size="sm" variant="secondary" className="h-7" disabled={!coupon} onClick={() => setApplied(coupon)}>
                Apply
              </Button>
            }
          />
        </Field>
        <Field label="Ad headline" className="sm:col-span-2">
          <AffixInput
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Fresh flowers, delivered today"
            action={
              <InlineIconButton label="Suggest a headline" onClick={() => setHeadline("Same-day flowers across Leeds, from £25")}>
                <Sparkles />
              </InlineIconButton>
            }
          />
        </Field>
      </Stage>
    </Specimen>
  );
}

function ValidationSpecimen() {
  const [email, setEmail] = useState("hello@");
  const err = email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? "Enter an email like name@business.com" : undefined;
  return (
    <Specimen title="Form validation message" description="Icon plus words, under the field, linked by aria-describedby. Errors say how to fix it.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Reply-to email" error={err}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
        <div className="flex flex-col gap-2">
          <FieldMessage tone="error">Enter a budget of at least $5</FieldMessage>
          <FieldMessage tone="warning">This domain has no SPF record yet</FieldMessage>
          <FieldMessage tone="success">Domain verified</FieldMessage>
          <FieldMessage tone="info">Changes apply to new posts only</FieldMessage>
        </div>
      </Stage>
    </Specimen>
  );
}

function CounterSpecimen() {
  const id = useId();
  const [bio, setBio] = useState("Fresh flowers for every moment. Same-day delivery across Leeds. Weddings, events and weekly subscriptions.");
  return (
    <Specimen title="Character counter" description="Quiet until 90% of the limit, then amber; red and announced when over.">
      <Stage tone="white" className="max-w-md">
        <Field label="Instagram bio">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} aria-describedby={`${id}-count`} autosize />
        </Field>
        <CharacterCounter id={`${id}-count`} value={bio} max={150} className="mt-1" />
      </Stage>
    </Specimen>
  );
}

function DescriptionSpecimen() {
  const id = useId();
  return (
    <Specimen title="Field description" description="Short help under the label. Longer help goes in a link, not a paragraph.">
      <Stage tone="white" className="grid gap-5 sm:grid-cols-2">
        <Field label="Sender name" hint="Shown in the inbox, e.g. “Priya at Bloom”.">
          <Input defaultValue="Priya at Bloom" />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-dom`}>Sending domain</Label>
          <FieldDescription id={`${id}-desc`}>
            Use a separate domain for cold email. <a href="#field-description">Why this matters</a>
          </FieldDescription>
          <AffixInput id={`${id}-dom`} aria-describedby={`${id}-desc`} prefix={<Mail />} defaultValue="hello-bloom.co.uk" />
        </div>
      </Stage>
    </Specimen>
  );
}

function RequiredSpecimen() {
  const id = useId();
  return (
    <Specimen title="Required field indicator" description="Most fields are required, so mark the optional ones. Use the asterisk only when most are optional, and explain it once.">
      <div className="grid gap-3 md:grid-cols-2">
        <Stage tone="white" label="Default: mark optional" className="flex flex-col gap-4">
          <Field label="Business name" required>
            <Input defaultValue="Bloom Florist" />
          </Field>
          <Field label="VAT number" optional>
            <Input placeholder="GB123456789" />
          </Field>
        </Stage>
        <Stage tone="white" label="Mostly optional: mark required" className="flex flex-col gap-4">
          <p className="text-xs text-ink-3">
            Fields marked <RequiredMark className="ml-0" /> are required.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-a`}>
              Contact email
              <RequiredMark />
            </Label>
            <Input id={`${id}-a`} required type="email" placeholder="name@business.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-b`}>Notes for the team</Label>
            <Input id={`${id}-b`} placeholder="Anything we should know" />
          </div>
        </Stage>
      </div>
    </Specimen>
  );
}

function SectionSpecimen() {
  const [team, setTeam] = useState<string | null>("owner");
  return (
    <Specimen title="Form section divider" description="Titled sections for long settings forms; a labelled rule for alternatives.">
      <Stage tone="white" className="flex flex-col gap-6">
        <FormSection title="Profile" description="How your business appears in posts and emails.">
          <Field label="Display name">
            <Input defaultValue="Bloom Florist" />
          </Field>
          <Field label="Category">
            <Combobox options={INDUSTRIES} value="florist" onValueChange={() => {}} />
          </Field>
        </FormSection>
        <FormSection title="Team" description="Who gets approvals and alerts.">
          <Field label="Approver">
            <Select
              value={team ?? undefined}
              onValueChange={setTeam}
              options={[
                { value: "owner", label: "Priya Shah (owner)" },
                { value: "tom", label: "Tom Okafor" },
              ]}
            />
          </Field>
        </FormSection>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-3 border-t border-line pt-6">
          <Button variant="secondary" className="w-full">
            <Users /> Import contacts from Google
          </Button>
          <FormDivider>or</FormDivider>
          <Button variant="secondary" className="w-full">
            <Megaphone /> Add contacts by hand
          </Button>
        </div>
      </Stage>
      <Spec items={[["Section title", "heading-card (Reckless 17px)"], ["Rule", "1px --line, 24px above"], ["Layout", "title column 14rem from md; stacked on mobile"]]} />
    </Specimen>
  );
}



function RequestComposerSpecimen() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState("");
  return (
    <section id="request-composer-example" className="space-y-3" aria-labelledby="request-specimen">
      <h2 id="request-specimen" className="heading-section">Guided request</h2>
      <p className="text-sm text-ink-3">The shared input for Home and business setup. This example does not run AI or create a business.</p>
      <RequestComposer label="Example request" value={value} onChange={setValue} onSubmit={() => { setSent(value); setValue(""); }} placeholder="Tell us what you need help with…" suggestions={["Help me choose what to do next", "Prepare posts for next week"]} helper="Suggestions only add text. You choose when to send." />
      {sent ? <p role="status" className="text-sm text-ink-2">Example received: {sent}</p> : null}
    </section>
  );
}
