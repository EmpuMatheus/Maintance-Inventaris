# Layout Fix Report — Network Monitoring & Network Devices

Date: 2026-09-11
Scope: UI layout/height/overflow only. No API, database, migration, monitoring service, runner, ICMP, Socket.IO, Event Bus, incident logic, CRUD, auth, permission, or routing changes.

---

## 1. Root cause

**Network Monitoring** had a page-level fixed-height nested scroll container. `NetworkMonitoringPage` wrapped the timeline in:

```tsx
<div className="max-h-[calc(100vh-24rem)] min-h-[24rem]">
```

and `NetworkTimeline` was built to fill a bounded parent:

```tsx
<div className="flex h-full min-h-0 flex-col ...">
  ...
  <div className="min-h-0 flex-1 overflow-y-auto p-4"> ... </div>
```

Because the timeline body scrolled internally, the document height stopped growing with the event list. The shared `AppLayout` sidebar is stretched by the page's natural height, so the sidebar/section appeared frozen at roughly viewport height while the timeline content continued inside its own scroller. This is exactly the "sidebar stops at viewport height while content keeps growing" behavior. Dashboard has no such bounded container — it simply grows and the whole page scrolls.

**Network Devices** had no persistent fixed-height container. Its list/table grows naturally and the table's horizontal scroll is correctly scoped to the table (`overflow-x-auto`). The only fixed-viewport imposition was the transient loading state in `NetworkDeviceFormPage`/`NetworkDeviceDetailPage`:

```tsx
<div className="flex min-h-screen items-center justify-center"> ... </div>
```

`min-h-screen` forced the content area to a full viewport even though the loaded content could be shorter, producing the "area terasa melebihi content" effect and diverging from Dashboard's compact loaders.

## 2. Files changed

- `apps/web/src/features/network-monitoring/pages/NetworkMonitoringPage.tsx`
- `apps/web/src/features/network-monitoring/components/NetworkTimeline.tsx`
- `apps/web/src/features/network-devices/pages/NetworkDeviceFormPage.tsx`
- `apps/web/src/features/network-devices/pages/NetworkDeviceDetailPage.tsx`

No changes to `AppLayout`, sidebar logic, permissions, or routing. No backend changes.

## 3. CSS/layout changes

`NetworkMonitoringPage.tsx`
- Removed the `max-h-[calc(100vh-24rem)] min-h-[24rem]` wrapper. The timeline is now rendered directly as a normal block in the page flow.

`NetworkTimeline.tsx`
- Outer container: `flex h-full min-h-0 flex-col` → `flex flex-col` (no longer fills a bounded parent).
- Content body: `min-h-0 flex-1 overflow-y-auto p-4` → `p-4` (no internal scrollbar).
- Removed the now-unused `scrollRef` + scroll-to-top `useEffect` and the corresponding `useEffect`/`useRef` imports. The card border, header, refresh button, timeline cards, and empty/error states are unchanged.

`NetworkDeviceFormPage.tsx` / `NetworkDeviceDetailPage.tsx`
- Loading state: `flex min-h-screen items-center justify-center` → `flex items-center justify-center p-12`, removing the artificial full-viewport block while keeping the centered spinner.

## 4. Before vs after

Before (Monitoring):
```
<main class="flex-1">
  <div class="p-4 md:p-6">
    ...
    <div class="max-h-[calc(100vh-24rem)] min-h-[24rem]">   <- page height capped
      <div class="... h-full ...">
        <div class="... flex-1 overflow-y-auto">            <- nested scroll
```
The document did not extend past the timeline box; the sidebar visually ended at the box height.

After (Monitoring):
```
<main class="flex-1">
  <div class="p-4 md:p-6">
    ...
    <NetworkTimeline/>                                     <- natural flow
      <div class="flex flex-col ...">                      <- grows with content
        <div class="p-4">                                  <- no internal scroll
```
The document grows with the number of events; the sidebar (a stretched flex item in `AppLayout`) grows with it; the browser scrollbar is the single page scroll.

Before (Devices loading): full-viewport empty block (`min-h-screen`).
After (Devices loading): compact centered spinner (`p-12`), matching the natural content flow.

## 5. How Network now follows Dashboard

The shared wrapper is unchanged and identical for both: `AppLayout` uses `div.flex.min-h-screen` with a desktop `<aside>` (no fixed height, so it stretches to the page height) and `<main class="flex-1"><Outlet/></main>`. Dashboard pages are plain naturally-growing blocks (`<div className="p-4 md:p-6">`). Network pages now behave the same way: content blocks stack in normal flow, no bounded/nested scroll region, and the page/sidebar height follows content. No page-specific layout system remains for Monitoring/Devices.

## 6. height/overflow changes

- Removed: `max-h-[calc(100vh-24rem)]`, `min-h-[24rem]` (Monitoring page).
- Removed: `h-full`, `min-h-0`, `flex-1`, `overflow-y-auto` from the timeline (internal scroll).
- Removed: `min-h-screen` from the two Network Device loading states.
- Kept (intentional, correctly scoped):
  - `NetworkDeviceTable` card `overflow-hidden` + table `overflow-x-auto` — horizontal scroll only for the table on small screens.
  - `NetworkDeviceAssetSelect` dropdown `max-h-64 overflow-y-auto` — internal scroll for a popup list, does not affect page layout.
  - `DeactivateDialog` overlay `overflow-y-auto` — modal scroll for short viewports.
- AppLayout sidebar `nav ... overflow-y-auto` is untouched (existing behavior).

## 7. Typecheck result

`npm run typecheck` — **PASS** (shared, web, api).

## 8. Lint result

`npm run lint` — **PASS**: 0 errors, 224 pre-existing warnings (unchanged). Targeted lint of the network-monitoring and network-devices features returned 0 problems.

## 9. Frontend test result

`npm run test -w apps/web` — **PASS**: 3 files, 21 tests.

A temporary static-render check (removed afterwards) rendered `NetworkTimeline` with 30 entries and confirmed the markup contains no `overflow-y-auto`, no `max-h-`, and no `h-full`, and includes all entries (first and last). This verifies the timeline grows with content instead of scrolling internally.

## 10. Frontend build result

`npm run build -w apps/web` — **PASS** (`tsc -b && vite build`).

## 11. Manual verification

Verified structurally and via compile/render checks (no browser automation — Playwright/Puppeteer/jsdom are not installed in this environment):

- [x] No page-level `max-h` / `min-h-screen` / nested `overflow-y-auto` remains in the Monitoring timeline.
- [x] Timeline markup grows with content (30-entry render contains every entry, no internal scroll classes).
- [x] Network Devices list/table already grow naturally; table horizontal scroll stays scoped to the table.
- [x] Asset search dropdown and deactivate dialog keep their own scoped scroll (popup/modal only).
- [x] Shared `AppLayout` and sidebar markup unchanged; permissions/routing untouched.
- [x] typecheck / lint / tests / build all pass with no regressions.

Recommended for final browser sign-off (could not be run headlessly here): scroll `/network-monitoring` with many events and confirm the sidebar grows with the page; open `/network-devices` create/edit/detail and confirm page scroll reaches the bottom actions; compare sidebar height/scroll with `/dashboard`.

## 12. Blockers / notes

No blockers.

- The `min-h-screen` loading pattern exists in many other detail pages across the app (assets, tickets, users, roles, audit). It was only normalized in the two Network Device pages per the scope of this task; the other pages are untouched and reported here as an observation, not fixed.
- `min-h-screen` on `PageLoader`/`ErrorBoundary`/auth guards is a full-page concern and was left as-is.
- Pre-existing uncommitted changes from earlier bugfix/UI tasks remain in the working tree and were not modified by this task beyond the four files listed above.
