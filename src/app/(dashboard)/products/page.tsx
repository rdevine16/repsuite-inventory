import { createClient } from '@/lib/supabase-server'
import ProductGroupsManager from './product-groups-manager'

export default async function ProductGroupsPage() {
  const supabase = await createClient()

  const { data: productGroups } = await supabase
    .from('product_groups')
    .select('id, catalog_name, display_name')
    .order('display_name')

  // Get all catalog items with their refs and group assignments
  const { data: catalogItems } = await supabase
    .from('product_catalog')
    .select('gtin, reference_number, description, product_group_id')
    .order('reference_number')

  // Build group details: refs and GTIN counts per group
  const groupDetails: Record<string, { gtinCount: number; refs: string[] }> = {}
  catalogItems?.forEach((item) => {
    if (!item.product_group_id) return
    if (!groupDetails[item.product_group_id]) {
      groupDetails[item.product_group_id] = { gtinCount: 0, refs: [] }
    }
    groupDetails[item.product_group_id].gtinCount++
    groupDetails[item.product_group_id].refs.push(item.reference_number)
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Groups</h1>
        <p className="text-gray-500 mt-1">
          Manage display names and group references. Each group combines one or more reference numbers under a single display name for counting and par levels.
        </p>
      </div>

      <ProductGroupsManager
        productGroups={productGroups ?? []}
        groupDetails={groupDetails}
        allCatalogItems={catalogItems ?? []}
        userRole={profile?.role ?? 'viewer'}
      />
    </div>
  )
}
