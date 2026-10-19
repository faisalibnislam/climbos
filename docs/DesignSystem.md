# ClimbOS design system ("Signal")

One system for every screen. When a screen needs something this file doesn't cover, add it to the design system first (`src/components/ui` or `src/components/ds`), then use it. Never style a one-off.

**The living reference** is `/design-system/v2` (noindex): foundations, 15 component pages, patterns and screens, with ⌘K search and a comfortable/compact density toggle. Check it after any change here. Adopted product-wide on 2026-10-19 (replaces "Summit").

## 1. Foundations

### Colour (tokens in `src/app/globals.css`)

| Role | Token | Use |
|---|---|---|
| Ground | `bg` #E8ECE5 | App and marketing background. |
| Panel | `surface` #FFF | Cards, tables, menus, dialogs, inputs. Soft `card-shadow`. |
| Fills | `surface-2` #F2F4F0, `surface-3` #E2E6DE | Table header, hover, tracks, pressed. |
| Ink | `ink` #161815, `ink-2` #444841, `ink-3` #575C53 | Text, secondary text, meta. Body text is AAA. |
| Action | `action` = ink | Primary buttons and active segmented/tab items are black. |
| Brand | `brand-800` #4D6043 (sage), ramp 50–950, `sage-ink` #5B6E50 | Links, focus, selected states, chart line. `sage-ink` carries white text. |
| Lime | `lime` / `sun` #C3EF88, `sun-strong` | The one most important thing on a screen (Upgrade, outcome bar, workspace tile). **Never small text on lime over white.** |
| Cream | `cream` #EAE3CE (+ soft, strong, deep) | Feature and upsell surfaces. Flat, no gradients. |
| Status | `green/amber/red/orange…` 100 / 500 / 800 | Soft fill + deep ink. Never colour alone. |
| Charts | `chart-1…6` | Sage, ink, slate, clay, ochre; `chart-6` grey is always the previous period. |

Rules:
- No raw hex in components; no gradients; no grid or cross patterns.
- Contrast is tested in CI (`tests/unit/contrast.test.ts`).

### Type

- **Reckless Neue** (licensed, self-hosted in `src/app/fonts/reckless/`): every title level and ClimbOS's voice.
- **Hanken Grotesk**: body, UI, tables and KPI numbers.

| Style | Class | Spec |
|---|---|---|
| Display | `text-display` | Reckless 500 · 44–72 |
| Page title | `heading-page` (all `h1`) | Reckless 500 · 36/40 |
| Section title | `heading-section` | Reckless 500 · 24/30 |
| Card title | `heading-card` | Reckless 500 · 17/22 |
| Dialog / empty state | `heading-dialog`, `heading-empty` | Reckless 500 · 22/28 |
| AI voice | `text-voice` | Reckless 400 · 16/24 |
| Chart note / quote / trust | `text-annotation`, `text-quote`, `text-trust` | Reckless (italic for notes and quotes) |
| Hero number | `metric-hero` | Reckless 400 · 60 (one per screen) |
| KPI number | `text-kpi font-semibold tabular-nums` | Hanken 600 · 32/40 |
| Body / long-form | `text-sm` / `text-base` | Hanken 14/20, 15/24 |
| UI / caption / overline | `text-ui`, `text-xs`, `text-overline` | Hanken 13/18, 12/16, 11/16 caps |

Rules:
- Reckless never on buttons, labels, inputs or table cells. At most one Reckless italic line per card.
- Weights 400/500/600 only. Only the scale above; no `text-[Npx]`.
- Sentence case everywhere.

### Space, size, shape, motion

- 4px spacing grid.
- **Density tokens** (comfortable default; `data-density="compact"` tightens): `--h-sm/md/lg` 32/36/40 (compact 28/32/36), `--cell-h` 44 (34), `--card-p` 20 (14). Controls, rows and cards use them.
- **Corners, 8px max:** cards 5px (`--radius-card`), CTAs 7px (`--radius-cta`), pills 4px (`--radius-badge`), controls and fields 3px (`--radius-control`). Circles only for avatars, dots and switches. Tailwind `rounded-*` maps onto this scale.
- **Elevation:** panels use `card-shadow`; secondary buttons `btn-2-shadow`; floating layers `shadow-lg`.
- **Icons:** ClimbOS Sharp (`@/components/icons`), our own set: 24px grid, 1.5 stroke, square caps. 16px in controls, 20px in nav, 24px standalone.
- **Motion:** `--dur-fast/base/slow/deliberate` (120/200/300/420ms), `--ease-standard/enter/exit`. Respect `prefers-reduced-motion`.
- **Focus:** 2px `--focus-ring` outline, 2px offset, on everything.

## 2. Components (`@/components/ui`)

| Need | Use | Notes |
|---|---|---|
| Action | `Button` | Variants: `primary` (one per view), `secondary`, `ghost`, `danger`, `link`, `accent`. Sizes sm/md/lg. `asChild` for links. `loading` for async. |
| Icon-only action | `IconButton` | `aria-label` required. Ghost by default. |
| Text input | `Field` + `Input` / `Textarea` | Always a visible label. Hint under the label, error under the control. |
| Choice | `Select`, `Checkbox`, `Switch`, `RadioCards`, `ChoiceChips` | Switch for settings that apply at once. Checkbox inside forms. RadioCards for 2–4 rich options. ChoiceChips for quick single-choice filters and pickers. |
| Inline link | `text-link` utility | Links inside sentences. Buttons that navigate use `Button asChild` or `variant="link"`. |
| Networks | `SocialIcon`, `NetworkLabel`, `networkName()` | Real platform marks. Always paired with the network's name, visible or `labelled`. |
| Charts | `AreaChart`, `BarChart`, `LineChart`, `DonutChart`, `FunnelChart`, `BarList`, `Heatmap`, `StatTrend`, `Sparkline`, `ProgressRing` | All inside `ChartFrame`: title, takeaway, source, a 'View as table' option, and hover plus keyboard values. |
| Status | `Badge`, `StatusPill` | 20px, badge corners, text always explicit. |
| Panel | `Card` (+ `CardHeader/Title/Description/Content/Footer`) | White, card shadow, 5px. |
| Numbers | `Stat` in `StatGroup` | Label, metric, change and provenance. |
| Tabular data | `DataTable`, or `TableFrame/Table/THead/TBody/Tr/Th/Td/CellStack` | Header 36px at 12px. Rows 44px at 13px. Numbers right-aligned. |
| Views within a page | `Tabs`, `Segmented` | White items, black active item. |
| Overlays | `Dialog`/`DialogContent`, `ConfirmDialog`, `Sheet` | Reckless dialog title. Footer buttons right-aligned, primary last. |
| Menus | `DropdownMenu*`, `Tooltip` | 32px items at 13px. Group labels use `text-overline`. |
| Messages | `Callout` (info/success/warning/danger), `toast()` | A callout for persistent context, a toast for confirmations. |
| Nothing yet | `EmptyState` | Always offers the next step. |
| Progress | `Progress`, `Meter`, `StepList` | |
| Small things | `Avatar`, `Kbd`, `Separator`, `IconTile` | |
| Everything else | `src/components/ds/<area>` | Navigation, forms, data grid, charts, filters, feedback, overlays, accounts, billing, collaboration, AI, onboarding. See `/design-system/v2`. |
| Page scaffold | `PageHeader` (`components/app/results/QueryBoundary.tsx`) | Every app screen starts with it: optional overline, Reckless Neue title, one-line description, actions on the right. |

## 3. Accessibility (non-negotiable)

- **Contrast is tested in CI** (`tests/unit/contrast.test.ts`): 4.5:1 for all text pairs, 3:1 for control borders (`border-control`), focus outlines, meaningful lime (`sun-strong`) and chart colours. Plain `sun`/`lime` is decorative only.
- **Axe scans** (WCAG 2.2 AA) run in e2e on the landing page, pricing, the demo app and `/design-system/v2`.
- Never put text below `text-ink-3`, and never lower text opacity (`text-ink/60`). Use `text-2xs` only for overlines, axis labels and kbd.
- Every icon-only control has an `aria-label`, and `IconButton` shows it as a tooltip. Hover-only information must also be reachable by keyboard: charts support arrow keys, and tooltips open on focus.
- Targets are at least 24×24px (WCAG 2.5.8). Controls are 32px or larger.
- Motion honours `prefers-reduced-motion`.

## 4. Patterns

- **Page:** `PageHeader` → optional toolbar row (filters left, actions right) → content in cards or a table. One primary button per view.
- **List and detail:** a table or list on the left and a detail panel on the right at ≥1024px. Stack them on mobile.
- **Forms:** one column, max width 560px. Group with `heading-section`. Primary submit at bottom right. Use clear error text, never colour alone.
- **Empty, loading and error states** exist for every data view. Loading uses `Skeleton`s in the shape of the content.
- **Writing:**
  - Use plain words for non-technical owners. Say what happens next.
  - Buttons are verbs: "Approve post", not "OK".
  - Don't show internal names or IDs.
