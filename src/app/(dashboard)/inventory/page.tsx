import { createClient } from '@/lib/supabase-server'
import { Suspense } from 'react'
import DashboardShell from './dashboard-shell'
import type { OverviewData } from './overview-tab'

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
  const activeTab = params.tab || 'overview'

  // Facility metadata
  const selectedFacility = facilityList.find((f) => f.id === selectedFacilityId)

  // Last audit date for selected facility
  const { data: lastSession } = await supabase
    .from('inventory_sessions')
    .select('started_at')
    .eq('facility_id', selectedFacilityId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Inventory items (used for KPI calculations and legacy table fallback)
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

      <Suspense fallback={<div className="text-sm text-gray-400">Loading dashboard...</div>}>
        <DashboardShell
          facilities={facilityList.map((f) => ({ id: f.id, name: f.name }))}
          selectedFacilityId={selectedFacilityId}
          activeTab={activeTab}
          facilityName={selectedFacility?.name ?? ''}
          facilityAddress={selectedFacility?.address ?? null}
          smartTracking={selectedFacility?.smart_tracking_enabled ?? false}
          lastAuditDate={lastSession?.started_at ?? null}
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
        />
      </Suspense>
    </div>
  )
}
