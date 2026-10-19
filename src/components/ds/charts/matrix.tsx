"use client";

/*
 * Matrix views (Signal): cells shaded in six sage steps, one tab stop with arrow keys
 * across rows and columns, tooltip on the active cell.
 * - Heatmap: e.g. replies by weekday × hour.
 * - CohortChart: retention triangle, % of each cohort still active per week.
 */
import { cn } from "@/lib/utils";
import { fmt, useEntered } from "@/components/analytics/shared";
import { CHART, ChartTooltip, focusRing, useKeyNav, SrTable } from "./core";

/** Six steps: empty, then 18 → 100% sage mixed into the panel. */
const MIX = [0, 18, 34, 52, 74, 100];
export const heatStep = (k: number) => (k <= 0 ? 0 : Math.min(5, 1 + Math.floor(k * 4.999)));
const cellBg = (step: number) => (step === 0 ? "var(--surface-2)" : `color-mix(in srgb, ${CHART.sage} ${MIX[step]}%, var(--surface))`);

export function HeatScale({ low = "Fewer", high = "More" }: { low?: string; high?: string }) {
  return (
    <div aria-hidden className="flex items-center gap-1.5 text-2xs text-ink-3">
      {low}
      {MIX.map((_, s) => <span key={s} className="size-3 rounded-[2px]" style={{ background: cellBg(s) }} />)}
      {high}
    </div>
  );
}

function MatrixHeat({ rows, cols, values, max, format, label, rowMeta, showValues, colFit = 8, cellHeight = 24, rowHeaderWidth = 40, emptyText = "No data yet", unit = "" }: { rows: string[]; cols: string[]; values: (number | null)[][]; max?: number; format: (n: number) => string; label: string; rowMeta?: string[]; showValues?: boolean; colFit?: number; cellHeight?: number; rowHeaderWidth?: number; emptyText?: string; unit?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const C = cols.length;
  const top = max ?? Math.max(1, ...values.flat().filter((v): v is number => v !== null));
  const nav = useKeyNav(rows.length * C, C);
  const k = Math.max(1, Math.ceil(C / colFit));
  return (
    <div ref={ref} className="@container">
      <div
        role="group"
        tabIndex={0}
        aria-label={`${label}. Arrow keys move across cells; up and down change row.`}
        onKeyDown={nav.onKeyDown}
        onBlur={nav.onBlur}
        onMouseLeave={nav.onMouseLeave}
        className={cn("grid gap-[2px] rounded-[2px]", focusRing)}
        style={{ gridTemplateColumns: `${rowHeaderWidth}px repeat(${C}, minmax(0, 1fr))` }}
      >
        <span />
        {cols.map((c, ci) =>
          ci % k === 0 ? (
            <span key={c} aria-hidden className={cn("truncate pb-0.5 text-2xs text-ink-3", k === 1 ? "text-center" : "text-left")} style={{ gridColumn: `span ${Math.min(k, C - ci)}` }}>
              {c}
            </span>
          ) : null,
        )}
        {rows.map((r, ri) => (
          <div key={r} className="contents">
            <span className="flex min-w-0 flex-col justify-center pr-1 text-2xs leading-tight text-ink-3">
              <span className="truncate font-medium text-ink-2">{r}</span>
              {rowMeta?.[ri] ? <span className="truncate tabular-nums">{rowMeta[ri]}</span> : null}
            </span>
            {cols.map((c, ci) => {
              const v = values[ri]?.[ci] ?? null;
              const step = v === null ? -1 : heatStep(v / top);
              const idx = ri * C + ci;
              const on = nav.active === idx;
              const below = ri < rows.length / 2;
              return (
                <span
                  key={c}
                  onMouseEnter={() => nav.setActive(idx)}
                  className={cn("relative grid place-items-center rounded-[2px] text-2xs tabular-nums", step === -1 && "border border-dashed border-line", step >= 4 ? "text-white" : "text-ink-2", on && "z-10 outline-2 outline-offset-1 outline-ink")}
                  style={{ height: cellHeight, background: step < 0 ? "transparent" : cellBg(step), opacity: entered ? 1 : 0, transition: `opacity .35s ${(ri * C + ci) * 4}ms` }}
                >
                  {showValues && v !== null ? <span aria-hidden className="hidden @[420px]:inline">{format(v)}{unit}</span> : null}
                  {on ? <ChartTooltip place={below ? "below" : "above"} tip={{ x: 50, y: below ? 100 : 0, title: `${r} · ${c}`, rows: v === null ? undefined : [{ label: "Value", value: `${format(v)}${unit}`, color: cellBg(Math.max(1, step)), strong: true }], note: v === null ? emptyText : undefined }} /> : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <SrTable caption={label} columns={["", ...cols]} rows={rows.map((r, ri) => [r, ...cols.map((_, ci) => (values[ri]?.[ci] === null || values[ri]?.[ci] === undefined ? "" : `${format(values[ri][ci] as number)}${unit}`))])} />
    </div>
  );
}

export function Heatmap({ rows, cols, values, format = fmt, unit = "", label, colFit = 8 }: { rows: string[]; cols: string[]; values: number[][]; format?: (n: number) => string; unit?: string; label: string; colFit?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <MatrixHeat rows={rows} cols={cols} values={values} format={format} unit={unit} label={label} colFit={colFit} cellHeight={22} rowHeaderWidth={32} />
      <div className="flex justify-end"><HeatScale /></div>
    </div>
  );
}

export interface Cohort {
  label: string;
  size: number;
  /** % retained for each period after joining; null for periods not reached yet. */
  values: (number | null)[];
}

export function CohortChart({ cohorts, periods, sizeLabel = "leads", label }: { cohorts: Cohort[]; periods: string[]; sizeLabel?: string; label: string }) {
  return (
    <div className="flex flex-col gap-3">
      <MatrixHeat
        rows={cohorts.map((c) => c.label)}
        rowMeta={cohorts.map((c) => `${fmt(c.size)} ${sizeLabel}`)}
        cols={periods}
        values={cohorts.map((c) => periods.map((_, i) => c.values[i] ?? null))}
        max={100}
        format={(v) => `${Math.round(v)}`}
        unit="%"
        label={label}
        showValues
        colFit={12}
        cellHeight={30}
        rowHeaderWidth={76}
      />
      <div className="flex justify-end"><HeatScale low="0%" high="100%" /></div>
    </div>
  );
}
