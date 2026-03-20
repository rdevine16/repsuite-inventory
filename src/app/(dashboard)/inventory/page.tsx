import { createClient } from '@/lib/supabase-server'
import InventoryTable from './inventory-table'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name')

  const { data: sessions } = await supabase
    .from('inventory_sessions')
    .select('id, facility_id, started_at, status, total_items, facilities(name)')
    .order('started_at', { ascending: false })

  const { data: items } = await supabase
    .from('inventory_items')
    .select('*, inventory_sessions(facility_id, facilities(name))')
    .order('scanned_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">View and search all scanned inventory items</p>
      </div>

      <InventoryTable
        items={items ?? []}
        facilities={facilities ?? []}
        sessions={sessions ?? []}
      />
    </div>
  )
}
