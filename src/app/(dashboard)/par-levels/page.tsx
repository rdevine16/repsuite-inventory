import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ParLevelsPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address')
    .order('name')

  // Get par level counts per facility
  const { data: parCounts } = await supabase
    .from('component_par_levels')
    .select('facility_id, par_quantity')

  const facilityCounts: Record<string, { total: number; set: number }> = {}
  parCounts?.forEach((p: { facility_id: string; par_quantity: number }) => {
    if (!facilityCounts[p.facility_id]) facilityCounts[p.facility_id] = { total: 0, set: 0 }
    facilityCounts[p.facility_id].total++
    if (p.par_quantity > 0) facilityCounts[p.facility_id].set++
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Par Levels</h1>
        <p className="text-gray-500 mt-1">Select a facility to manage implant par levels</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {facilities?.map((facility) => {
          const counts = facilityCounts[facility.id]
          return (
            <Link
              key={facility.id}
              href={`/par-levels/${facility.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition">
                    {facility.name}
                  </h3>
                  {facility.address && (
                    <p className="text-sm text-gray-400 mt-0.5">{facility.address}</p>
                  )}
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {counts && (
                <div className="mt-4 flex gap-4 text-sm">
                  <span className="text-gray-500">
                    <span className="font-medium text-gray-900">{counts.set}</span> pars set
                  </span>
                </div>
              )}
            </Link>
          )
        })}
        {(!facilities || facilities.length === 0) && (
          <p className="text-gray-400 col-span-full text-center py-8">
            No facilities found. Facilities are created when inventory is scanned from the iOS app.
          </p>
        )}
      </div>
    </div>
  )
}
