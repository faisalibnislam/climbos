"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { RoleAvatar } from "./RoleAvatar";
import { ROLE_META, roleTitle } from "./roles";

/** One AI role: name and a one-line job; tap to read what it does in more detail. */
export function RoleExplainer({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const meta = ROLE_META[role];
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        <RoleAvatar role={role} size="xs" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-ui font-medium text-ink">{roleTitle(role)}</span>
          {meta ? <span className="text-xs text-ink-3">{meta.job}</span> : null}
        </span>
        {meta ? <ChevronDown aria-hidden className={cn("mt-0.5 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} /> : null}
      </button>
      {meta ? (
        <p id={id} hidden={!open} className="ml-8 mt-0.5 text-xs leading-5 text-ink-2">
          {meta.more}
        </p>
      ) : null}
    </div>
  );
}
