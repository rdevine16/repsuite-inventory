import { createClient } from '@/lib/supabase-server'
import { Suspense } from 'react'
import DashboardShell from './dashboard-shell'
import { DashboardSkeleton } from './loading-skeleton'
import type { OverviewData } from './overview-tab'

interface FacilitySummary {
  id: string
  name: string
  itemCount: number
  expiring30: number
  removedThisMonth: number
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string; tab?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Fetch facilities with smart tracking flag
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address, smart_tracking_enabled')
    .order('name')

  const facilityList = facilities ?? []
  const selectedFacilityId = params.facility || facilityList[0]?.id || ''
  const isAllFacilities = selectedFacilityId === 'all'
  const activeTab = params.tab || 'overview'

  // Facility metadata
  const selectedFacility = isAllFacilities ? null : facilityList.find((f) => f.id === selectedFacilityId)

  // === All-Facilities Mode: aggregate KPIs + comparison cards ===
  if (isAllFacilities) {
    const { data: allItems } = await supabase
      .from('facility_inventory')
      .select('id, facility_id, expiration_date, added_at')

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const thirtyStr = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Build per-facility summaries
    const facilityMap = new Map<string, FacilitySummary>()
    for (const f of facilityList) {
      facilityMap.set(f.id, { id: f.id, name: f.name, itemCount: 0, expiring30: 0, removedThisMonth: 0 })
    }
    allItems?.forEach((item) => {
      const fs = facilityMap.get(item.facility_id)
      if (!fs) return
      fs.itemCount++
      if (item.expiration_date && item.expiration_date >= today && item.expiration_date <= thirtyStr) {
        fs.expiring30++
      }
    })

    // Get removal counts per facility this month
    const { data: monthlyRemovals } = await supabase
      .from('used_items')
      .select('facility_id')
      .gte('created_at', monthStart)

    monthlyRemovals?.forEach((r) => {
      const fs = facilityMap.get(r.facility_id)
      if (fs) fs.removedThisMonth++
    })

    const facilitySummaries = Array.from(facilityMap.values())
    const totalOnHand = facilitySummaries.reduce((s, f) => s + f.itemCount, 0)
    const totalExpiring30 = facilitySummaries.reduce((s, f) => s + f.expiring30, 0)

    const overviewData: OverviewData = {
      totalOnHand,
      addedThisWeek: 0,
      addedThisMonth: allItems?.filter((i) => i.added_at >= monthStart).length ?? 0,
      removedThisWeek: 0,
      removedThisMonth: monthlyRemovals?.length ?? 0,
      expiring30: totalExpiring30,
      expiring60: 0,
      expiring90: 0,
      coverageShort: 0,
      coverageCovered: 0,
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence</h1>
          <p className="text-gray-500 mt-1">Aggregate view across all facilities</p>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardShell
            facilities={facilityList.map((f) => ({ id: f.id, name: f.name }))}
            selectedFacilityId="all"
            activeTab={activeTab}
            facilityName="All Facilities"
            facilityAddress={null}
            smartTracking={false}
            lastAuditDate={null}
            overviewData={overviewData}
            activityEvents={[]}
            expirationItems={[]}
            upcomingRefNumbers={[]}
            parLevels={[]}
            onHandMap={{}}
            replenishments={[]}
            analyticsData={{ usedItems: [], totalOnHand, upcomingCaseCount: 0 }}
            discrepancies={[]}
            auditSessions={[]}
            facilitySummaries={facilitySummaries}
          />
        </Suspense>
      </div>
    )
  }

  // === Single Facility Mode ===

  // Audit sessions for selected facility
  const { data: auditSessions } = await supabase
    .from('inventory_sessions')
    .select('id, facility_id, started_at, completed_at, user_id')
    .eq('facility_id', selectedFacilityId)
    .order('started_at', { ascending: false })

  // Inventory items (used for KPI calculations)
  const { data: items } = await supabase
    .from('facility_inventory')
    .select('*, facilities(name)')
    .eq('facility_id', selectedFacilityId)
    .order('added_at', { ascending: false })

  // Activity feed from unified view
  const { data: activityEvents } = await supabase
    .from('inventory_activity')
    .select('*')
    .eq('facility_id', selectedFacilityId)
    .order('event_at', { ascending: false })

  // === KPI Data for Overview Tab ===
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Start of this week (Sunday)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekStartISO = weekStart.toISOString()

  // Start of this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartISO = monthStart.toISOString()

  // Total on hand
  const totalOnHand = items?.length ?? 0

  // Items added this week/month (from facility_inventory.added_at)
  const addedThisWeek = items?.filter((i) => i.added_at >= weekStartISO).length ?? 0
  const addedThisMonth = items?.filter((i) => i.added_at >= monthStartISO).length ?? 0

  // Items removed this week/month (from used_items)
  const { count: removedWeekCount } = await supabase
    .from('used_items')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', selectedFacilityId)
    .gte('created_at', weekStartISO)

  const { count: removedMonthCount } = await supabase
    .from('used_items')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', selectedFacilityId)
    .gte('created_at', monthStartISO)

  // Expiration tiers
  const thirtyDays = new Date(now)
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  const sixtyDays = new Date(now)
  sixtyDays.setDate(sixtyDays.getDate() + 60)
  const ninetyDays = new Date(now)
  ninetyDays.setDate(ninetyDays.getDate() + 90)

  const thirtyStr = thirtyDays.toISOString().split('T')[0]
  const sixtyStr = sixtyDays.toISOString().split('T')[0]
  const ninetyStr = ninetyDays.toISOString().split('T')[0]

  let expiring30 = 0
  let expiring60 = 0
  let expiring90 = 0

  items?.forEach((item) => {
    if (!item.expiration_date) return
    const exp = item.expiration_date
    if (exp < today) return // already expired, don't count
    if (exp <= thirtyStr) expiring30++
    else if (exp <= sixtyStr) expiring60++
    else if (exp <= ninetyStr) expiring90++
  })

  // Coverage summary — check tomorrow's cases
  let coverageShort = 0
  let coverageCovered = 0
  try {
    const { calculateDailyCoverage } = await import('@/lib/daily-coverage')
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const coverage = await calculateDailyCoverage(supabase, selectedFacilityId, tomorrowStr)
    coverageShort = coverage.coverage.filter((c) => c.status === 'short').length
    coverageCovered = coverage.coverage.filter((c) => c.status === 'covered').length
  } catch {
    // Coverage engine may fail if no cases — that's fine
  }

  // === Expiration Tab: upcoming case ref numbers for FEFO ===
  const sevenDaysOut = new Date(now)
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
  const { data: upcomingUsage } = await supabase
    .from('case_usage_items')
    .select('catalog_number, cases!inner(facility_id)')
    .eq('cases.facility_id', selectedFacilityId)

  const upcomingRefNumbers: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upcomingUsage?.forEach((u: any) => {
    if (u.catalog_number) upcomingRefNumbers.push(u.catalog_number)
  })

  // === Par Level Data ===
  const { data: parLevels } = await supabase
    .from('component_par_levels')
    .select('category, variant, size, par_quantity')
    .eq('facility_id', selectedFacilityId)

  // Build on-hand counts using inventory mapper
  const { buildOnHandCounts } = await import('@/lib/inventory-mapper')
  const onHandMap = buildOnHandCounts(
    (items ?? []).map((i) => ({ gtin: i.gtin, reference_number: i.reference_number }))
  )

  // Pending replenishment requests
  const { data: replenishments } = await supabase
    .from('replenishment_requests')
    .select('id, component, variant, kit_template_name, missing_sizes, status, surgeon_name, surgery_date, case_id')
    .eq('facility_id', selectedFacilityId)
    .in('status', ['proposed', 'approved'])
    .order('surgery_date', { ascending: true })

  // === Analytics Data ===
  const twelveWeeksAgo = new Date(now)
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  const { data: usedItemsForAnalytics } = await supabase
    .from('used_items')
    .select('reference_number, description, created_at')
    .eq('facility_id', selectedFacilityId)
    .gte('created_at', twelveWeeksAgo.toISOString())
    .order('created_at', { ascending: false })

  // Upcoming case count for avg-per-case calculation
  const { count: upcomingCaseCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', selectedFacilityId)
    .gte('surgery_date', now.toISOString())

  // === Discrepancy Detection ===
  const { data: sourceConflicts } = await supabase
    .from('case_usage_items')
    .select('id, catalog_number, part_name, lot_number, source_conflict, created_at, cases!inner(id, case_id, surgeon_name, facility_id)')
    .eq('source_conflict', true)
    .eq('cases.facility_id', selectedFacilityId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: unmatchedDeductions } = await supabase
    .from('used_items')
    .select('id, reference_number, description, lot_number, created_at')
    .eq('facility_id', selectedFacilityId)
    .is('case_usage_item_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: notMatched } = await supabase
    .from('case_usage_items')
    .select('id, catalog_number, part_name, lot_number, created_at, cases!inner(id, case_id, surgeon_name, facility_id)')
    .eq('current_status', 'not_matched')
    .eq('cases.facility_id', selectedFacilityId)
    .order('created_at', { ascending: false })
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discrepancies = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(sourceConflicts ?? []).map((sc: any) => ({
      id: sc.id,
      type: 'source_conflict' as const,
      description: sc.part_name,
      reference_number: sc.catalog_number,
      lot_number: sc.lot_number,
      case_id: sc.cases?.id ?? null,
      case_display_id: sc.cases?.case_id ?? null,
      surgeon_name: sc.cases?.surgeon_name ?? null,
      created_at: sc.created_at,
    })),
    ...(unmatchedDeductions ?? []).map((ud) => ({
      id: ud.id,
      type: 'unmatched_deduction' as const,
      description: ud.description,
      reference_number: ud.reference_number,
      lot_number: ud.lot_number,
      case_id: null,
      case_display_id: null,
      surgeon_name: null,
      created_at: ud.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(notMatched ?? []).map((nm: any) => ({
      id: nm.id,
      type: 'not_matched' as const,
      description: nm.part_name,
      reference_number: nm.catalog_number,
      lot_number: nm.lot_number,
      case_id: nm.cases?.id ?? null,
      case_display_id: nm.cases?.case_id ?? null,
      surgeon_name: nm.cases?.surgeon_name ?? null,
      created_at: nm.created_at,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const overviewData: OverviewData = {
    totalOnHand,
    addedThisWeek,
    addedThisMonth,
    removedThisWeek: removedWeekCount ?? 0,
    removedThisMonth: removedMonthCount ?? 0,
    expiring30,
    expiring60,
    expiring90,
    coverageShort,
    coverageCovered,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence</h1>
        <p className="text-gray-500 mt-1">Facility-scoped inventory dashboard with analytics and audit trail</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardShell
          facilities={facilityList.map((f) => ({ id: f.id, name: f.name }))}
          selectedFacilityId={selectedFacilityId}
          activeTab={activeTab}
          facilityName={selectedFacility?.name ?? ''}
          facilityAddress={selectedFacility?.address ?? null}
          smartTracking={selectedFacility?.smart_tracking_enabled ?? false}
          lastAuditDate={auditSessions?.[0]?.started_at ?? null}
          overviewData={overviewData}
          activityEvents={activityEvents ?? []}
          expirationItems={(items ?? []).map((i) => ({
            id: i.id,
            reference_number: i.reference_number,
            description: i.description,
            lot_number: i.lot_number,
            expiration_date: i.expiration_date,
            gtin: i.gtin,
          }))}
          upcomingRefNumbers={upcomingRefNumbers}
          parLevels={parLevels ?? []}
          onHandMap={onHandMap}
          replenishments={replenishments ?? []}
          analyticsData={{
            usedItems: usedItemsForAnalytics ?? [],
            totalOnHand,
            upcomingCaseCount: upcomingCaseCount ?? 0,
          }}
          discrepancies={discrepancies}
          auditSessions={auditSessions ?? []}
        />
      </Suspense>
    </div>
  )
}
