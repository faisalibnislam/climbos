import { ExternalLink } from "@/components/icons";
import type { ActionEvidenceStatus, ActionEvidenceSupport } from "../../../../shared/agents/provenance";

const SUPPORT_LABEL: Record<ActionEvidenceStatus, string> = {
  found_on_page: "Excerpt found on the page ClimbOS loaded",
  found_in_fact: "Excerpt found in the confirmed fact",
  not_found: "Excerpt not found in this source · treat the claim as unconfirmed",
  page_unavailable: "Page couldn't be loaded to check the excerpt",
  not_loaded: "Excerpt not checked · page wasn't loaded",
  no_excerpt: "No supporting excerpt given",
};

/** Show the references already attached to a recommendation in a usable form, with any code-checked excerpt support. */
export function EvidenceReferences({ references, excerpts = [], support }: { references: string[]; excerpts?: { ref: string; excerpt: string }[]; support?: ActionEvidenceSupport[] }) {
  if (!references.length) return null;
  const excerptOf = (ref: string) => excerpts.find((item) => item.ref.trim() === ref.trim())?.excerpt;
  const statusOf = (ref: string) => support?.find((item) => item.ref.trim() === ref.trim())?.status;
  const detail = (reference: string) => {
    const excerpt = excerptOf(reference);
    const status = statusOf(reference);
    if (!excerpt && !status) return null;
    return (
      <span className="block text-ink-3">
        {excerpt ? <q className="italic">{excerpt}</q> : null}
        {status ? <span className={status === "not_found" ? "block font-medium text-amber-800" : "block"}>{SUPPORT_LABEL[status]}</span> : null}
      </span>
    );
  };

  return (
    <>
      <ul className={support?.length || excerpts.length ? "mt-1 flex flex-col gap-1.5 text-xs" : "mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs"}>
        {references.map((reference, index) => {
          const normalized = reference.trim();
          const fact = /^fact:(\d+)$/i.exec(normalized);
          if (fact) {
            return (
              <li key={`${reference}-${index}`}>
                <a className="text-link underline" href="#sources-heading">
                  Business fact reference {Number(fact[1]) + 1} · see plan sources
                </a>
                {detail(reference)}
              </li>
            );
          }

          if (/^https?:\/\//i.test(normalized)) {
            let label = "Open source page";
            try {
              const url = new URL(normalized);
              label = `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
            } catch {
              // Keep an understandable label if a legacy URL cannot be parsed.
            }
            return (
              <li key={`${reference}-${index}`}>
                <a className="text-link underline" href={normalized} target="_blank" rel="noreferrer" title={normalized}>
                  {label} <ExternalLink aria-hidden className="inline size-3" />
                </a>
                {detail(reference)}
              </li>
            );
          }

          return <li key={`${reference}-${index}`}>{reference}{detail(reference)}</li>;
        })}
      </ul>
      {support?.some((item) => item.status === "found_on_page" || item.status === "found_in_fact") ? <p className="mt-1 text-xs text-ink-3">A found excerpt shows these words are in the source, not that they prove the claim.</p> : null}
    </>
  );
}
