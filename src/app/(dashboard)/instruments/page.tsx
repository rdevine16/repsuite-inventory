import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function InstrumentsPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address')
    .order('name')

  // Get tray counts and status per facility
  const { data: trays } = await supabase
    .from('instrument_trays')
    .select('facility_id, status')

  const facilityStats: Record<string, { total: number; complete: number; usable: number; notUsable: number }> = {}
  trays?.forEach((t: { facility_id: string; status: string }) => {
    if (!facilityStats[t.facility_id]) facilityStats[t.facility_id] = { total: 0, complete: 0, usable: 0, notUsable: 0 }
    facilityStats[t.facility_id].total++
    if (t.status === 'complete') facilityStats[t.facility_id].complete++
    else if (t.status === 'usable') facilityStats[t.facility_id].usable++
    else facilityStats[t.facility_id].notUsable++
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instruments</h1>
        <p className="text-gray-500 mt-1">Track instrument trays consigned at each facility</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {facilities?.map((facility) => {
          const stats = facilityStats[facility.id]
          return (
            <Link
              key={facility.id}
              href={`/instruments/${facility.id}`}
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
              {stats ? (
                <div className="mt-4 flex gap-3 text-xs">
                  <span className="text-gray-500"><span className="font-semibold text-gray-900">{stats.total}</span> trays</span>
                  {stats.notUsable > 0 && (
                    <span className="text-red-600 font-medium">{stats.notUsable} not usable</span>
                  )}
                  {stats.usable > 0 && (
                    <span className="text-amber-600 font-medium">{stats.usable} missing items</span>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-400">No trays tracked yet</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
