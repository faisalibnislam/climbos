"use client";

import { useMemo, useState } from "react";
import { newDesign } from "@shared/design/templates";
import { FORMATS, type DesignFormat } from "@shared/design/types";
import { Checkbox } from "@/components/ui";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { DesignEditor } from "./editor/DesignEditor";

/** Pick a format, then open the editor. (Saving to the workspace library comes with the asset service.) */
export function NewDesignStudio({ slug }: { slug: string }) {
  const [format, setFormat] = useState<Exclude<DesignFormat, "custom"> | null>(null);
  const [carousel, setCarousel] = useState(false);
  const doc = useMemo(() => (format ? newDesign(format, "bold_statement", undefined, carousel ? 3 : 0) : null), [format, carousel]);
  if (doc) return <DesignEditor initial={doc} title="Untitled design" backHref={`/app/${slug}/content`} />;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <PageHeader title="Create a design" intro="Choose a size. You can change everything inside the editor." />
      <Checkbox checked={carousel} onCheckedChange={(v) => setCarousel(v === true)} label="Make it a carousel (cover, 3 points, ending)" />
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {Object.values(FORMATS).map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setFormat(f.id as Exclude<DesignFormat, "custom">)}
              className="flex w-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-5 text-center transition-colors hover:border-brand-600 hover:bg-surface-2"
            >
              <span aria-hidden="true" className="rounded-sm border-2 border-ink/70 bg-surface-2" style={{ width: 64 * Math.min(1, f.width / f.height), height: 64 * Math.min(1, f.height / f.width) }} />
              <span className="heading-card">{f.label}</span>
              <span className="text-xs text-ink-3">
                {f.width}×{f.height}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
