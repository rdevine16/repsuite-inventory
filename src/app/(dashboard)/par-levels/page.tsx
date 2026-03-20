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
    .select('*, product_catalog(description, reference_number), facilities(name)')
    .order('created_at', { ascending: false })

  const { data: products } = await supabase
    .from('product_catalog')
    .select('gtin, reference_number, description')
    .order('description')

  // Get current counts per facility/gtin
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('gtin, session_id, inventory_sessions(facility_id)')

  const currentCounts: Record<string, Record<string, number>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventoryItems?.forEach((item: any) => {
    const sessions = item.inventory_sessions
    const facilityId = Array.isArray(sessions) ? sessions[0]?.facility_id : sessions?.facility_id
    if (facilityId && item.gtin) {
      if (!currentCounts[facilityId]) currentCounts[facilityId] = {}
      currentCounts[facilityId][item.gtin] = (currentCounts[facilityId][item.gtin] || 0) + 1
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
          Set minimum and maximum stock levels for products at each facility
        </p>
      </div>

      <ParLevelsManager
        parLevels={parLevels ?? []}
        facilities={facilities ?? []}
        products={products ?? []}
        currentCounts={currentCounts}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
