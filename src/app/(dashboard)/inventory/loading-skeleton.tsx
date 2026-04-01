export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="mt-3 h-7 w-16 bg-gray-200 rounded" />
          <div className="mt-2 h-3 w-32 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-200 h-10" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
          <div className="h-3 flex-1 bg-gray-100 rounded" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Facility header skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="mt-2 h-3 w-56 bg-gray-100 rounded" />
          </div>
          <div className="h-6 w-28 bg-gray-100 rounded-full" />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="border-b border-gray-200 pb-3 flex gap-6 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-16 bg-gray-200 rounded" />
        ))}
      </div>

      {/* KPI skeleton */}
      <KpiSkeleton />
    </div>
  )
}
