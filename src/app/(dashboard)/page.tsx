import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch facilities
  const { data: facilities } = await supabase
    .from('facilities')
    .select('*')
    .order('name')

  // Fetch recent sessions
  const { data: sessions } = await supabase
    .from('inventory_sessions')
    .select('*, facilities(name)')
    .order('started_at', { ascending: false })
    .limit(5)

  // Fetch inventory counts per facility
  const { data: inventoryCounts } = await supabase
    .from('inventory_items')
    .select('session_id, inventory_sessions(facility_id)')

  // Fetch total unique products
  const { count: totalProducts } = await supabase
    .from('product_catalog')
    .select('*', { count: 'exact', head: true })

  // Fetch items expiring within 90 days
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
  const { data: expiringItems } = await supabase
    .from('inventory_items')
    .select('*')
    .lt('expiration_date', ninetyDaysFromNow.toISOString().split('T')[0])
    .gt('expiration_date', new Date().toISOString().split('T')[0])
    .order('expiration_date')
    .limit(10)

  // Fetch items already expired
  const { data: expiredItems, count: expiredCount } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact' })
    .lt('expiration_date', new Date().toISOString().split('T')[0])
    .limit(5)

  // Fetch par level alerts
  const { data: parLevels } = await supabase
    .from('par_levels')
    .select('*, product_catalog(description, reference_number), facilities(name)')

  // Count items per GTIN per facility for par level comparison
  const { data: itemsByGtin } = await supabase
    .from('inventory_items')
    .select('gtin, session_id, inventory_sessions(facility_id)')

  // Build facility item count map
  const facilityGtinCounts: Record<string, Record<string, number>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemsByGtin?.forEach((item: any) => {
    const sessions = item.inventory_sessions
    const facilityId = Array.isArray(sessions) ? sessions[0]?.facility_id : sessions?.facility_id
    if (facilityId && item.gtin) {
      if (!facilityGtinCounts[facilityId]) facilityGtinCounts[facilityId] = {}
      facilityGtinCounts[facilityId][item.gtin] = (facilityGtinCounts[facilityId][item.gtin] || 0) + 1
    }
  })

  // Find below-par items
  const belowParAlerts: Array<{
    product: string
    reference: string
    facility: string
    current: number
    min: number
  }> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parLevels?.forEach((pl: any) => {
    const current = facilityGtinCounts[pl.facility_id]?.[pl.gtin] || 0
    if (current < pl.min_quantity) {
      const catalog = Array.isArray(pl.product_catalog) ? pl.product_catalog[0] : pl.product_catalog
      const facility = Array.isArray(pl.facilities) ? pl.facilities[0] : pl.facilities
      belowParAlerts.push({
        product: catalog?.description ?? 'Unknown',
        reference: catalog?.reference_number ?? '',
        facility: facility?.name ?? 'Unknown',
        current,
        min: pl.min_quantity,
      })
    }
  })

  const totalItems = inventoryCounts?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your inventory across all facilities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={totalItems}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          label="Products in Catalog"
          value={totalProducts ?? 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          label="Facilities"
          value={facilities?.length ?? 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          label="Below Par Alerts"
          value={belowParAlerts.length}
          alert={belowParAlerts.length > 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Below Par Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Below Par Alerts</h2>
          {belowParAlerts.length === 0 ? (
            <p className="text-gray-400 text-sm">All items are at or above par levels.</p>
          ) : (
            <div className="space-y-3">
              {belowParAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="p-1 bg-red-100 rounded-md">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{alert.product}</p>
                    <p className="text-xs text-gray-500">{alert.reference} &middot; {alert.facility}</p>
                    <p className="text-xs text-red-600 font-medium mt-1">
                      {alert.current} on hand / {alert.min} minimum
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Expiration Alerts
            {(expiredCount ?? 0) > 0 && (
              <span className="ml-2 text-sm font-normal text-red-600">
                {expiredCount} expired
              </span>
            )}
          </h2>
          {(!expiringItems || expiringItems.length === 0) && (!expiredItems || expiredItems.length === 0) ? (
            <p className="text-gray-400 text-sm">No expiration alerts.</p>
          ) : (
            <div className="space-y-2">
              {expiredItems?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                    <p className="text-xs text-gray-500">Lot: {item.lot_number}</p>
                  </div>
                  <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    Expired {item.expiration_date}
                  </span>
                </div>
              ))}
              {expiringItems?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                    <p className="text-xs text-gray-500">Lot: {item.lot_number}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    Exp {item.expiration_date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Inventory Sessions</h2>
          <Link href="/inventory" className="text-sm text-blue-600 hover:text-blue-700">
            View all inventory →
          </Link>
        </div>
        {!sessions || sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">No inventory sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Facility</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Started</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Items</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => (
                  <tr key={session.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      {Array.isArray(session.facilities) ? session.facilities[0]?.name : session.facilities?.name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {new Date(session.started_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        session.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {session.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{session.total_items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  alert,
}: {
  label: string
  value: number
  icon: React.ReactNode
  alert?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${alert ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${alert ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
