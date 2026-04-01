import { createClient } from '@/lib/supabase-server'
import { Suspense } from 'react'
import DashboardShell from './dashboard-shell'

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

  // Inventory items for Activity tab (existing table)
  const { data: items } = await supabase
    .from('facility_inventory')
    .select('*, facilities(name)')
    .eq('facility_id', selectedFacilityId)
    .order('added_at', { ascending: false })

  // GTIN display name mapping
  const { data: catalogWithGroups } = await supabase
    .from('product_catalog')
    .select('gtin, product_groups(display_name)')

  const gtinDisplayName: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catalogWithGroups?.forEach((item: any) => {
    const group = Array.isArray(item.product_groups) ? item.product_groups[0] : item.product_groups
    if (group?.display_name) {
      gtinDisplayName[item.gtin] = group.display_name
    }
  })

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
          inventoryItems={items ?? []}
          gtinDisplayName={gtinDisplayName}
        />
      </Suspense>
    </div>
  )
}
