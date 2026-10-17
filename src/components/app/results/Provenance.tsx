import { Calculator, CircleCheck, Link2, Megaphone, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ValueKindKey = "observed" | "attributed" | "projected" | "platform_reported" | "assumption";

const KIND: Record<ValueKindKey, { label: string; tone: "green" | "blue" | "neutral" | "violet"; icon: ReactNode; help: string }> = {
  observed: { label: "Observed", tone: "green", icon: <CircleCheck />, help: "Counted directly by the source system." },
  attributed: { label: "Attributed", tone: "blue", icon: <Link2 />, help: "Billing revenue credited to a channel by a rule. Shows association, not cause." },
  projected: { label: "Projected", tone: "neutral", icon: <TrendingUp />, help: "An estimate of the future, not a measurement." },
  platform_reported: { label: "Platform reported", tone: "neutral", icon: <Megaphone />, help: "What the ad platform says, using its own rules. Can overlap with other platforms." },
  assumption: { label: "Assumption-based scenario", tone: "neutral", icon: <Calculator />, help: "Arithmetic on numbers you typed in. Not a measurement or a forecast." },
};

/** Labels a number as observed / attributed / projected / platform reported / assumption. */
export function ValueKind({ kind, className }: { kind: ValueKindKey; className?: string }) {
  const k = KIND[kind];
  return (
    <Badge tone={k.tone} icon={k.icon} className={className} title={k.help}>
      {k.label}
    </Badge>
  );
}

export function DemoBadge({ show }: { show: boolean }) {
  return show ? <StatusPill status="demo">Demo data (synthetic)</StatusPill> : null;
}

/** Expandable "what does this mean" block. Native <details> so it works without JS and with keyboard. */
export function Definition({ summary = "What this counts", children, className }: { summary?: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group text-sm text-ink-2", className)}>
      <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-ui font-medium text-brand-800 underline decoration-brand-800/40 underline-offset-4 hover:decoration-brand-800">
        {summary}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}
