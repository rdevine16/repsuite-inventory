# Feature: Inventory Intelligence Dashboard

## Goal

Replace the current flat inventory table with an enterprise-grade **Inventory Intelligence Dashboard** that provides full transparency into what inventory exists, what changed, why it changed, and what needs attention — all scoped per facility.

## Background

The current inventory page (`/inventory`) is a basic searchable/sortable table of `facility_inventory` rows. While functional, it lacks:
- Facility-first navigation
- Transaction history (adds/removes over time)
- Case linkage (which surgery consumed an item)
- KPI summaries and trend data
- Expiration management
- Par level compliance visibility
- Audit trail for regulatory transparency

The data infrastructure already exists (`used_items`, `case_usage_items`, `inventory_sessions`, `cases`, `component_par_levels`, `replenishment_requests`) — the UI just doesn't surface it.

## Requirements

### R1: Facility Selector & Scoping
- Top-level facility picker (dropdown or sidebar) that scopes the entire dashboard
- Persist selected facility in URL params for shareability
- Show facility metadata: name, address, smart tracking status, last audit date

### R2: Inventory Snapshot KPIs
- Total items on hand
- Items added this period (week/month toggle)
- Items removed this period
- Net change with trend indicator (up/down arrow)
- Items expiring within 30/60/90 days
- Coverage status summary (from daily-coverage engine)

### R3: Activity Feed / Transaction Log
- Chronological feed of all inventory changes for the selected facility
- **Add events:** item scanned in, item restored from case
- **Remove events:** auto-deducted after case, manual removal, expired pull
- Each event shows: timestamp, item description, ref number, lot, quantity, user who performed action
- **Case linkage:** remove events tied to a case show surgeon name, procedure, surgery date, clickable case link
- Filterable by: event type (add/remove/restore), date range, product category
- Searchable by ref number, lot number, description

### R4: Source Traceability
- For every removed item, show full chain:
  - Case ID, surgeon, procedure, surgery date
  - Lot number + expiration (recall traceability)
  - Auto-deducted vs manually overridden flag
  - Source conflict indicator (RepSuite location vs user-specified facility)
- Expandable detail row or slide-over panel

### R5: Burn Rate Analytics
- Usage velocity by product category (femur, tibia, poly, etc.)
- Average items used per case (rolling 30-day)
- Projected days-of-supply based on upcoming case schedule
- Visual chart (bar or line) showing usage trends over time

### R6: Expiration Management Panel
- Dedicated tab/section for expiration tracking
- Items sorted by soonest expiring, grouped by product
- FEFO (First Expired, First Out) recommendations
- Cost exposure estimate from soon-to-expire inventory
- Color-coded urgency: red (< 30 days), amber (30-60), yellow (60-90)

### R7: Par Level Compliance
- Per component/variant: current qty vs par level target
- Color-coded status bars (green >= 100%, yellow 50-99%, red < 50%)
- Link to pending replenishment requests with status
- Gap analysis: what's needed to reach par

### R8: Discrepancy Detection
- Highlight anomalies:
  - Items deducted with no matching case
  - Usage quantity > expected for a case
  - Source conflicts between RepSuite and user-specified facilities
  - Inventory that disappeared without a deduction record
- Actionable: click to investigate, resolve, or flag for review

### R9: Audit Trail
- Last physical count date per facility (from `inventory_sessions`)
- System count vs physical count variance (if available)
- Full history exportable as CSV for compliance
- Session-level detail: who counted, when, what changed

## Acceptance Criteria

- [ ] User can select a facility and all dashboard data scopes to that facility
- [ ] KPI cards show accurate real-time counts with period-over-period trends
- [ ] Activity feed shows all add/remove events with case linkage for removals
- [ ] Each removed item traces back to the specific case, surgeon, and procedure
- [ ] Burn rate charts render with real usage data
- [ ] Expiration panel highlights items by urgency tier
- [ ] Par level compliance shows current vs target with visual indicators
- [ ] Discrepancies are surfaced with actionable detail
- [ ] Audit trail shows last count dates and supports CSV export
- [ ] Dashboard is responsive and performs well with 1000+ inventory items
- [ ] URL params preserve facility selection for bookmarking/sharing

## Constraints

- Must use existing Supabase tables — no new tables unless absolutely necessary for transaction logging
- Must work with existing RLS policies
- Must follow existing Next.js app router patterns and Tailwind CSS styling
- Server components for data fetching, client components for interactivity
- No new external dependencies unless justified (charting library exception)

## Out of Scope

- Mobile app (RepSuiteConnect) version — separate feature
- Push notifications for dashboard events (existing notification system handles this)
- Real-time WebSocket updates (existing Supabase Realtime subscription handles refresh)
- Modifying the case sync pipeline or auto-deduction logic
