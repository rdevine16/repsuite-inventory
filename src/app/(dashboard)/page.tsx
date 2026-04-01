import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import UpcomingCases from './upcoming-cases'
import ReplenishmentProposals from './replenishment-proposals'
import SyncButton from './sync-button'
import RealtimeRefresh from './realtime-refresh'

const COMPONENT_NAMES: Record<string, Record<string, string>> = {
  knee_femur: { cr_pressfit: 'CR Pressfit Femur', cr_cemented: 'CR Cemented Femur', ps_pressfit: 'PS Pressfit Femur', ps_cemented: 'PS Cemented Femur', ps_pro_cemented: 'PS Pro Femur' },
  knee_tibia: { primary: 'Primary Tibia', universal: 'Universal Tibia', mis: 'MIS Tibia', tritanium: 'Tritanium Tibia' },
  knee_poly: { cs: 'CS Poly Insert', ps: 'PS Poly Insert', ts: 'TS Poly Insert' },
  knee_patella: { asym_cemented: 'Asymmetric Patella (Cem)', sym_cemented: 'Symmetric Patella (Cem)', asym_pressfit: 'Asymmetric Patella (PF)', sym_pressfit: 'Symmetric Patella (PF)' },
  hip_stem: { accolade_ii_132: 'Accolade II 132°', accolade_ii_127: 'Accolade II 127°', accolade_c_132: 'Accolade C 132°', accolade_c_127: 'Accolade C 127°', insignia_standard: 'Insignia Standard', insignia_high: 'Insignia High' },
  hip_cup: { trident_ii_tritanium: 'Trident II Tritanium Cup', trident_psl_ha: 'Trident PSL HA Cup' },
  hip_liner: { x3_0: 'X3 0° Liner', x3_10: 'X3 10° Liner', x3_ecc: 'X3 Eccentric Liner', mdm_cocr: 'MDM CoCr Liner', mdm_x3: 'MDM X3 Liner' },
  hip_head: { delta_ceramic: 'Delta Ceramic Head', v40_cocr: 'V40 CoCr Head' },
}

function formatComponentName(component: string, variant: string): string {
  // Handle side prefix: "Left cr_pressfit" → "Left CR Pressfit Femur"
  const sideMatch = variant.match(/^(Left |Right )(.+)$/)
  const side = sideMatch ? sideMatch[1] : ''
  const variantId = sideMatch ? sideMatch[2] : variant
  const name = COMPONENT_NAMES[component]?.[variantId] ?? `${component} (${variantId})`
  return `${side}${name}`
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address')
    .order('name')

  // Get last audit date per facility from sessions
  const { data: sessions } = await supabase
    .from('inventory_sessions')
    .select('facility_id, started_at')
    .order('started_at', { ascending: false })

  // Get item counts and expiration data per facility from facility_inventory
  const { data: allItems } = await supabase
    .from('facility_inventory')
    .select('id, facility_id, description, lot_number, expiration_date')

  const today = new Date().toISOString().split('T')[0]
  const ninetyDays = new Date()
  ninetyDays.setDate(ninetyDays.getDate() + 90)
  const ninetyDaysStr = ninetyDays.toISOString().split('T')[0]

  // Build per-facility stats
  const facilityStats: Record<string, {
    itemCount: number
    expiredCount: number
    expiringCount: number
    lastScan: string | null
  }> = {}

  allItems?.forEach((item: { facility_id: string; expiration_date: string | null }) => {
    const facilityId = item.facility_id
    if (!facilityId) return

    if (!facilityStats[facilityId]) {
      facilityStats[facilityId] = { itemCount: 0, expiredCount: 0, expiringCount: 0, lastScan: null }
    }
    facilityStats[facilityId].itemCount++

    if (item.expiration_date) {
      if (item.expiration_date < today) {
        facilityStats[facilityId].expiredCount++
      } else if (item.expiration_date <= ninetyDaysStr) {
        facilityStats[facilityId].expiringCount++
      }
    }
  })

  // Add last scan dates from sessions
  sessions?.forEach((s: { facility_id: string; started_at: string }) => {
    if (!facilityStats[s.facility_id]) {
      facilityStats[s.facility_id] = { itemCount: 0, expiredCount: 0, expiringCount: 0, lastScan: null }
    }
    if (!facilityStats[s.facility_id].lastScan) {
      facilityStats[s.facility_id].lastScan = s.started_at
    }
  })

  // Get cases for next 3 days (Eastern timezone)
  // RepSuite stores surgery dates as UTC offsets from Eastern (e.g., midnight ET = 04:00 or 05:00 UTC)
  // Use Eastern date boundaries to match correctly
  const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayET = eastern.format(new Date()) // "MM/DD/YYYY"
  const [mm, dd, yyyy] = todayET.split('/')
  const todayDateStr = `${yyyy}-${mm}-${dd}`
  const todayStart = new Date(`${todayDateStr}T00:00:00-04:00`) // EDT
  const threeDaysOut = new Date(todayStart)
  threeDaysOut.setDate(threeDaysOut.getDate() + 3)

  const { data: upcomingCases } = await supabase
    .from('cases')
    .select('id, case_id, surgeon_name, procedure_name, surgery_date, hospital_name, side, status, facility_id, plan_id, facilities(name)')
    .gte('surgery_date', todayStart.toISOString())
    .lt('surgery_date', threeDaysOut.toISOString())
    .order('surgery_date')

  // Get all implant plans for plan assignment dropdowns
  const { data: allPlans } = await supabase
    .from('surgeon_implant_plans')
    .select('id, surgeon_name, plan_name, procedure_type, is_default')
    .order('surgeon_name')

  // Get tomorrow's cases for facility summary
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

  const { data: tomorrowCases } = await supabase
    .from('cases')
    .select('id, case_id, surgeon_name, procedure_name, surgery_date, hospital_name, side, status, facility_id, facilities(name)')
    .gte('surgery_date', tomorrowStart.toISOString())
    .lt('surgery_date', tomorrowEnd.toISOString())
    .order('surgery_date')

  // Get kit issues for tomorrow's cases
  const tomorrowCaseSfIds = (tomorrowCases ?? []).map((c) => c.id)
  const { data: tomorrowKitIssues } = tomorrowCaseSfIds.length > 0
    ? await supabase.from('case_kit_issues').select('*').in('case_sf_id', tomorrowCaseSfIds)
    : { data: [] }

  // Build tomorrow's facility summary
  const tomorrowFacilities: {
    facilityId: string
    facilityName: string
    kneeCount: number
    hipCount: number
    otherCount: number
    totalCases: number
    surgeons: string[]
    readyCount: number
    assignedCount: number
    requestedCount: number
    kitIssueCount: number
    missingParts: number
  }[] = []

  const tomorrowByFacility: Record<string, typeof tomorrowCases> = {}
  ;(tomorrowCases ?? []).forEach((c) => {
    const fId = c.facility_id ?? 'unknown'
    if (!tomorrowByFacility[fId]) tomorrowByFacility[fId] = []
    tomorrowByFacility[fId]!.push(c)
  })

  // Get surgeon display name mappings (need this before building summary)
  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('repsuite_name, display_name')

  const surgeonNameMap: Record<string, string> = {}
  surgeonMappings?.forEach((m) => { surgeonNameMap[m.repsuite_name] = m.display_name })

  for (const [fId, cases] of Object.entries(tomorrowByFacility)) {
    if (!cases) continue
    const facility = Array.isArray(cases[0]?.facilities) ? cases[0]?.facilities[0] : cases[0]?.facilities
    const facilityName = facility?.name ?? cases[0]?.hospital_name?.replace(/^\d+ - /, '') ?? 'Unknown'

    const procNames = cases.map((c) => (c.procedure_name ?? '').toLowerCase())
    const kneeCount = procNames.filter((p) => p.includes('knee') || p.includes('tka') || p.includes('pka') || p.includes('uka')).length
    const hipCount = procNames.filter((p) => p.includes('hip') || p.includes('tha')).length
    const otherCount = cases.length - kneeCount - hipCount

    const surgeonSet = new Set<string>()
    cases.forEach((c) => {
      if (c.surgeon_name) {
        surgeonSet.add(surgeonNameMap[c.surgeon_name] ?? c.surgeon_name.replace(/^\d+ - /, ''))
      }
    })

    const readyCount = cases.filter((c) => c.status === 'Shipped/Ready for Surgery').length
    const assignedCount = cases.filter((c) => c.status === 'Assigned').length
    const requestedCount = cases.filter((c) => c.status === 'Requested' || c.status === 'New').length

    // Kit issues for this facility's cases
    const facilityCaseIds = cases.map((c) => c.id)
    const facilityKitIssues = (tomorrowKitIssues ?? []).filter((ki: { case_sf_id: string }) => facilityCaseIds.includes(ki.case_sf_id))
    const missingParts = facilityKitIssues.reduce((sum: number, ki: { missing_count: number }) => sum + (ki.missing_count ?? 0), 0)

    tomorrowFacilities.push({
      facilityId: fId,
      facilityName,
      kneeCount,
      hipCount,
      otherCount,
      totalCases: cases.length,
      surgeons: Array.from(surgeonSet),
      readyCount,
      assignedCount,
      requestedCount,
      kitIssueCount: facilityKitIssues.length,
      missingParts,
    })
  }

  tomorrowFacilities.sort((a, b) => b.totalCases - a.totalCases)

  // Apply surgeon mappings to cases — keep raw name for plan matching
  const mappedCases = (upcomingCases ?? []).map((c) => ({
    ...c,
    raw_surgeon_name: c.surgeon_name,
    surgeon_name: surgeonNameMap[c.surgeon_name ?? ''] ?? c.surgeon_name?.replace(/^\d+ - /, '') ?? null,
  }))

  // Get last sync time
  const { data: lastSync } = await supabase
    .from('cases')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  // Get inventory alerts
  const { data: inventoryAlerts } = await supabase
    .from('inventory_alerts')
    .select('*, facilities(name)')
    .order('surgery_date')

  // Get kit issues (incomplete shipped kits)
  const { data: kitIssues } = await supabase
    .from('case_kit_issues')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10)

  // Get proposed replenishment requests
  const { data: replenishmentRequests } = await supabase
    .from('replenishment_requests')
    .select('*')
    .eq('status', 'proposed')
    .order('surgery_date')

  // Build expiration list across all facilities
  interface ExpirationItem {
    id: string
    description: string | null
    lot_number: string | null
    expiration_date: string
    facility: string
    isExpired: boolean
  }

  const expirationAlerts: ExpirationItem[] = []
  allItems?.forEach((item: { id: string; facility_id: string; description: string | null; lot_number: string | null; expiration_date: string | null }) => {
    if (!item.expiration_date) return
    const facility = facilities?.find((f) => f.id === item.facility_id)

    if (item.expiration_date < today) {
      expirationAlerts.push({
        id: item.id,
        description: item.description,
        lot_number: item.lot_number,
        expiration_date: item.expiration_date,
        facility: facility?.name ?? 'Unknown',
        isExpired: true,
      })
    } else if (item.expiration_date <= ninetyDaysStr) {
      expirationAlerts.push({
        id: item.id,
        description: item.description,
        lot_number: item.lot_number,
        expiration_date: item.expiration_date,
        facility: facility?.name ?? 'Unknown',
        isExpired: false,
      })
    }
  })

  // Sort: expired first, then by date
  expirationAlerts.sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? -1 : 1
    return a.expiration_date.localeCompare(b.expiration_date)
  })

  const expiredCount = expirationAlerts.filter((a) => a.isExpired).length
  const expiringCount = expirationAlerts.filter((a) => !a.isExpired).length

  return (
    <div className="space-y-6">
      <RealtimeRefresh />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Your territory at a glance</p>
        </div>
        <SyncButton lastSyncedAt={lastSync?.synced_at ?? null} />
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Tomorrow</p>
          <p className="text-2xl font-bold text-gray-900">{tomorrowFacilities.reduce((s, f) => s + f.totalCases, 0)}</p>
          <p className="text-xs text-gray-400">{tomorrowFacilities.length} {tomorrowFacilities.length === 1 ? 'facility' : 'facilities'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Total Inventory</p>
          <p className="text-2xl font-bold text-gray-900">{Object.values(facilityStats).reduce((s, f) => s + f.itemCount, 0)}</p>
          <p className="text-xs text-gray-400">{facilities?.length ?? 0} facilities</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${(inventoryAlerts?.length ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500">Alerts</p>
          <p className={`text-2xl font-bold ${(inventoryAlerts?.length ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{inventoryAlerts?.length ?? 0}</p>
          <p className="text-xs text-gray-400">shortage alerts</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${expiredCount > 0 ? 'bg-red-50 border-red-200' : expiringCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500">Expiring</p>
          <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-600' : expiringCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{expiredCount + expiringCount}</p>
          <p className="text-xs text-gray-400">{expiredCount > 0 ? `${expiredCount} expired` : 'within 90 days'}</p>
        </div>
      </div>

      {/* Tomorrow's Facility Summary */}
      {tomorrowFacilities.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tomorrow&apos;s Facilities</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {tomorrowFacilities.reduce((s, f) => s + f.totalCases, 0)} cases across {tomorrowFacilities.length} {tomorrowFacilities.length === 1 ? 'facility' : 'facilities'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tomorrowFacilities.map((f) => {
              const hasIssues = f.kitIssueCount > 0 || f.requestedCount > 0
              const facilityAlerts = (inventoryAlerts ?? []).filter((a: { facility_id: string }) => a.facility_id === f.facilityId)
              return (
                <div key={f.facilityId} className={`rounded-lg border p-4 ${hasIssues || facilityAlerts.length > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">{f.facilityName}</h3>
                    <span className="text-xs text-gray-500">{f.totalCases} {f.totalCases === 1 ? 'case' : 'cases'}</span>
                  </div>

                  {/* Procedure counts */}
                  <div className="flex gap-2 mb-3">
                    {f.kneeCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-xs font-medium text-blue-700">
                        {f.kneeCount} Knee
                      </span>
                    )}
                    {f.hipCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-purple-50 text-xs font-medium text-purple-700">
                        {f.hipCount} Hip
                      </span>
                    )}
                    {f.otherCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-600">
                        {f.otherCount} Other
                      </span>
                    )}
                  </div>

                  {/* Surgeons */}
                  <div className="text-xs text-gray-500 mb-3">
                    {f.surgeons.join(', ')}
                  </div>

                  {/* Status breakdown */}
                  <div className="flex gap-3 text-xs mb-2">
                    {f.readyCount > 0 && (
                      <span className="text-emerald-600 font-medium">{f.readyCount} ready</span>
                    )}
                    {f.assignedCount > 0 && (
                      <span className="text-blue-600 font-medium">{f.assignedCount} assigned</span>
                    )}
                    {f.requestedCount > 0 && (
                      <span className="text-amber-600 font-medium">{f.requestedCount} requested</span>
                    )}
                  </div>

                  {/* Kit issues */}
                  {f.kitIssueCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {f.kitIssueCount} {f.kitIssueCount === 1 ? 'kit' : 'kits'} incomplete ({f.missingParts} missing parts)
                    </div>
                  )}

                  {/* Inventory alerts for this facility */}
                  {facilityAlerts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {facilityAlerts.map((alert: { id: string; component: string; variant: string; missing_sizes: string[]; details: unknown }) => {
                        const det = typeof alert.details === 'string' ? JSON.parse(alert.details) : alert.details as Record<string, Record<string, number>> | null
                        return (
                          <div key={alert.id} className="text-xs text-red-600">
                            <div className="flex items-center gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                              </svg>
                              {formatComponentName(alert.component, alert.variant)}
                            </div>
                            <div className="flex flex-wrap gap-1 ml-4 mt-0.5">
                              {alert.missing_sizes?.map((size: string) => (
                                <span key={size} className="text-red-500">
                                  sz {size}: {det?.on_hand?.[size] ?? 0}/{det?.threshold?.[size] ?? 1}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inventory Shortage Alerts */}
      {inventoryAlerts && inventoryAlerts.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-semibold text-red-900">Inventory Shortage Alerts</h2>
            <span className="text-sm font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full ml-auto">
              {inventoryAlerts.length} {inventoryAlerts.length === 1 ? 'alert' : 'alerts'}
            </span>
          </div>
          <div className="space-y-2">
            {inventoryAlerts.map((alert: any) => {
              const facility = Array.isArray(alert.facilities) ? alert.facilities[0] : alert.facilities
              const componentName = formatComponentName(alert.component, alert.variant)
              const details = typeof alert.details === 'string' ? JSON.parse(alert.details) : alert.details
              const onHand = details?.on_hand ?? {}
              const threshold = details?.threshold ?? {}
              return (
                <div key={alert.id} className="bg-white rounded-lg border border-red-100 p-3 flex items-center gap-3">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-red-800">{componentName}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {alert.missing_sizes?.map((size: string) => (
                        <span key={size} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-xs">
                          <span className="font-medium text-red-800">Size {size}</span>
                          <span className="text-red-500">{onHand[size] ?? 0} on hand</span>
                          <span className="text-red-400">/ {threshold[size] ?? 1} min</span>
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {facility?.name ?? '—'} · {alert.surgery_date ? new Date(alert.surgery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Replenishment Proposals */}
      <ReplenishmentProposals
        proposals={replenishmentRequests ?? []}
        surgeonNameMap={surgeonNameMap}
      />

      {/* Incomplete Kit Alerts */}
      {kitIssues && kitIssues.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h2 className="text-lg font-semibold text-amber-900">Incomplete Kits</h2>
            <span className="text-sm font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-auto">
              {kitIssues.length} {kitIssues.length === 1 ? 'kit' : 'kits'}
            </span>
          </div>
          <div className="space-y-2">
            {kitIssues.map((issue: { id: string; kit_name: string; kit_no: string; missing_count: number; total_parts: number; missing_parts: { catalog_number: string; part_name: string }[] }) => (
              <div key={issue.id} className="bg-white rounded-lg border border-amber-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{issue.kit_name}</span>
                  <span className="text-xs text-amber-600 font-medium">{issue.missing_count} of {issue.total_parts} missing</span>
                </div>
                {issue.kit_no && <span className="text-xs text-gray-400">Kit #{issue.kit_no}</span>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(Array.isArray(issue.missing_parts) ? issue.missing_parts : []).map((part, i) => (
                    <span key={i} className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      {part.part_name || part.catalog_number}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facility Inventory */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Facility Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Facility</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">On Hand</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Expired</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Expiring</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium">Alerts</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Last Scan</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {facilities?.map((facility) => {
                const stats = facilityStats[facility.id]
                const alertCount = (inventoryAlerts ?? []).filter((a: { facility_id: string }) => a.facility_id === facility.id).length
                return (
                  <tr key={facility.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-gray-900">{facility.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-gray-900">{stats?.itemCount ?? 0}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`font-semibold ${(stats?.expiredCount ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {stats?.expiredCount ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`font-semibold ${(stats?.expiringCount ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {stats?.expiringCount ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {alertCount > 0 ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{alertCount}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">
                      {stats?.lastScan ? new Date(stats.lastScan).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <Link href={`/par-levels/${facility.id}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Par</Link>
                        <Link href={`/inventory?facility=${facility.id}`} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Log</Link>
                        <Link href={`/instruments/${facility.id}`} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Trays</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(!facilities || facilities.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No facilities yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiration Alerts */}
      {expirationAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Expiration Alerts
            </h2>
            <div className="flex gap-3 text-xs">
              {expiredCount > 0 && (
                <span className="text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
                  {expiredCount} expired
                </span>
              )}
              {expiringCount > 0 && (
                <span className="text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full">
                  {expiringCount} expiring within 90 days
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Item</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Lot</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Facility</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {expirationAlerts.slice(0, 15).map((alert) => (
                  <tr key={alert.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900 max-w-xs truncate">
                      {alert.description ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{alert.lot_number ?? '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{alert.facility}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        alert.isExpired
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.expiration_date}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expirationAlerts.length > 15 && (
              <div className="pt-3 text-center">
                <Link href="/inventory" className="text-sm text-blue-600 hover:text-blue-700">
                  View all {expirationAlerts.length} items →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Cases */}
      <UpcomingCases cases={mappedCases} plans={allPlans ?? []} />
    </div>
  )
}
