import { ExternalLink } from "@/components/icons";

/** Show the references already attached to a recommendation in a usable form. */
export function EvidenceReferences({ references }: { references: string[] }) {
  if (!references.length) return null;

  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {references.map((reference, index) => {
        const normalized = reference.trim();
        const fact = /^fact:(\d+)$/i.exec(normalized);
        if (fact) {
          return (
            <li key={`${reference}-${index}`}>
              <a className="text-link underline" href="#sources-heading">
                Business fact reference {Number(fact[1]) + 1} · see plan sources
              </a>
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
            </li>
          );
        }

        return <li key={`${reference}-${index}`}>{reference}</li>;
      })}
    </ul>
  );
}
