import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import KneeParGrid from './knee-par-grid'
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

  // Fetch all par levels for this facility
  const { data: parLevels } = await supabase
    .from('component_par_levels')
    .select('*')
    .eq('facility_id', facilityId)

  // Build lookup: category|variant|size → par_quantity
  const parMap: Record<string, number> = {}
  parLevels?.forEach((p: { category: string; variant: string; size: string; par_quantity: number }) => {
    parMap[`${p.category}|${p.variant}|${p.size}`] = p.par_quantity
  })

  // Fetch inventory items for this facility to compute on-hand counts
  const { data: sessions } = await supabase
    .from('inventory_sessions')
    .select('id')
    .eq('facility_id', facilityId)

  const sessionIds = sessions?.map((s: { id: string }) => s.id) ?? []

  let onHandMap: Record<string, number> = {}
  if (sessionIds.length > 0) {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('gtin, reference_number')
      .in('session_id', sessionIds)

    onHandMap = buildOnHandCounts(items ?? [])
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .single()

  // Count knee and hip pars
  const kneePars = parLevels?.filter((p: { category: string }) => p.category.startsWith('knee_')).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button className="py-3 px-1 border-b-2 border-blue-600 text-blue-600 font-medium text-sm">
            Knee
            {kneePars > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{kneePars}</span>
            )}
          </button>
          <button className="py-3 px-1 border-b-2 border-transparent text-gray-400 font-medium text-sm cursor-not-allowed">
            Hip
            <span className="ml-1 text-xs text-gray-300">(coming soon)</span>
          </button>
        </nav>
      </div>

      {/* Knee Grid */}
      <KneeParGrid
        facilityId={facilityId}
        parMap={parMap}
        onHandMap={onHandMap}
        canEdit={profile?.role === 'admin' || profile?.role === 'manager'}
      />
    </div>
  )
}
