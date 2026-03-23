import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ParLevelsTabs from './par-levels-tabs'
import { buildOnHandCounts } from '@/lib/inventory-mapper'

export default async function FacilityParLevelsPage({
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

  if (!facility) redirect('/par-levels')

  const { data: parLevels } = await supabase
    .from('component_par_levels')
    .select('*')
    .eq('facility_id', facilityId)

  const parMap: Record<string, number> = {}
  parLevels?.forEach((p: { category: string; variant: string; size: string; par_quantity: number }) => {
    parMap[`${p.category}|${p.variant}|${p.size}`] = p.par_quantity
  })

  const { data: items } = await supabase
    .from('facility_inventory')
    .select('gtin, reference_number')
    .eq('facility_id', facilityId)

  const onHandMap = buildOnHandCounts(items ?? [])

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  const kneePars = parLevels?.filter((p: { category: string }) => p.category.startsWith('knee_')).length ?? 0
  const hipPars = parLevels?.filter((p: { category: string }) => p.category.startsWith('hip_')).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/par-levels"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{facility.name}</h1>
          <p className="text-gray-500 text-sm">Implant par levels</p>
        </div>
      </div>

      <ParLevelsTabs
        facilityId={facilityId}
        parMap={parMap}
        onHandMap={onHandMap}
        canEdit={profile?.role === 'admin' || profile?.role === 'manager'}
        kneePars={kneePars}
        hipPars={hipPars}
      />
    </div>
  )
}
