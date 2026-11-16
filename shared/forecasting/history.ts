import { addDays, assertValidSeries, findMissingDates, type DailyPoint } from "./series";

/** Fit only the newest uninterrupted observed history. An absent day is never a zero. */
export function recentForecastHistory(input: readonly DailyPoint[], yesterday: string) {
  const points = assertValidSeries(input);
  if (!points.length) throw new Error("No observed daily data is available. Connect or refresh the source first.");
  if (points.at(-1)!.date !== yesterday) throw new Error(`The latest observed day is ${points.at(-1)!.date}; data through ${yesterday} is needed. Refresh the source before forecasting. Missing days are unknown, not zero.`);
  let start = points.length - 1;
  while (start > 0 && addDays(points[start - 1].date, 1) === points[start].date) start--;
  const history = points.slice(start);
  if (history.length < 7) throw new Error(`Only ${history.length} consecutive observed day(s) end on ${yesterday}. At least seven are needed for the weekly baseline. Recover the missing source data; do not replace it with zero.`);
  return { history, excludedDays: start, missingDays: findMissingDates(points).length };
}
