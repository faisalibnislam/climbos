"use client";

import { useMemo, useState } from "react";
import { newDesign } from "@shared/design/templates";
import { FORMATS, type DesignFormat } from "@shared/design/types";
import { DesignEditor } from "./editor/DesignEditor";

/** Pick a format, then open the editor. (Saving to the workspace library comes with the asset service.) */
export function NewDesignStudio({ slug }: { slug: string }) {
  const [format, setFormat] = useState<Exclude<DesignFormat, "custom"> | null>(null);
  const [carousel, setCarousel] = useState(false);
  const doc = useMemo(() => (format ? newDesign(format, "bold_statement", undefined, carousel ? 3 : 0) : null), [format, carousel]);
  if (doc) return <DesignEditor initial={doc} title="Untitled design" backHref={`/app/${slug}/content`} />;
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl text-ink">Create a design</h1>
      <p className="mt-2 text-ink-2">Choose a size. You can change everything inside the editor.</p>
      <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <input type="checkbox" checked={carousel} onChange={(e) => setCarousel(e.target.checked)} /> Make it a carousel (cover, 3 points, ending)
      </label>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {Object.values(FORMATS).map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => setFormat(f.id as Exclude<DesignFormat, "custom">)} className="flex w-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-5 text-center hover:border-brand-600">
              <span aria-hidden="true" className="rounded border-2 border-ink/70 bg-surface-2" style={{ width: 64 * Math.min(1, f.width / f.height), height: 64 * Math.min(1, f.height / f.width) }} />
              <span className="text-sm font-semibold text-ink">{f.label}</span>
              <span className="text-xs text-ink-3">
                {f.width}×{f.height}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
