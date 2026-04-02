export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import GroupingsTabs from './groupings-tabs'
import ProductGroupsManager from './product-groups-manager'
import InstrumentCatalogManager from './instrument-catalog-manager'
import FacilityMappingManager from './facility-mapping-manager'
import SurgeonMappingManager from './surgeon-mapping-manager'
import KitMappingManager from './kit-mapping-manager'

export default async function GroupingsPage() {
  const supabase = await createClient()

  // Facilities data
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address, repsuite_site_number')
    .order('name')

  // Get unique RepSuite hospitals from synced cases
  const { data: caseHospitals } = await supabase
    .from('cases')
    .select('hospital_name, hospital_site_number')

  // Deduplicate
  const hospitalMap = new Map<string, { hospital_name: string; hospital_site_number: string }>()
  caseHospitals?.forEach((c) => {
    if (c.hospital_site_number && !hospitalMap.has(c.hospital_site_number)) {
      hospitalMap.set(c.hospital_site_number, {
        hospital_name: c.hospital_name,
        hospital_site_number: c.hospital_site_number,
      })
    }
  })
  const repsuiteHospitals = Array.from(hospitalMap.values()).sort((a, b) =>
    a.hospital_name.localeCompare(b.hospital_name)
  )

  // Surgeon mappings
  const { data: surgeonMappings } = await supabase
    .from('surgeon_mappings')
    .select('id, repsuite_name, display_name')
    .order('display_name')

  // Get unique surgeons from cases
  const { data: caseSurgeons } = await supabase
    .from('cases')
    .select('surgeon_name')

  const surgeonSet = new Set<string>()
  caseSurgeons?.forEach((c) => {
    if (c.surgeon_name) surgeonSet.add(c.surgeon_name)
  })

  const repsuiteSurgeons = Array.from(surgeonSet)
    .sort()
    .map((name) => ({ surgeon_name: name }))

  // Product groups data (paginate past 1000 default)
  let allProductGroups: any[] = []
  let pgFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('product_groups')
      .select('id, catalog_name, display_name')
      .order('display_name')
      .range(pgFrom, pgFrom + 999)
    if (!batch || batch.length === 0) break
    allProductGroups = allProductGroups.concat(batch)
    if (batch.length < 1000) break
    pgFrom += 1000
  }
  const productGroups = allProductGroups

  let allCatalogItems: any[] = []
  let ciFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('product_catalog')
      .select('gtin, reference_number, description, product_group_id')
      .order('reference_number')
      .range(ciFrom, ciFrom + 999)
    if (!batch || batch.length === 0) break
    allCatalogItems = allCatalogItems.concat(batch)
    if (batch.length < 1000) break
    ciFrom += 1000
  }
  const catalogItems = allCatalogItems

  const groupDetails: Record<string, { gtinCount: number; refs: string[] }> = {}
  catalogItems?.forEach((item) => {
    if (!item.product_group_id) return
    if (!groupDetails[item.product_group_id]) {
      groupDetails[item.product_group_id] = { gtinCount: 0, refs: [] }
    }
    groupDetails[item.product_group_id].gtinCount++
    groupDetails[item.product_group_id].refs.push(item.reference_number)
  })

  // Kit mappings
  const { data: kitMappings } = await supabase
    .from('kit_mappings')
    .select('id, repsuite_name, display_name, category')
    .order('display_name')

  // Get unique set/kit names synced from iOS case details
  const { data: repsuiteSetNames } = await supabase
    .from('repsuite_set_names')
    .select('set_name, set_type')
    .order('set_name')

  const repsuiteKits = (repsuiteSetNames ?? []).map((s) => ({ kit_name: s.set_name }))

  // Kit variant mappings (implant component/variant mapping for coverage engine)
  const { data: kitVariantMappings } = await supabase
    .from('kit_variant_mappings')
    .select('id, set_name, component, variant, side, tub_group, tubs_in_group, is_implant, notes')
    .order('set_name')

  // Instrument catalog data (paginate past 1000 default)
  let allInstruments: any[] = []
  let instFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('instrument_catalog')
      .select('*')
      .order('display_name')
      .range(instFrom, instFrom + 999)
    if (!batch || batch.length === 0) break
    allInstruments = allInstruments.concat(batch)
    if (batch.length < 1000) break
    instFrom += 1000
  }
  const instrumentCatalog = allInstruments

  // Count how many facility trays are linked to each catalog entry (paginate)
  let allTrayCounts: any[] = []
  let tcFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('instrument_trays')
      .select('catalog_id')
      .not('catalog_id', 'is', null)
      .range(tcFrom, tcFrom + 999)
    if (!batch || batch.length === 0) break
    allTrayCounts = allTrayCounts.concat(batch)
    if (batch.length < 1000) break
    tcFrom += 1000
  }
  const trayCounts = allTrayCounts

  const catalogUsageCounts: Record<string, number> = {}
  trayCounts?.forEach((t) => {
    if (t.catalog_id) {
      catalogUsageCounts[t.catalog_id] = (catalogUsageCounts[t.catalog_id] || 0) + 1
    }
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  const userRole = profile?.role ?? 'viewer'

  // Split catalog into trays and instruments
  const trayCatalog = (instrumentCatalog ?? []).filter((c) => c.item_type === 'tray')
  const instrumentCatalogItems = (instrumentCatalog ?? []).filter((c) => c.item_type === 'instrument')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Groupings</h1>
        <p className="text-gray-500 mt-1">
          Manage mappings between your display names and RepSuite.
        </p>
      </div>

      <GroupingsTabs
        facilitiesContent={
          <FacilityMappingManager
            facilities={facilities ?? []}
            repsuiteHospitals={repsuiteHospitals}
            userRole={userRole}
          />
        }
        surgeonsContent={
          <SurgeonMappingManager
            mappings={surgeonMappings ?? []}
            repsuiteSurgeons={repsuiteSurgeons}
            userRole={userRole}
          />
        }
        kitsContent={
          <KitMappingManager
            mappings={kitMappings ?? []}
            repsuiteKits={repsuiteKits}
            variantMappings={kitVariantMappings ?? []}
            userRole={userRole}
          />
        }
        productsContent={
          <ProductGroupsManager
            productGroups={productGroups ?? []}
            groupDetails={groupDetails}
            allCatalogItems={catalogItems ?? []}
            userRole={userRole}
          />
        }
        traysContent={
          <InstrumentCatalogManager
            catalogItems={trayCatalog}
            usageCounts={catalogUsageCounts}
            userRole={userRole}
            itemType="tray"
          />
        }
        instrumentsContent={
          <InstrumentCatalogManager
            catalogItems={instrumentCatalogItems}
            usageCounts={catalogUsageCounts}
            userRole={userRole}
            itemType="instrument"
          />
        }
        facilityCount={facilities?.length ?? 0}
        surgeonCount={repsuiteSurgeons.length}
        kitCount={new Set([...(kitMappings ?? []).map(m => m.repsuite_name), ...repsuiteKits.map(k => k.kit_name)]).size}
        productCount={productGroups?.length ?? 0}
        trayCount={trayCatalog.length}
        instrumentCount={instrumentCatalogItems.length}
      />
    </div>
  )
}
