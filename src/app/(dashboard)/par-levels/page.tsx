import { createClient } from '@/lib/supabase-server'
import ParLevelsManager from './par-levels-manager'

export default async function ParLevelsPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name')

  const { data: parLevels } = await supabase
    .from('par_levels')
    .select('*, product_groups(catalog_name, display_name), facilities(name)')
    .order('created_at', { ascending: false })

  // Fetch product groups (not individual GTINs)
  const { data: productGroups } = await supabase
    .from('product_groups')
    .select('id, catalog_name, display_name')
    .order('display_name')

  // Get current counts per facility/product_group
  // We need to join inventory_items -> product_catalog -> product_groups
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('gtin, session_id, inventory_sessions(facility_id)')

  // Get product_catalog gtin -> product_group_id mapping
  const { data: catalogMapping } = await supabase
    .from('product_catalog')
    .select('gtin, product_group_id')

  const gtinToGroup: Record<string, string> = {}
  catalogMapping?.forEach((item: { gtin: string; product_group_id: string | null }) => {
    if (item.product_group_id) {
      gtinToGroup[item.gtin] = item.product_group_id
    }
  })

  // Count items per facility per product_group
  const currentCounts: Record<string, Record<string, number>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventoryItems?.forEach((item: any) => {
    const sessions = item.inventory_sessions
    const facilityId = Array.isArray(sessions) ? sessions[0]?.facility_id : sessions?.facility_id
    const groupId = item.gtin ? gtinToGroup[item.gtin] : null
    if (facilityId && groupId) {
      if (!currentCounts[facilityId]) currentCounts[facilityId] = {}
      currentCounts[facilityId][groupId] = (currentCounts[facilityId][groupId] || 0) + 1
    }
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Par Levels</h1>
        <p className="text-gray-500 mt-1">
          Set minimum and maximum stock levels for product groups at each facility
        </p>
      </div>

      <ParLevelsManager
        parLevels={parLevels ?? []}
        facilities={facilities ?? []}
        productGroups={productGroups ?? []}
        currentCounts={currentCounts}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
