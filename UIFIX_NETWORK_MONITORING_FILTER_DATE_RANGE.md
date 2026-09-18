# UI Fix Report — Network Monitoring Filter Layout + Date Range Picker

Date: 2026-09-11
Scope: frontend UI/UX of the `/network-monitoring` filter only. No backend, API, database, Socket.IO, Event Bus, monitoring logic, ICMP, or incident changes.

---

## 1. Files changed

- `apps/web/src/features/network-monitoring/components/NetworkFilters.tsx` (modified)
- `apps/web/src/features/network-monitoring/components/DateRangePicker.tsx` (new)

No other file was changed for this task. (`useNetworkMonitoring.ts`, `ReportTable.tsx`, and `vite.config.ts` still show as modified from the previous WebSocket/nested-button fix and were not touched here.)

## 2. Filter layout changes

Before: a single grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-6`, with the search spanning 2 columns and the From/To inputs sharing one cell. Native `<input type="date">` has a non-zero intrinsic minimum width, and grid/flex children default to `min-width: auto`, so at normal/laptop widths the row overflowed the card.

After:

- 12-column responsive grid: `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12`.
  - Search: `sm:col-span-2 lg:col-span-4`
  - Status: `lg:col-span-2`
  - Type: `lg:col-span-2`
  - Room: `lg:col-span-2`
  - Date Range: `sm:col-span-2 lg:col-span-2`
  - Total `lg`: 4 + 2 + 2 + 2 + 2 = 12 → one tidy row on normal/large desktop.
- Added `min-w-0` to the shared input class and to the date-range cell, eliminating grid/flex overflow from intrinsic widths.
- The layout keeps existing styling (border, radius, padding, typography, focus ring colors) unchanged.

## 3. Date range component used

No rich range component existed: the project has no shadcn/ui Calendar, no Radix UI, and no `react-day-picker`. The only existing `DateRangePicker.tsx` (in `features/reports/components`) is just two native date inputs side by side, so it did not satisfy the single-field range requirement.

The project already depends on **`date-fns` v4.4.0** (unused until now). A new self-contained `DateRangePicker.tsx` was created using `date-fns` and a `createPortal` popover. **No new package was added.**

Component behavior:

- Trigger renders as a single field: `[📅 Sep 01, 2026 - Sep 11, 2026]`, or `[📅 Select date range]` when empty.
- Popover shows a two-month calendar on `md+` screens and one month on smaller screens (`matchMedia('(min-width: 768px)')`).
- Range selection: first click sets the start (not committed to state/API); second click completes the range. If the second date is earlier, start/end are swapped automatically.
- Changing start/end is supported (a completed range resets on the next click and starts a fresh selection).
- `Clear` button inside the popover resets the range; the page-level `Clear Filters` also resets it.
- Popover is rendered into `document.body` with `position: fixed` and computed coordinates, so it is never clipped by the card and is clamped inside the viewport (flips above the trigger when there is no room below).
- Escape closes and returns focus to the trigger; outside `mousedown` closes it.
- Accessibility: trigger has `aria-haspopup="dialog"`, `aria-expanded`, and `aria-label="Date Range"`; day cells are real buttons with full `aria-label` (e.g. "September 11, 2026") and `aria-pressed`; navigation buttons have `aria-label`; focus styles are preserved.

## 4. Mapping date range → API

The API contract is unchanged. The actual backend query parameters are `from` and `to` (see `apps/api/src/modules/network-monitoring/monitoring.controller.ts`, which reads `req.query.from` / `req.query.to`), not `fromDate`/`toDate`. The UI continues to emit exactly these.

Flow:

```
UI Date Range
  ↓
local state: { from, to }  (NetworkMonitoringFilters.from / .to)
  ↓
existing api filter: { from, to }  (useNetworkMonitoring.filtersToApi)
  ↓
GET /api/v1/network-monitoring/events?from=...&to=...
```

Date values are local-day boundaries converted to ISO UTC, matching the intent of the previous implementation (and actually more correct for the start date, which previously parsed `YYYY-MM-DD` as UTC midnight instead of local midnight):

- `from` = `startOfDay(startDate).toISOString()`
- `to` = `endOfDay(endDate).toISOString()`

Display converts the ISO value back to the user's local date (`format(new Date(iso), 'MMM dd, yyyy')`), so the shown range always matches the selected calendar days.

## 5. Responsive behavior

- Desktop large/normal (`lg`+): 12-column grid keeps Search, Status, Type, Room, and Date Range on one row inside the card.
- Laptop: fields wrap to a second row within the same card; `min-w-0` prevents overflow.
- Tablet (`sm`): 2-column grid; Search and Date Range span both columns (`sm:col-span-2`), Status/Type/Room sit in two columns.
- Mobile: single column, full width.
- No fixed pixel widths are used on the fields (`w-full min-w-0`). The only fixed widths are the popover's own measured size, which is clamped to the viewport.
- The popover uses `position: fixed` via a portal, so it cannot be clipped by the filter card and cannot create a horizontal scrollbar.

## 6. Test result

`npm run test -w apps/web` — **PASS**: 3 test files, 21 tests.

Additional temporary static-render checks were run and then removed:

- Confirmed the filter renders a single `aria-label="Date Range"` trigger, no native `type="date"` inputs, and no `aria-label="From date"` / `"To date"`.
- Confirmed a committed range displays as `Sep 01, 2026 - Sep 11, 2026`.

## 7. Typecheck result

`npm run typecheck` — **PASS** (shared, web, api).

## 8. Lint result

`npm run lint` — **PASS**: 0 errors, 224 pre-existing warnings (unchanged count; none introduced). Targeted lint of the two changed files returned 0 problems.

## 9. Build result

`npm run build -w apps/web` — **PASS** (`tsc -b && vite build`).

## 10. Manual check

Performed as far as the environment allows (no browser automation — no Playwright/Puppeteer/jsdom installed):

- [x] Backend started against the real Postgres DB; monitoring runner still ran at the unchanged 2-minute interval.
- [x] `GET /api/v1/network-monitoring/status` returns device data.
- [x] `GET /api/v1/network-monitoring/events?from=2026-09-01T00:00:00.000Z&to=2026-09-11T23:59:59.999Z` returns filtered events, confirming the `from`/`to` mapping the UI sends is accepted.
- [x] Static render confirms one Date Range field replaces the two native From/To inputs and the formatted label is correct.
- [x] Existing web tests, typecheck, lint, and build all pass (no regression).
- Interactive click-through (open popover, pick start/end, clear, wrap at laptop/tablet sizes) could not be exercised headlessly in this environment and is recommended for final browser sign-off.

## 11. Blockers

None for this task.

Out-of-scope findings (reported only, not changed):

- The existing `apps/web/src/features/reports/components/DateRangePicker.tsx` is still the old two-native-input control used by report filters. It was not modified because this task is limited to `/network-monitoring`; the two components are independent.
- The task description mentioned `fromDate`/`toDate`, but the codebase's actual contract is `from`/`to`. The API was left as-is per the "do not change the API contract" rule.
- `apps/web/package.json` test script contains a Windows-only `2>nul` redirect (also noted in the previous report); not modified.
- Pre-existing uncommitted changes from the earlier bugfix remain in the working tree and were left untouched.
