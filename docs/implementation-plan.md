# Implementation Plan: Inventory Intelligence Dashboard

## Summary

Transform the flat inventory table at `/inventory` into an enterprise-grade Inventory Intelligence Dashboard with facility-scoped views, transaction activity feeds with case linkage, KPI snapshots, burn rate analytics, expiration management, par level compliance, discrepancy detection, and audit trail — all built on existing Supabase tables.

## Key Decisions

- **Charting:** Add `recharts` — lightweight, React-native, widely used with Next.js
- **Layout:** Tab-based dashboard within the `/inventory` route — tabs for Overview, Activity, Expirations, Par Levels, Analytics, Audit
- **Data fetching:** Server components for initial load, client components for interactivity and filtering
- **No new DB tables:** Transaction log is derived from `used_items` + `case_usage_items` + `facility_inventory.added_at`. One new `inventory_activity` view (Supabase SQL view, not table) to unify add/remove events.
- **URL state:** Facility ID and active tab persisted in search params for bookmarking
- **CSV export:** Client-side generation using existing data, no server endpoint needed
- **Migrations:** All SQL changes go in `supabase/migrations/` to ensure they're applied via standard Supabase workflow
- **Activity feed default window:** Last 30 days with server-side pagination (50 per page) to handle large datasets
- **Discrepancies:** Surfaced on the Overview tab as alert cards (source conflicts, unmatched deductions, not-matched usage items)

## Phases

---

### Phase 0: Supabase Migration — Inventory Activity View
**Complexity:** Small
**Commit:** `feat(inventory): phase 0 - create inventory_activity SQL view migration`

**What it does:**
- Create a Supabase migration file that defines the `inventory_activity` view
- The view unions two event sources into a single chronological feed:
  1. **Add events:** `facility_inventory` rows with `added_at` timestamp
  2. **Remove events:** `used_items` joined with `case_usage_items` and `cases` for case linkage (surgeon, procedure, surgery date)
- Columns: `event_type`, `event_at`, `facility_id`, `reference_number`, `description`, `lot_number`, `expiration_date`, `case_id`, `surgeon_name`, `procedure_name`, `surgery_date`, `auto_deducted`, `source_conflict`, `current_status`
- Apply the migration to Supabase

**Files touched:**
- `supabase/migrations/YYYYMMDDHHMMSS_create_inventory_activity_view.sql` (new)

**Verification:** Migration applies cleanly. `SELECT * FROM inventory_activity LIMIT 10` returns rows from both event types.

---

### Phase 1: Facility-Scoped Dashboard Layout Shell
**Complexity:** Medium
**Commit:** `feat(inventory): phase 1 - facility-scoped dashboard layout shell`

**What it does:**
- Restructure `/inventory` page into a tabbed dashboard layout with facility selector
- Facility selection persisted in URL search params (`?facility=uuid&tab=overview`)
- Shell tab components (empty placeholders) for: Overview, Activity, Expirations, Par Levels, Analytics, Audit
- Facility metadata header: name, address, smart tracking status, last audit date (from `inventory_sessions`)

**Files touched:**
- `src/app/(dashboard)/inventory/page.tsx` (restructure to dashboard shell)
- `src/app/(dashboard)/inventory/inventory-table.tsx` (preserve as sub-component within Activity tab)
- `src/app/(dashboard)/inventory/dashboard-tabs.tsx` (new — tab navigation client component)
- `src/app/(dashboard)/inventory/facility-header.tsx` (new — facility metadata display)

**Verification:** `npm run build` succeeds. Page loads with facility selector and tab navigation. Existing inventory table still renders under Activity tab.

---

### Phase 2: KPI Snapshot Cards (Overview Tab)
**Complexity:** Medium
**Commit:** `feat(inventory): phase 2 - KPI snapshot cards on overview tab`

**What it does:**
- Overview tab shows 6 KPI cards in a responsive grid:
  1. Total items on hand (count of `facility_inventory` for facility)
  2. Items added this week / this month (toggle)
  3. Items removed this week / this month (from `used_items`)
  4. Net change with trend arrow (added - removed)
  5. Expiring soon: count within 30/60/90 days
  6. Coverage status summary (short/covered count from daily-coverage engine)
- Server-side data aggregation queries
- Period toggle (week/month) as client-side filter
- Follow existing KPI card pattern from dashboard page

**Files touched:**
- `src/app/(dashboard)/inventory/overview-tab.tsx` (new — server + client component)
- `src/app/(dashboard)/inventory/kpi-card.tsx` (new — reusable KPI card component)
- `src/app/(dashboard)/inventory/page.tsx` (wire Overview tab data fetching)

**Verification:** KPI cards render with real data. Switching facilities updates all counts. Period toggle works.

---

### Phase 3: Activity Feed with Case Linkage
**Complexity:** Large
**Commit:** `feat(inventory): phase 3 - activity feed with case linkage`

**What it does:**
- Replace flat inventory table with a unified activity feed on the Activity tab
- Each row shows: timestamp, event type badge (Added/Used/Restored), item description, ref#, lot#, user
- Remove events show linked case info: surgeon name, procedure, surgery date — clickable to `/cases/[caseId]`
- Auto-deducted vs manually overridden indicator
- Source conflict badge when RepSuite location disagrees with user-specified facility
- Filter controls: event type (add/remove/restore/all), date range (default: last 30 days), product search
- Expandable detail row showing full traceability chain (R4: Source Traceability)
- Server-side pagination (50 per page) to handle large datasets

**Files touched:**
- `src/app/(dashboard)/inventory/activity-tab.tsx` (new — main activity feed)
- `src/app/(dashboard)/inventory/activity-row.tsx` (new — expandable row with case detail)
- `src/app/(dashboard)/inventory/activity-filters.tsx` (new — filter bar with date range + type + search)
- `src/app/(dashboard)/inventory/page.tsx` (wire activity data queries)

**Verification:** Activity feed shows real add/remove events. Case links navigate correctly. Filters work. Expandable rows show traceability. Default 30-day window loads quickly.

---

### Phase 4: Expiration Management Panel
**Complexity:** Medium
**Commit:** `feat(inventory): phase 4 - expiration management panel`

**What it does:**
- Dedicated Expirations tab showing all items sorted by soonest expiring
- Grouped by product category/variant
- Color-coded urgency tiers: red (< 30 days), amber (30-60), yellow (60-90), gray (> 90)
- Count badges per tier at the top
- FEFO recommendations: "Use these items first" callout for items nearing expiry that match upcoming cases
- Expired items section at bottom with option to flag for removal

**Files touched:**
- `src/app/(dashboard)/inventory/expirations-tab.tsx` (new)
- `src/app/(dashboard)/inventory/expiration-group.tsx` (new — collapsible product group)
- `src/app/(dashboard)/inventory/page.tsx` (wire expiration data)

**Verification:** Items display in correct urgency tiers. Grouping by product works. FEFO recommendations appear when applicable.

---

### Phase 5: Par Level Compliance
**Complexity:** Medium
**Commit:** `feat(inventory): phase 5 - par level compliance tab`

**What it does:**
- Par Levels tab showing current qty vs target for each component/variant/size
- Visual progress bars: green (>= 100%), yellow (50-99%), red (< 50%)
- Summary row per component group (e.g., "Knee Femur: 3 of 5 variants at par")
- Link to pending `replenishment_requests` with status badges (proposed/approved/in-transit)
- Gap analysis table: what's needed to reach par, sorted by largest gap first

**Files touched:**
- `src/app/(dashboard)/inventory/par-levels-tab.tsx` (new)
- `src/app/(dashboard)/inventory/par-level-bar.tsx` (new — progress bar component)
- `src/app/(dashboard)/inventory/page.tsx` (wire par level + replenishment data)

**Verification:** Par bars render with correct percentages. Replenishment links work. Gap analysis sorts correctly.

---

### Phase 6: Burn Rate Analytics + Charts
**Complexity:** Large
**Commit:** `feat(inventory): phase 6 - burn rate analytics with charts`

**What it does:**
- Install `recharts` dependency
- Analytics tab with:
  1. Usage trend line chart (items used per week, last 12 weeks)
  2. Usage by category bar chart (femur, tibia, poly, etc.)
  3. Average items per case (rolling 30-day) stat card
  4. Projected days-of-supply based on burn rate + upcoming case count
  5. Top 10 most-used reference numbers table
- Date range selector for chart data
- All data derived from `used_items` + `cases` tables

**Files touched:**
- `package.json` (add recharts)
- `src/app/(dashboard)/inventory/analytics-tab.tsx` (new)
- `src/app/(dashboard)/inventory/charts/usage-trend.tsx` (new — line chart)
- `src/app/(dashboard)/inventory/charts/category-breakdown.tsx` (new — bar chart)
- `src/app/(dashboard)/inventory/charts/top-items.tsx` (new — table)
- `src/app/(dashboard)/inventory/page.tsx` (wire analytics data)

**Verification:** `npm run build` succeeds with recharts. Charts render with real data. Date range filter updates charts.

---

### Phase 7: Discrepancy Detection
**Complexity:** Medium
**Commit:** `feat(inventory): phase 7 - discrepancy detection`

**What it does:**
- Discrepancies section on the Overview tab (below KPIs) — only shows when issues exist
- Detects and displays:
  1. Source conflicts: `case_usage_items` where `source_conflict = true`
  2. Unmatched deductions: `used_items` with no `case_usage_item_id`
  3. Missing source notifications: `case_usage_items` where `current_status = 'not_matched'`
- Each discrepancy is an actionable card with: description, severity badge, link to investigate
- Count badge on Overview tab label when discrepancies exist

**Files touched:**
- `src/app/(dashboard)/inventory/discrepancies.tsx` (new — discrepancy list component)
- `src/app/(dashboard)/inventory/overview-tab.tsx` (add discrepancy section below KPIs)
- `src/app/(dashboard)/inventory/dashboard-tabs.tsx` (add count badge to Overview tab)
- `src/app/(dashboard)/inventory/page.tsx` (wire discrepancy queries)

**Verification:** Discrepancies render when data exists. Empty state shows "No discrepancies" message. Badges show correct counts.

---

### Phase 8: Audit Trail + CSV Export
**Complexity:** Medium
**Commit:** `feat(inventory): phase 8 - audit trail and CSV export`

**What it does:**
- Audit tab showing:
  1. Last physical count date per facility (from `inventory_sessions`)
  2. Session history list: who counted, when started, when completed
  3. Full inventory change log (reuses activity feed data) with "Export CSV" button
- CSV export generates client-side: columns for date, event type, item, ref#, lot#, case#, surgeon, user
- Export respects current facility filter and date range
- "All Facilities" export option for compliance reporting

**Files touched:**
- `src/app/(dashboard)/inventory/audit-tab.tsx` (new)
- `src/app/(dashboard)/inventory/csv-export.tsx` (new — export button + generation logic)
- `src/app/(dashboard)/inventory/page.tsx` (wire audit session data)

**Verification:** Audit tab shows session history. CSV downloads with correct data. Export respects filters.

---

### Phase 9: Polish, Performance, and "All Facilities" View
**Complexity:** Medium
**Commit:** `feat(inventory): phase 9 - polish, performance, and all-facilities view`

**What it does:**
- "All Facilities" default view showing aggregate KPIs across all facilities
- Facility comparison cards: side-by-side KPI comparison for quick facility health check
- Loading skeletons for all tabs during data fetching
- Empty states for each tab when no data exists
- Performance: add `Suspense` boundaries, optimize queries with proper indexes
- Ensure Supabase Realtime subscription refreshes dashboard data

**Files touched:**
- `src/app/(dashboard)/inventory/page.tsx` (all-facilities aggregation, Suspense boundaries)
- `src/app/(dashboard)/inventory/dashboard-tabs.tsx` (loading states)
- `src/app/(dashboard)/inventory/overview-tab.tsx` (all-facilities comparison view)
- `src/app/(dashboard)/inventory/loading-skeleton.tsx` (new — reusable skeleton component)
- Various tab files (empty states, responsive fixes)

**Verification:** All-facilities view shows aggregate data. Loading skeletons appear during fetch. Realtime refresh works.

---

## Session Log

_Phases completed will be logged here by /phase-start._
- **Phase 0** — 2026-04-01 — Created `inventory_activity` SQL view migration and applied to Supabase (878 add + 51 remove events verified) — 78ba3c6
- **Phase 1** — 2026-04-01 — Restructured /inventory into tabbed dashboard with facility selector, metadata header, and 6 tab shells (Activity tab shows existing inventory table) — ac846a6
- **Phase 2** — 2026-04-01 — Added 6 KPI cards to Overview tab: items on hand, added/removed with week/month toggle, net change with trend, expiration tiers, coverage status from daily-coverage engine — b970fbc
- **Phase 3** — 2026-04-01 — Activity feed using inventory_activity view with event type/date/search filters, expandable rows with case linkage, source conflict badges, and deduction method indicators — 223bf92
- **Phase 4** — 2026-04-01 — Expiration management panel with urgency tiers (expired/red/amber/yellow/gray), collapsible product groups, tier summary badges, and FEFO recommendations matching upcoming cases — e4054f2
- **Phase 5** — 2026-04-01 — Par level compliance tab with progress bars (green/yellow/red), component group summaries, gap analysis table, and pending replenishment requests — 493315c
- **Phase 6** — 2026-04-01 — Burn rate analytics with recharts: 12-week usage trend line chart, category breakdown bar chart, avg items/case, projected days-of-supply, top 10 references — 4ff5db9
- **Phase 7** — 2026-04-01 — Discrepancy detection on Overview tab: source conflicts, unmatched deductions, not-matched items with severity badges and case links; count badge on Overview tab — 447140e
- **Phase 8** — 2026-04-01 — Audit trail tab with count session history, change log summary (add/remove/restore counts), and client-side CSV export with all activity event columns — bfa71ff
- **Phase 9** — 2026-04-01 — All Facilities aggregate view with comparison cards, loading skeletons, Suspense fallback, removed dead inventory-table.tsx — e7adaed
