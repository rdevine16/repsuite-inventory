import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstrumentTrays from './instrument-trays'

export default async function FacilityInstrumentsPage({
  params,
}: {
  params: Promise<{ facilityId: string }>
}) {
  const { facilityId } = await params
  const supabase = await createClient()

  const { data: facility } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('id', facilityId)
    .single()

  if (!facility) redirect('/instruments')

  // Fetch all trays (Supabase defaults to 1000, so paginate)
  let allTrays: any[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data: batch } = await supabase
      .from('instrument_trays')
      .select('*')
      .eq('facility_id', facilityId)
      .order('category')
      .order('name')
      .order('set_id')
      .range(from, from + pageSize - 1)
    if (!batch || batch.length === 0) break
    allTrays = allTrays.concat(batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  const trays = allTrays

  // Load full instrument catalog for the add form dropdown (paginate past 1000)
  let allCatalog: any[] = []
  let catFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('instrument_catalog')
      .select('id, display_name, repsuite_name, category, subcategory, item_type, catalog_number, is_custom')
      .order('display_name')
      .range(catFrom, catFrom + 999)
    if (!batch || batch.length === 0) break
    allCatalog = allCatalog.concat(batch)
    if (batch.length < 1000) break
    catFrom += 1000
  }
  const catalogItems = allCatalog

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/instruments"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{facility.name}</h1>
          <p className="text-gray-500 text-sm">Instrument trays</p>
        </div>
      </div>

      <InstrumentTrays
        facilityId={facilityId}
        trays={trays ?? []}
        catalogItems={catalogItems ?? []}
        canEdit={profile?.role === 'admin' || profile?.role === 'manager'}
      />
    </div>
  )
}
