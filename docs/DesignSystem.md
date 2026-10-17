# ClimbOS design system ("Summit")

One system for every screen. When a screen needs something this file doesn't cover, add it here and to `src/components/ui` first, then use it. Never style a one-off.

**Inspiration.**
- Layout, sizing and density: Apollo.io.
- Surfaces: Airly's own taskeni.app (sage-grey ground, flat panels, tight corners).
- Type pairing: Meetrao (serif titles, sans UI).
- Identity: ClimbOS pine.

**The living reference** is `/design-system` (noindex). It renders every token and component. Check it after any change here.

## 1. Foundations

### Colour (tokens in `src/app/globals.css`)

| Role | Token | Use |
|---|---|---|
| Ground | `bg` #EEF0EE | App background behind panels. Marketing sections alternate `bg` and `surface`. |
| Panel | `surface` #FFF | Cards, tables, menus, dialogs, inputs. |
| Subtle fill | `surface-2` #F5F6F5 | Table header, hover, segmented-control track, wells. |
| Strong fill | `surface-3` #E3E7E4 | Progress tracks, pressed states, neutral badge. |
| Ink | `ink` #1C2220, `ink-2` #434B47, `ink-3` #59615C | Primary text, secondary text, meta, placeholders and labels. All pass AA on `bg` and `surface`. |
| Hairlines | `line` (9% ink), `line-strong` (17% ink) | Panel borders and dividers, control borders. |
| Brand | `brand-800` #0B5D46 (pine) with ramp 50–950 | Primary buttons, links, focus, selected nav, progress, success-in-context. |
| Highlight | `sun` #EC8B5E, `sun-soft` | Small highlights: active markers, the trust ladder, selection. **Never small text on sun.** Accent buttons use `ink` text. |
| Status | `green/amber/red/blue/violet/teal/pink/orange` 100 (fill), 500 (graphic), 800 (text) | Badges, callouts, icon tiles, charts. Always pair a fill with its 800 ink. |

Rules:
- Colour never carries meaning alone. Every status has text and usually an icon.
- No raw hex values in components. Use tokens. If a token is missing, add it to `globals.css`.

### Type

Fonts:
- **Inter** for all UI.
- **Spectral** for page titles and big numbers.
- **EB Garamond** for marketing headlines only.

| Style | Class | Spec | Use |
|---|---|---|---|
| Display | `.marketing h1` + `text-5xl`–`7xl` | EB Garamond 500 | Marketing hero only. |
| Headline | `.marketing h2` + `text-4xl` | EB Garamond 500 | Marketing section titles. |
| Page title | `heading-page` (all `h1` default to Spectral) | Spectral 28/36 500 | One per screen, via `PageHeader`. |
| Section title | `heading-section` | Inter 16/24 600 | `h2` inside a page: groups of cards, settings sections, empty-state titles. |
| Card title | `heading-card` / `CardTitle` | Inter 14/20 600 | `h3` on cards, panels, list items, toasts. |
| Dialog title | `text-xl font-semibold` | Inter 18/26 600 | Dialog and sheet titles (built into `DialogContent`). |
| Body | `text-sm` (default) | Inter 14/20 400 | Paragraphs and descriptions in the app. |
| Long-form | `text-base` | Inter 15/24 | Marketing body, legal and help pages. |
| UI | `text-ui` | Inter 13/18 | Buttons, inputs, labels, nav, table cells, tabs, menu items. |
| Caption | `text-xs` | Inter 12/16 | Meta, timestamps, table headers, badges, hints. |
| Overline | `text-overline` | Inter 11/16 600 caps +0.06em | Group labels in nav, menus and above titles. |
| Metric | `metric` | Spectral 28/32 tabular | Big numbers on stat cards and pricing. |

Rules:
- Use only three weights: 400 (text), 500 (UI labels and buttons), 600 (headings and emphasis). No bold or extrabold.
- Don't use arbitrary `text-[Npx]` sizes. Only the scale above exists.
- Use sentence case everywhere: buttons, titles, table headers. Uppercase is only for `text-overline`.

### Space, size, shape

- Spacing uses a 4px grid. Tailwind steps 1, 1.5, 2, 3, 4, 5, 6, 8, 10 and 12 are allowed.
  - Inside a card: 20px padding (`p-5`), or 16px (`p-4`) when compact.
  - Between cards: 12px (`gap-3`) in dense grids, 16px (`gap-4`) otherwise.
  - Between page sections: 24–32px (`gap-6`/`gap-8`).
  - Page gutter: 24px (`px-6`), 32px at `lg`.
- **Control heights**, the same for every control:
  - sm is 32px (`h-8`).
  - md is 36px (`h-9`), the default.
  - lg is 40px (`h-10`).
  - Icon buttons are square at the same heights.
- **Corners:**
  - 4px: checkboxes, kbd.
  - 5px (`rounded-md`): badges, menu items, tabs.
  - 6px (`rounded-lg`): buttons, inputs, selects.
  - 8px (`rounded-xl`): cards, tables, menus, popovers, toasts, callouts.
  - 10px (`rounded-2xl`): dialogs, sheets.
  - `rounded-full`: avatars, dots, switches, progress bars.
- **Elevation:** panels are flat (hairline only). Only floating layers cast a shadow: menus, selects, popovers, dialogs and toasts use `shadow-lg`. The selected tab uses `shadow-sm`.
- **Icons:** Lucide at 16px in controls, 14px in badges, 20px in empty states and tiles. Icons are decorative (`aria-hidden`) unless they are the only content of a control, which then needs `aria-label`.
- **Focus:** a 2px pine outline with a 2px offset on everything. Never remove it.

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
| Status | `Badge`, `StatusPill` | 20px, 5px corners, text always explicit. |
| Panel | `Card` (+ `CardHeader/Title/Description/Content/Footer`) | Flat, hairline, 8px. |
| Numbers | `Stat` in `StatGroup` | Label, metric, change and provenance. |
| Tabular data | `DataTable`, or `TableFrame/Table/THead/TBody/Tr/Th/Td/CellStack` | Header 36px at 12px. Rows 44px at 13px. Numbers right-aligned. |
| Views within a page | `Tabs` | Segmented look: 32px track, 28px tabs. |
| Overlays | `Dialog`/`DialogContent`, `ConfirmDialog`, `Sheet` | Title 18px. Footer buttons right-aligned, primary last. |
| Menus | `DropdownMenu*`, `Tooltip` | 32px items at 13px. Group labels use `text-overline`. |
| Messages | `Callout` (info/success/warning/danger), `toast()` | A callout for persistent context, a toast for confirmations. |
| Nothing yet | `EmptyState` | Always offers the next step. |
| Progress | `Progress`, `Meter`, `StepList` | |
| Small things | `Avatar`, `Kbd`, `Separator`, `IconTile` | |
| Page scaffold | `PageHeader` (`components/app/results/QueryBoundary.tsx`) | Every app screen starts with it: optional overline, Spectral title, one-line description, actions on the right. |

## 3. Accessibility (non-negotiable)

- **Contrast is tested in CI** (`tests/unit/contrast.test.ts`): 4.5:1 for all text pairs, 3:1 for control borders (`border-control`), focus outlines, meaningful sunrise (`sun-strong`) and chart colours. Plain `sun` is decorative only.
- **Axe scans** (WCAG 2.2 AA) run in e2e on the landing page, pricing, the demo app and `/design-system`.
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
