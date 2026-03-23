import { createClient } from '@/lib/supabase-server'
import InventoryTable from './inventory-table'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name')

  const { data: items } = await supabase
    .from('facility_inventory')
    .select('*, facilities(name)')
    .order('added_at', { ascending: false })

  // Build gtin -> display_name mapping
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
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">View and search all inventory items</p>
      </div>

      <InventoryTable
        items={items ?? []}
        facilities={facilities ?? []}
        gtinDisplayName={gtinDisplayName}
      />
    </div>
  )
}
