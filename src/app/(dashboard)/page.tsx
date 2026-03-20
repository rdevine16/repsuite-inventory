import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address')
    .order('name')

  // Get sessions per facility with latest date
  const { data: sessions } = await supabase
    .from('inventory_sessions')
    .select('id, facility_id, started_at, status, total_items')
    .order('started_at', { ascending: false })

  // Get item counts and expiration data per facility
  const { data: allItems } = await supabase
    .from('inventory_items')
    .select('id, description, lot_number, expiration_date, session_id, inventory_sessions(facility_id)')

  const today = new Date().toISOString().split('T')[0]
  const ninetyDays = new Date()
  ninetyDays.setDate(ninetyDays.getDate() + 90)
  const ninetyDaysStr = ninetyDays.toISOString().split('T')[0]

  // Build per-facility stats
  const facilityStats: Record<string, {
    itemCount: number
    expiredCount: number
    expiringCount: number
    lastScan: string | null
  }> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allItems?.forEach((item: any) => {
    const sessions = item.inventory_sessions
    const facilityId = Array.isArray(sessions) ? sessions[0]?.facility_id : sessions?.facility_id
    if (!facilityId) return

    if (!facilityStats[facilityId]) {
      facilityStats[facilityId] = { itemCount: 0, expiredCount: 0, expiringCount: 0, lastScan: null }
    }
    facilityStats[facilityId].itemCount++

    if (item.expiration_date) {
      if (item.expiration_date < today) {
        facilityStats[facilityId].expiredCount++
      } else if (item.expiration_date <= ninetyDaysStr) {
        facilityStats[facilityId].expiringCount++
      }
    }
  })

  // Add last scan dates from sessions
  sessions?.forEach((s: { facility_id: string; started_at: string }) => {
    if (!facilityStats[s.facility_id]) {
      facilityStats[s.facility_id] = { itemCount: 0, expiredCount: 0, expiringCount: 0, lastScan: null }
    }
    if (!facilityStats[s.facility_id].lastScan) {
      facilityStats[s.facility_id].lastScan = s.started_at
    }
  })

  // Build expiration list across all facilities
  interface ExpirationItem {
    id: string
    description: string | null
    lot_number: string | null
    expiration_date: string
    facility: string
    isExpired: boolean
  }

  const expirationAlerts: ExpirationItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allItems?.forEach((item: any) => {
    if (!item.expiration_date) return
    const sessions = item.inventory_sessions
    const facilityId = Array.isArray(sessions) ? sessions[0]?.facility_id : sessions?.facility_id
    const facility = facilities?.find((f) => f.id === facilityId)

    if (item.expiration_date < today) {
      expirationAlerts.push({
        id: item.id,
        description: item.description,
        lot_number: item.lot_number,
        expiration_date: item.expiration_date,
        facility: facility?.name ?? 'Unknown',
        isExpired: true,
      })
    } else if (item.expiration_date <= ninetyDaysStr) {
      expirationAlerts.push({
        id: item.id,
        description: item.description,
        lot_number: item.lot_number,
        expiration_date: item.expiration_date,
        facility: facility?.name ?? 'Unknown',
        isExpired: false,
      })
    }
  })

  // Sort: expired first, then by date
  expirationAlerts.sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? -1 : 1
    return a.expiration_date.localeCompare(b.expiration_date)
  })

  const expiredCount = expirationAlerts.filter((a) => a.isExpired).length
  const expiringCount = expirationAlerts.filter((a) => !a.isExpired).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your facilities at a glance</p>
      </div>

      {/* Facility Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {facilities?.map((facility) => {
          const stats = facilityStats[facility.id]
          return (
            <div key={facility.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{facility.name}</h2>
                  {facility.address && (
                    <p className="text-sm text-gray-400">{facility.address}</p>
                  )}
                </div>
                {stats?.lastScan && (
                  <span className="text-xs text-gray-400">
                    Last scan {new Date(stats.lastScan).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Facility Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{stats?.itemCount ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">On Hand</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${(stats?.expiredCount ?? 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${(stats?.expiredCount ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {stats?.expiredCount ?? 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Expired</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${(stats?.expiringCount ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${(stats?.expiringCount ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {stats?.expiringCount ?? 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Expiring 90d</p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="flex gap-2">
                <Link
                  href={`/par-levels/${facility.id}`}
                  className="flex-1 text-center py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Par Levels
                </Link>
                <Link
                  href={`/inventory?facility=${facility.id}`}
                  className="flex-1 text-center py-2 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Scan Log
                </Link>
              </div>
            </div>
          )
        })}
        {(!facilities || facilities.length === 0) && (
          <p className="text-gray-400 col-span-full text-center py-12">
            No facilities yet. Facilities are created when inventory is scanned from the iOS app.
          </p>
        )}
      </div>

      {/* Expiration Alerts */}
      {expirationAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Expiration Alerts
            </h2>
            <div className="flex gap-3 text-xs">
              {expiredCount > 0 && (
                <span className="text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
                  {expiredCount} expired
                </span>
              )}
              {expiringCount > 0 && (
                <span className="text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full">
                  {expiringCount} expiring within 90 days
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Item</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Lot</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Facility</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {expirationAlerts.slice(0, 15).map((alert) => (
                  <tr key={alert.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900 max-w-xs truncate">
                      {alert.description ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{alert.lot_number ?? '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{alert.facility}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        alert.isExpired
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.expiration_date}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expirationAlerts.length > 15 && (
              <div className="pt-3 text-center">
                <Link href="/inventory" className="text-sm text-blue-600 hover:text-blue-700">
                  View all {expirationAlerts.length} items →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
